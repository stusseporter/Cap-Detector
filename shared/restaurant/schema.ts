import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  numeric,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Restaurant & Location ──────────────────────────────────────────

export const restaurants = pgTable("restaurants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/Chicago"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  name: text("name").notNull(),
});

// ─── Ingredients ────────────────────────────────────────────────────

export const ingredients = pgTable("ingredients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // "lbs", "each", "cases"
  parLevel: numeric("par_level").notNull(),
  category: text("category").notNull().default("other"), // protein, dairy, produce, dry, other
});

// ─── Suppliers ──────────────────────────────────────────────────────

export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  name: text("name").notNull(),
  leadTimeDays: integer("lead_time_days").notNull().default(1),
  deliveryDays: text("delivery_days").notNull().default("[]"), // JSON array of ints [1,3,5]
  minOrderAmount: numeric("min_order_amount"), // nullable, in dollars
  email: text("email"),
});

// ─── Ingredient ↔ Supplier mapping ─────────────────────────────────

export const ingredientSuppliers = pgTable("ingredient_suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ingredientId: varchar("ingredient_id")
    .notNull()
    .references(() => ingredients.id),
  supplierId: varchar("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  unitCost: numeric("unit_cost").notNull(),
  supplierSku: text("supplier_sku"),
});

// ─── Recipe mapping (menu item → ingredient) ───────────────────────

export const recipeItems = pgTable("recipe_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  menuItemName: text("menu_item_name").notNull(),
  ingredientId: varchar("ingredient_id")
    .notNull()
    .references(() => ingredients.id),
  quantityPerServing: numeric("quantity_per_serving").notNull(),
});

// ─── Daily Sales (from POS CSV) ────────────────────────────────────

export const dailySales = pgTable("daily_sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  locationId: varchar("location_id")
    .notNull()
    .references(() => locations.id),
  date: date("date").notNull(),
  menuItemName: text("menu_item_name").notNull(),
  quantitySold: integer("quantity_sold").notNull(),
});

// ─── Inventory Snapshots ────────────────────────────────────────────

export const inventorySnapshots = pgTable("inventory_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  locationId: varchar("location_id")
    .notNull()
    .references(() => locations.id),
  ingredientId: varchar("ingredient_id")
    .notNull()
    .references(() => ingredients.id),
  date: date("date").notNull(),
  quantityOnHand: numeric("quantity_on_hand").notNull(),
  source: text("source").notNull().default("manual"), // "manual", "image", "calculated"
  confidence: numeric("confidence"), // 0.0–1.0, null for manual
});

// ─── Inventory Images ───────────────────────────────────────────────

export const inventoryImages = pgTable("inventory_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  locationId: varchar("location_id")
    .notNull()
    .references(() => locations.id),
  filePath: text("file_path").notNull(),
  hint: text("hint"), // e.g., "dairy shelf"
  capturedAt: timestamp("captured_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  processedAt: timestamp("processed_at"),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
});

export const inventoryImageItems = pgTable("inventory_image_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageId: varchar("image_id")
    .notNull()
    .references(() => inventoryImages.id, { onDelete: "cascade" }),
  ingredientId: varchar("ingredient_id").references(() => ingredients.id), // nullable
  rawLabel: text("raw_label").notNull(),
  estimatedQuantity: numeric("estimated_quantity").notNull(),
  unit: text("unit").notNull(),
  confidence: numeric("confidence").notNull(),
  notes: text("notes"),
});

// ─── Purchase Orders ────────────────────────────────────────────────

export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  locationId: varchar("location_id")
    .notNull()
    .references(() => locations.id),
  supplierId: varchar("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  targetDeliveryDate: date("target_delivery_date").notNull(),
  status: text("status").notNull().default("draft"), // draft, approved, sent, received
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  approvedAt: timestamp("approved_at"),
});

export const purchaseOrderLines = pgTable("purchase_order_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  ingredientId: varchar("ingredient_id")
    .notNull()
    .references(() => ingredients.id),
  quantity: numeric("quantity").notNull(),
  unit: text("unit").notNull(),
  unitCost: numeric("unit_cost").notNull(),
  notes: text("notes"),
});

// ─── Zod schemas for inserts ────────────────────────────────────────

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
  createdAt: true,
});
export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
});
export const insertIngredientSchema = createInsertSchema(ingredients).omit({
  id: true,
});
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
});
export const insertIngredientSupplierSchema = createInsertSchema(
  ingredientSuppliers
).omit({ id: true });
export const insertRecipeItemSchema = createInsertSchema(recipeItems).omit({
  id: true,
});
export const insertInventorySnapshotSchema = createInsertSchema(
  inventorySnapshots
).omit({ id: true });
export const insertInventoryImageSchema = createInsertSchema(
  inventoryImages
).omit({ id: true, capturedAt: true, processedAt: true });
export const insertPurchaseOrderSchema = createInsertSchema(
  purchaseOrders
).omit({ id: true, createdAt: true, approvedAt: true });

// ─── Inferred types ─────────────────────────────────────────────────

export type Restaurant = typeof restaurants.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type IngredientSupplier = typeof ingredientSuppliers.$inferSelect;
export type RecipeItem = typeof recipeItems.$inferSelect;
export type DailySale = typeof dailySales.$inferSelect;
export type InventorySnapshot = typeof inventorySnapshots.$inferSelect;
export type InventoryImage = typeof inventoryImages.$inferSelect;
export type InventoryImageItem = typeof inventoryImageItems.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderLine = typeof purchaseOrderLines.$inferSelect;
