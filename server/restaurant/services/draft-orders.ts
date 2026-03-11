/**
 * Draft Order Generator
 *
 * Core business logic: reads inventory + sales history, projects usage,
 * and produces purchase order drafts grouped by supplier.
 *
 * This runs deterministically — no LLM calls. The LLM is used separately
 * for generating natural-language explanations (see agent-orders.ts).
 */

import { db } from "../../db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  ingredients,
  suppliers,
  ingredientSuppliers,
  recipeItems,
  dailySales,
  inventorySnapshots,
  purchaseOrders,
  purchaseOrderLines,
  type PurchaseOrder,
} from "../../../shared/restaurant/schema";

interface OrderLine {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  currentOnHand: number;
  projectedUsage: number;
  parLevel: number;
}

interface DraftOrder {
  supplierId: string;
  supplierName: string;
  targetDeliveryDate: string;
  lines: OrderLine[];
  totalCost: number;
  explanation: string;
}

const FORECAST_HORIZON_DAYS = 3;
const SALES_LOOKBACK_DAYS = 14;

export async function generateDraftOrders(
  restaurantId: string,
  locationId: string,
  targetDate: string
): Promise<PurchaseOrder[]> {
  // 1. Load all ingredients for this restaurant
  const allIngredients = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.restaurantId, restaurantId));

  if (allIngredients.length === 0) return [];

  // 2. Load supplier mappings
  const supplierMappings = await db
    .select({
      ingredientId: ingredientSuppliers.ingredientId,
      supplierId: ingredientSuppliers.supplierId,
      unitCost: ingredientSuppliers.unitCost,
      supplierName: suppliers.name,
      leadTimeDays: suppliers.leadTimeDays,
      deliveryDays: suppliers.deliveryDays,
      minOrderAmount: suppliers.minOrderAmount,
    })
    .from(ingredientSuppliers)
    .innerJoin(suppliers, eq(ingredientSuppliers.supplierId, suppliers.id))
    .where(eq(suppliers.restaurantId, restaurantId));

  // 3. Load recipe items for ingredient usage calculation
  const recipes = await db
    .select()
    .from(recipeItems)
    .where(eq(recipeItems.restaurantId, restaurantId));

  // 4. Load sales history (last 14 days)
  const today = new Date(targetDate);
  const lookbackDate = new Date(today);
  lookbackDate.setDate(lookbackDate.getDate() - SALES_LOOKBACK_DAYS);

  const sales = await db
    .select()
    .from(dailySales)
    .where(
      and(
        eq(dailySales.locationId, locationId),
        gte(dailySales.date, lookbackDate.toISOString().split("T")[0]),
        lte(dailySales.date, targetDate)
      )
    );

  // 5. Calculate average daily ingredient usage from sales + recipes
  const ingredientDailyUsage = calculateIngredientUsage(
    sales,
    recipes,
    SALES_LOOKBACK_DAYS
  );

  // 6. Load latest inventory snapshots (most recent per ingredient)
  const latestSnapshots = await getLatestSnapshots(locationId, allIngredients);

  // 7. Load existing on-order quantities (approved but not yet received)
  const onOrderQty = await getOnOrderQuantities(restaurantId, locationId);

  // 8. Calculate shortfalls and group by supplier
  const draftOrders: DraftOrder[] = [];
  const supplierGroups = new Map<string, OrderLine[]>();

  for (const ingredient of allIngredients) {
    const avgDailyUsage = ingredientDailyUsage.get(ingredient.id) || 0;
    if (avgDailyUsage === 0) continue; // No usage data, skip

    const onHand = latestSnapshots.get(ingredient.id) || 0;
    const onOrder = onOrderQty.get(ingredient.id) || 0;
    const parLevel = Number(ingredient.parLevel);
    const projectedUsage = avgDailyUsage * FORECAST_HORIZON_DAYS;

    // Need = projected usage + par level buffer - on hand - on order
    const need = projectedUsage + parLevel - onHand - onOrder;

    if (need <= 0) continue; // We have enough

    // Find the supplier for this ingredient
    const mapping = supplierMappings.find(
      (m) => m.ingredientId === ingredient.id
    );
    if (!mapping) continue; // No supplier mapped

    const line: OrderLine = {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      quantity: Math.ceil(need * 10) / 10, // Round up to 1 decimal
      unit: ingredient.unit,
      unitCost: Number(mapping.unitCost),
      currentOnHand: onHand,
      projectedUsage,
      parLevel,
    };

    const existing = supplierGroups.get(mapping.supplierId) || [];
    existing.push(line);
    supplierGroups.set(mapping.supplierId, existing);
  }

  // 9. Create purchase orders per supplier
  const createdOrders: PurchaseOrder[] = [];

  for (const [supplierId, lines] of Array.from(supplierGroups)) {
    const mapping = supplierMappings.find((m) => m.supplierId === supplierId);
    if (!mapping) continue;

    const deliveryDate = calculateNextDeliveryDate(
      today,
      Number(mapping.leadTimeDays),
      JSON.parse(mapping.deliveryDays || "[]")
    );

    const totalCost = lines.reduce(
      (sum: number, l: OrderLine) => sum + l.quantity * l.unitCost,
      0
    );

    // Check minimum order amount
    const minOrder = mapping.minOrderAmount
      ? Number(mapping.minOrderAmount)
      : 0;
    if (totalCost < minOrder) {
      // Still create the order but note it in explanation
    }

    // Build explanation
    const explanation = buildExplanation(
      mapping.supplierName,
      lines,
      deliveryDate,
      totalCost,
      minOrder
    );

    // Insert the purchase order
    const [order] = await db
      .insert(purchaseOrders)
      .values({
        restaurantId,
        locationId,
        supplierId,
        targetDeliveryDate: deliveryDate,
        status: "draft",
        explanation,
      })
      .returning();

    // Insert order lines
    for (const line of lines) {
      await db.insert(purchaseOrderLines).values({
        purchaseOrderId: order.id,
        ingredientId: line.ingredientId,
        quantity: String(line.quantity),
        unit: line.unit,
        unitCost: String(line.unitCost),
        notes: `On-hand: ${line.currentOnHand}, projected ${FORECAST_HORIZON_DAYS}-day usage: ${line.projectedUsage.toFixed(1)}`,
      });
    }

    createdOrders.push(order);
  }

  return createdOrders;
}

