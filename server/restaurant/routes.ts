import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  restaurants,
  locations,
  ingredients,
  suppliers,
  ingredientSuppliers,
  recipeItems,
  dailySales,
  inventorySnapshots,
  inventoryImages,
  purchaseOrders,
  purchaseOrderLines,
  insertRestaurantSchema,
  insertLocationSchema,
  insertIngredientSchema,
  insertSupplierSchema,
  insertIngredientSupplierSchema,
  insertRecipeItemSchema,
  insertInventorySnapshotSchema,
} from "../../shared/restaurant/schema";
import { parsePosCSV } from "./services/pos-parser";
import { generateDraftOrders } from "./services/draft-orders";
import { processInventoryImage } from "./services/image-processor";

const router = Router();

// ─── File upload config ─────────────────────────────────────────────

const uploadsDir = path.join(process.cwd(), "uploads", "inventory");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

// ─── Restaurant CRUD ────────────────────────────────────────────────

router.post("/restaurants", async (req: Request, res: Response) => {
  const parsed = insertRestaurantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [row] = await db.insert(restaurants).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/restaurants/:id", async (req: Request, res: Response) => {
  const [row] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, req.params.id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

// ─── Location CRUD ──────────────────────────────────────────────────

router.post("/locations", async (req: Request, res: Response) => {
  const parsed = insertLocationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [row] = await db.insert(locations).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get(
  "/restaurants/:restaurantId/locations",
  async (req: Request, res: Response) => {
    const rows = await db
      .select()
      .from(locations)
      .where(eq(locations.restaurantId, req.params.restaurantId));
    res.json(rows);
  }
);

// ─── Ingredient CRUD ────────────────────────────────────────────────

router.post("/ingredients", async (req: Request, res: Response) => {
  const parsed = insertIngredientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [row] = await db.insert(ingredients).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get(
  "/restaurants/:restaurantId/ingredients",
  async (req: Request, res: Response) => {
    const rows = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.restaurantId, req.params.restaurantId));
    res.json(rows);
  }
);

router.put("/ingredients/:id", async (req: Request, res: Response) => {
  const { name, unit, parLevel, category } = req.body;
  const [row] = await db
    .update(ingredients)
    .set({ name, unit, parLevel, category })
    .where(eq(ingredients.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.delete("/ingredients/:id", async (req: Request, res: Response) => {
  await db.delete(ingredients).where(eq(ingredients.id, req.params.id));
  res.status(204).end();
});

// ─── Supplier CRUD ──────────────────────────────────────────────────

router.post("/suppliers", async (req: Request, res: Response) => {
  const parsed = insertSupplierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [row] = await db.insert(suppliers).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get(
  "/restaurants/:restaurantId/suppliers",
  async (req: Request, res: Response) => {
    const rows = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.restaurantId, req.params.restaurantId));
    res.json(rows);
  }
);

router.put("/suppliers/:id", async (req: Request, res: Response) => {
  const { name, leadTimeDays, deliveryDays, minOrderAmount, email } = req.body;
  const [row] = await db
    .update(suppliers)
    .set({ name, leadTimeDays, deliveryDays, minOrderAmount, email })
    .where(eq(suppliers.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

// ─── Ingredient ↔ Supplier mapping ─────────────────────────────────

router.post("/ingredient-suppliers", async (req: Request, res: Response) => {
  const parsed = insertIngredientSupplierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [row] = await db
    .insert(ingredientSuppliers)
    .values(parsed.data)
    .returning();
  res.status(201).json(row);
});

// ─── Recipe items (menu item → ingredient) ──────────────────────────

router.post("/recipe-items", async (req: Request, res: Response) => {
  const parsed = insertRecipeItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [row] = await db.insert(recipeItems).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get(
  "/restaurants/:restaurantId/recipe-items",
  async (req: Request, res: Response) => {
    const rows = await db
      .select()
      .from(recipeItems)
      .where(eq(recipeItems.restaurantId, req.params.restaurantId));
    res.json(rows);
  }
);

// ─── Inventory Snapshots ────────────────────────────────────────────

router.post("/inventory-snapshots", async (req: Request, res: Response) => {
  const parsed = insertInventorySnapshotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [row] = await db
    .insert(inventorySnapshots)
    .values(parsed.data)
    .returning();
  res.status(201).json(row);
});

// ─── POS CSV Upload ─────────────────────────────────────────────────

const csvUpload = multer({ storage: multer.memoryStorage() });

router.post(
  "/locations/:locationId/pos-upload",
  csvUpload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const locationId = req.params.locationId;
    const csvText = req.file.buffer.toString("utf-8");

    try {
      const salesRows = parsePosCSV(csvText, locationId);

      if (salesRows.length === 0) {
        return res.status(400).json({ error: "No valid rows found in CSV" });
      }

      await db.insert(dailySales).values(salesRows);

      res.json({
        message: `Imported ${salesRows.length} sales records`,
        count: salesRows.length,
        dateRange: {
          from: salesRows[0].date,
          to: salesRows[salesRows.length - 1].date,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "CSV parse error";
      res.status(400).json({ error: message });
    }
  }
);

// ─── Inventory Image Upload ─────────────────────────────────────────

router.post(
  "/locations/:locationId/inventory-images",
  upload.array("images", 5),
  async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }

    const locationId = req.params.locationId;
    const { restaurantId, hint } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ error: "restaurant_id is required" });
    }

    const imageRecords = await Promise.all(
      files.map(async (file) => {
        const [row] = await db
          .insert(inventoryImages)
          .values({
            restaurantId,
            locationId,
            filePath: file.path,
            hint: hint || null,
            status: "pending",
          })
          .returning();
        return row;
      })
    );

    res.status(201).json({
      message: `Uploaded ${imageRecords.length} image(s) for processing`,
      images: imageRecords,
    });
  }
);

// ─── Process pending inventory images (called by worker or manually) ─

router.post(
  "/inventory-images/:imageId/process",
  async (req: Request, res: Response) => {
    const { imageId } = req.params;

    const [image] = await db
      .select()
      .from(inventoryImages)
      .where(eq(inventoryImages.id, imageId));

    if (!image) return res.status(404).json({ error: "Image not found" });
    if (image.status === "completed") {
      return res.json({ message: "Already processed", imageId });
    }

    try {
      const result = await processInventoryImage(image);
      res.json({ message: "Image processed", imageId, items: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Processing failed";
      res.status(500).json({ error: message });
    }
  }
);

// ─── Generate Draft Orders ──────────────────────────────────────────

router.post(
  "/restaurants/:restaurantId/locations/:locationId/generate-orders",
  async (req: Request, res: Response) => {
    const { restaurantId, locationId } = req.params;
    const targetDate =
      (req.body.targetDate as string) ||
      new Date().toISOString().split("T")[0];

    try {
      const orders = await generateDraftOrders(
        restaurantId,
        locationId,
        targetDate
      );
      res.json({
        message: `Generated ${orders.length} draft order(s)`,
        orders,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Order generation failed";
      res.status(500).json({ error: message });
    }
  }
);

// ─── Fetch Draft Orders ─────────────────────────────────────────────

router.get(
  "/restaurants/:restaurantId/locations/:locationId/orders",
  async (req: Request, res: Response) => {
    const { restaurantId, locationId } = req.params;
    const status = (req.query.status as string) || "draft";

    const orders = await db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.restaurantId, restaurantId),
          eq(purchaseOrders.locationId, locationId),
          eq(purchaseOrders.status, status)
        )
      )
      .orderBy(desc(purchaseOrders.createdAt));

    // Attach lines to each order
    const ordersWithLines = await Promise.all(
      orders.map(async (order) => {
        const lines = await db
          .select()
          .from(purchaseOrderLines)
          .where(eq(purchaseOrderLines.purchaseOrderId, order.id));
        return { ...order, lines };
      })
    );

    res.json(ordersWithLines);
  }
);

// ─── Approve / Update Order Status ──────────────────────────────────

router.patch(
  "/orders/:orderId/status",
  async (req: Request, res: Response) => {
    const { status } = req.body;
    const validStatuses = ["draft", "approved", "sent", "received"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(", ")}` });
    }

    const updates: Record<string, unknown> = { status };
    if (status === "approved") {
      updates.approvedAt = new Date();
    }

    const [row] = await db
      .update(purchaseOrders)
      .set(updates)
      .where(eq(purchaseOrders.id, req.params.orderId))
      .returning();

    if (!row) return res.status(404).json({ error: "Order not found" });
    res.json(row);
  }
);

export default router;
