/**
 * Agent-Enhanced Order Generation
 *
 * Uses Claude with tool-calling to produce purchase order drafts
 * with rich, chef-readable explanations and image-based inventory analysis.
 *
 * This is the "agent mode" alternative to the deterministic draft-orders.ts.
 * It calls the same underlying data functions but lets the LLM reason about
 * the ordering decision and write human-friendly explanations.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "../../db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  ingredients,
  suppliers,
  ingredientSuppliers,
  recipeItems,
  dailySales,
  inventorySnapshots,
  purchaseOrders,
  purchaseOrderLines,
  locations,
} from "../../../shared/restaurant/schema";

const anthropic = new Anthropic();

// Tool definitions for the agent
const tools: Anthropic.Tool[] = [
  {
    name: "get_current_inventory",
    description:
      "Get the current on-hand inventory for a restaurant location, including quantities, sources (manual/image/calculated), and confidence levels.",
    input_schema: {
      type: "object" as const,
      properties: {
        restaurant_id: { type: "string", description: "Restaurant UUID" },
        location_id: { type: "string", description: "Location UUID" },
      },
      required: ["restaurant_id", "location_id"],
    },
  },
  {
    name: "get_sales_history",
    description:
      "Get daily ingredient usage calculated from POS sales data and recipe mappings over a date range.",
    input_schema: {
      type: "object" as const,
      properties: {
        restaurant_id: { type: "string" },
        location_id: { type: "string" },
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["restaurant_id", "location_id", "start_date", "end_date"],
    },
  },
  {
    name: "get_supplier_constraints",
    description:
      "Get all suppliers for a restaurant with their lead times, delivery days, minimum order amounts, and which ingredients they supply.",
    input_schema: {
      type: "object" as const,
      properties: {
        restaurant_id: { type: "string" },
      },
      required: ["restaurant_id"],
    },
  },
  {
    name: "save_purchase_order_draft",
    description: "Save one or more draft purchase orders to the database.",
    input_schema: {
      type: "object" as const,
      properties: {
        restaurant_id: { type: "string" },
        location_id: { type: "string" },
        orders: {
          type: "array",
          items: {
            type: "object",
            properties: {
              supplier_id: { type: "string" },
              target_delivery_date: { type: "string" },
              explanation: { type: "string" },
              lines: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    ingredient_id: { type: "string" },
                    quantity: { type: "number" },
                    unit: { type: "string" },
                    unit_cost: { type: "number" },
                    notes: { type: "string" },
                  },
                  required: ["ingredient_id", "quantity", "unit", "unit_cost"],
                },
              },
            },
            required: [
              "supplier_id",
              "target_delivery_date",
              "explanation",
              "lines",
            ],
          },
        },
      },
      required: ["restaurant_id", "location_id", "orders"],
    },
  },
];

// Tool execution handlers
async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "get_current_inventory":
      return handleGetCurrentInventory(
        input.restaurant_id as string,
        input.location_id as string
      );
    case "get_sales_history":
      return handleGetSalesHistory(
        input.restaurant_id as string,
        input.location_id as string,
        input.start_date as string,
        input.end_date as string
      );
    case "get_supplier_constraints":
      return handleGetSupplierConstraints(input.restaurant_id as string);
    case "save_purchase_order_draft":
      return handleSaveDraftOrders(
        input.restaurant_id as string,
        input.location_id as string,
        input.orders as Array<Record<string, unknown>>
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleGetCurrentInventory(
  restaurantId: string,
  locationId: string
) {
  const allIngredients = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.restaurantId, restaurantId));

  const inventory = [];
  for (const ing of allIngredients) {
    const [latest] = await db
      .select()
      .from(inventorySnapshots)
      .where(
        and(
          eq(inventorySnapshots.locationId, locationId),
          eq(inventorySnapshots.ingredientId, ing.id)
        )
      )
      .orderBy(desc(inventorySnapshots.date))
      .limit(1);

    // Check for approved orders not yet received
    const onOrderLines = await db
      .select({ quantity: purchaseOrderLines.quantity })
      .from(purchaseOrderLines)
      .innerJoin(
        purchaseOrders,
        eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id)
      )
      .where(
        and(
          eq(purchaseOrderLines.ingredientId, ing.id),
          eq(purchaseOrders.status, "approved"),
          eq(purchaseOrders.locationId, locationId)
        )
      );

    const onOrder = onOrderLines.reduce(
      (sum, l) => sum + Number(l.quantity),
      0
    );

    inventory.push({
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      category: ing.category,
      unit: ing.unit,
      par_level: Number(ing.parLevel),
      on_hand: latest ? Number(latest.quantityOnHand) : 0,
      on_hand_source: latest?.source || "unknown",
      on_hand_confidence: latest?.confidence
        ? Number(latest.confidence)
        : null,
      on_order: onOrder,
    });
  }

  return { inventory };
}

async function handleGetSalesHistory(
  restaurantId: string,
  locationId: string,
  startDate: string,
  endDate: string
) {
  const recipes = await db
    .select()
    .from(recipeItems)
    .where(eq(recipeItems.restaurantId, restaurantId));

  const sales = await db
    .select()
    .from(dailySales)
    .where(
      and(
        eq(dailySales.locationId, locationId),
        gte(dailySales.date, startDate),
        lte(dailySales.date, endDate)
      )
    );

  // Calculate daily ingredient usage
  const dailyIngredientUsage: Array<{
    date: string;
    day_of_week: string;
    ingredient_id: string;
    ingredient_name: string;
    estimated_usage: number;
    unit: string;
  }> = [];

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Group sales by date
  const salesByDate = new Map<string, typeof sales>();
  for (const sale of sales) {
    const existing = salesByDate.get(sale.date) || [];
    existing.push(sale);
    salesByDate.set(sale.date, existing);
  }

  // Load ingredient names
  const allIngredients = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.restaurantId, restaurantId));
  const ingMap = new Map(allIngredients.map((i) => [i.id, i]));

  for (const [date, daySales] of Array.from(salesByDate)) {
    const dow = dayNames[new Date(date + "T00:00:00").getDay()];
    const usageMap = new Map<string, number>();

    for (const sale of daySales) {
      const matchingRecipes = recipes.filter(
        (r) => r.menuItemName.toLowerCase() === sale.menuItemName.toLowerCase()
      );
      for (const recipe of matchingRecipes) {
        const usage =
          sale.quantitySold * Number(recipe.quantityPerServing);
        usageMap.set(
          recipe.ingredientId,
          (usageMap.get(recipe.ingredientId) || 0) + usage
        );
      }
    }

    for (const [ingredientId, usage] of Array.from(usageMap)) {
      const ing = ingMap.get(ingredientId);
      dailyIngredientUsage.push({
        date,
        day_of_week: dow,
        ingredient_id: ingredientId,
        ingredient_name: ing?.name || "Unknown",
        estimated_usage: Math.round(usage * 100) / 100,
        unit: ing?.unit || "",
      });
    }
  }

  return { daily_ingredient_usage: dailyIngredientUsage };
}

async function handleGetSupplierConstraints(restaurantId: string) {
  const allSuppliers = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.restaurantId, restaurantId));

  const result = [];
  for (const supplier of allSuppliers) {
    const mappings = await db
      .select({
        ingredientId: ingredientSuppliers.ingredientId,
        unitCost: ingredientSuppliers.unitCost,
        supplierSku: ingredientSuppliers.supplierSku,
      })
      .from(ingredientSuppliers)
      .where(eq(ingredientSuppliers.supplierId, supplier.id));

    const ingIds = mappings.map((m) => m.ingredientId);
    const ings = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.restaurantId, restaurantId));

    result.push({
      supplier_id: supplier.id,
      name: supplier.name,
      lead_time_days: supplier.leadTimeDays,
      delivery_days: JSON.parse(supplier.deliveryDays || "[]"),
      min_order_amount: supplier.minOrderAmount
        ? Number(supplier.minOrderAmount)
        : null,
      ingredients: mappings.map((m) => {
        const ing = ings.find((i) => i.id === m.ingredientId);
        return {
          ingredient_id: m.ingredientId,
          ingredient_name: ing?.name || "Unknown",
          unit_cost: Number(m.unitCost),
          supplier_sku: m.supplierSku,
        };
      }),
    });
  }

  return { suppliers: result };
}

async function handleSaveDraftOrders(
  restaurantId: string,
  locationId: string,
  orders: Array<Record<string, unknown>>
) {
  const createdIds: string[] = [];
  const errors: string[] = [];

  for (const order of orders) {
    try {
      const [po] = await db
        .insert(purchaseOrders)
        .values({
          restaurantId,
          locationId,
          supplierId: order.supplier_id as string,
          targetDeliveryDate: order.target_delivery_date as string,
          status: "draft",
          explanation: order.explanation as string,
        })
        .returning();

      const lines = order.lines as Array<Record<string, unknown>>;
      for (const line of lines) {
        await db.insert(purchaseOrderLines).values({
          purchaseOrderId: po.id,
          ingredientId: line.ingredient_id as string,
          quantity: String(line.quantity),
          unit: line.unit as string,
          unitCost: String(line.unit_cost),
          notes: (line.notes as string) || null,
        });
      }

      createdIds.push(po.id);
    } catch (err) {
      errors.push(
        `Failed to create order for supplier ${order.supplier_id}: ${err}`
      );
    }
  }

  return {
    created_order_ids: createdIds,
    status: errors.length === 0 ? "success" : "partial_failure",
    errors,
  };
}

// ─── Main agent entry point ─────────────────────────────────────────

export async function runOrderAgent(
  restaurantId: string,
  locationId: string,
  targetDate: string
): Promise<{ orders: string[]; explanation: string }> {
  const systemPrompt = `You are a restaurant purchasing assistant. Your job is to analyze inventory levels, recent sales trends, and supplier constraints to generate smart purchase order drafts.

You have access to tools to fetch inventory, sales history, and supplier data. Use them to make informed ordering decisions.

Guidelines:
- Always check current inventory first, then review sales history for the last 14 days.
- Pay attention to day-of-week patterns (weekends are typically busier).
- Factor in supplier lead times and delivery day restrictions.
- Respect minimum order amounts — flag if an order falls below the minimum.
- For items where inventory was estimated from photos (source="image"), note the confidence level. If confidence < 0.6, mention this uncertainty in your explanation.
- Write explanations as if talking to a busy chef: clear, concise, practical.
- When saving orders, include a brief explanation per supplier that references the data you used.

Today's date: ${targetDate}
Restaurant ID: ${restaurantId}
Location ID: ${locationId}`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Generate today's draft purchase orders. Check inventory, review the last 14 days of sales, get supplier info, then create orders for anything we need. Today is ${targetDate}.`,
    },
  ];

  let allOrderIds: string[] = [];
  let finalExplanation = "";

  // Agentic loop: run until the model stops calling tools
  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    // Collect any text blocks as the final explanation
    for (const block of response.content) {
      if (block.type === "text") {
        finalExplanation += block.text;
      }
    }

    // If the model stopped naturally, we're done
    if (response.stop_reason === "end_turn") break;

    // Process tool calls
    const toolUseBlocks = response.content.filter(
      (b) => b.type === "tool_use"
    );
    if (toolUseBlocks.length === 0) break;

    // Add assistant message with all content
    messages.push({ role: "assistant", content: response.content });

    // Execute each tool and add results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      if (block.type !== "tool_use") continue;
      try {
        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>
        );

        // Track order IDs from save operations
        if (block.name === "save_purchase_order_draft") {
          const saveResult = result as {
            created_order_ids: string[];
          };
          allOrderIds.push(...saveResult.created_order_ids);
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  return { orders: allOrderIds, explanation: finalExplanation };
}