// ─── Helper Functions ───────────────────────────────────────────────

function calculateIngredientUsage(
  sales: { menuItemName: string; quantitySold: number }[],
  recipes: { menuItemName: string; ingredientId: string; quantityPerServing: string }[],
  lookbackDays: number
): Map<string, number> {
  // Total quantity sold per menu item
  const itemTotals = new Map<string, number>();
  for (const sale of sales) {
    const key = sale.menuItemName.toLowerCase();
    itemTotals.set(key, (itemTotals.get(key) || 0) + sale.quantitySold);
  }

  // Map to ingredient usage
  const ingredientUsage = new Map<string, number>();
  for (const recipe of recipes) {
    const key = recipe.menuItemName.toLowerCase();
    const totalSold = itemTotals.get(key) || 0;
    const usage = totalSold * Number(recipe.quantityPerServing);
    ingredientUsage.set(
      recipe.ingredientId,
      (ingredientUsage.get(recipe.ingredientId) || 0) + usage
    );
  }

  // Convert to daily average
  const dailyUsage = new Map<string, number>();
  for (const [id, total] of Array.from(ingredientUsage)) {
    dailyUsage.set(id, total / lookbackDays);
  }

  return dailyUsage;
}

async function getLatestSnapshots(
  locationId: string,
  allIngredients: { id: string }[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  for (const ingredient of allIngredients) {
    const [latest] = await db
      .select()
      .from(inventorySnapshots)
      .where(
        and(
          eq(inventorySnapshots.locationId, locationId),
          eq(inventorySnapshots.ingredientId, ingredient.id)
        )
      )
      .orderBy(desc(inventorySnapshots.date))
      .limit(1);

    if (latest) {
      result.set(ingredient.id, Number(latest.quantityOnHand));
    }
  }

  return result;
}

async function getOnOrderQuantities(
  restaurantId: string,
  locationId: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  const openOrders = await db
    .select()
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.restaurantId, restaurantId),
        eq(purchaseOrders.locationId, locationId),
        eq(purchaseOrders.status, "approved")
      )
    );

  for (const order of openOrders) {
    const lines = await db
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.purchaseOrderId, order.id));

    for (const line of lines) {
      result.set(
        line.ingredientId,
        (result.get(line.ingredientId) || 0) + Number(line.quantity)
      );
    }
  }

  return result;
}

function calculateNextDeliveryDate(
  fromDate: Date,
  leadTimeDays: number,
  deliveryDays: number[]
): string {
  if (deliveryDays.length === 0) {
    // No delivery day restrictions — deliver after lead time
    const d = new Date(fromDate);
    d.setDate(d.getDate() + leadTimeDays);
    return d.toISOString().split("T")[0];
  }

  // Find the earliest delivery day that is >= (today + lead time)
  const earliest = new Date(fromDate);
  earliest.setDate(earliest.getDate() + leadTimeDays);

  for (let i = 0; i < 7; i++) {
    const candidate = new Date(earliest);
    candidate.setDate(candidate.getDate() + i);
    if (deliveryDays.includes(candidate.getDay())) {
      return candidate.toISOString().split("T")[0];
    }
  }

  // Fallback
  earliest.setDate(earliest.getDate() + leadTimeDays);
  return earliest.toISOString().split("T")[0];
}

function buildExplanation(
  supplierName: string,
  lines: OrderLine[],
  deliveryDate: string,
  totalCost: number,
  minOrderAmount: number
): string {
  const itemSummaries = lines
    .map(
      (l) =>
        `${l.quantity} ${l.unit} of ${l.ingredientName} (on-hand: ${l.currentOnHand}, ` +
        `${FORECAST_HORIZON_DAYS}-day projected usage: ${l.projectedUsage.toFixed(1)})`
    )
    .join("; ");

  let explanation = `Order from ${supplierName} for delivery on ${deliveryDate}. `;
  explanation += `Items: ${itemSummaries}. `;
  explanation += `Estimated total: $${totalCost.toFixed(2)}.`;

  if (minOrderAmount > 0 && totalCost < minOrderAmount) {
    explanation += ` ⚠️ This order ($${totalCost.toFixed(2)}) is below the minimum order of $${minOrderAmount.toFixed(2)}. Consider adding items or combining with another order.`;
  }

  return explanation;
}
