/**
 * Inventory Image Processor
 *
 * Sends an inventory image to Claude's vision API to detect ingredients
 * and estimate quantities, then saves the results.
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import {
  inventoryImages,
  inventoryImageItems,
  inventorySnapshots,
  ingredients,
  type InventoryImage,
} from "../../../shared/restaurant/schema";

const anthropic = new Anthropic();

interface DetectedItem {
  ingredient_id: string | null;
  raw_label: string;
  estimated_quantity: number;
  unit: string;
  confidence: number;
  notes: string | null;
}

interface ImageAnalysisResult {
  items: DetectedItem[];
  image_notes: string;
}

export async function processInventoryImage(
  image: InventoryImage
): Promise<DetectedItem[]> {
  // Mark as processing
  await db
    .update(inventoryImages)
    .set({ status: "processing" })
    .where(eq(inventoryImages.id, image.id));

  try {
    // Load known ingredients for this restaurant
    const knownIngredients = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.restaurantId, image.restaurantId));

    // Read the image file
    const imageBuffer = fs.readFileSync(image.filePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType = getMimeType(image.filePath);

    // Build the prompt
    const ingredientList = knownIngredients
      .map((i) => `- ${i.name} (id: ${i.id}, unit: ${i.unit}, category: ${i.category})`)
      .join("\n");

    const hintText = image.hint
      ? `\nThe user indicated this image is of: "${image.hint}".`
      : "";

    const prompt = `You are analyzing a photo of restaurant inventory. Identify food ingredients and estimate quantities.
${hintText}

Known ingredients for this restaurant:
${ingredientList}

For each item you can identify in the image:
1. Try to match it to a known ingredient (use the ingredient_id). If no match, set ingredient_id to null.
2. Describe what you see in raw_label.
3. Estimate the quantity and unit.
4. Set confidence from 0.0 to 1.0 (be conservative — partial visibility, unclear packaging, or guessed counts should lower confidence).
5. Add any relevant notes.

If this is a screenshot of a spreadsheet or inventory app, read the text/numbers and map them to known ingredients.

Respond with JSON only, matching this schema:
{
  "items": [
    {
      "ingredient_id": "uuid-or-null",
      "raw_label": "what you see",
      "estimated_quantity": 10,
      "unit": "lbs",
      "confidence": 0.7,
      "notes": "optional note"
    }
  ],
  "image_notes": "General notes about image quality or visibility"
}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/webp"
                  | "image/gif",
                data: base64Image,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    // Extract text response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from image analysis");
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const result: ImageAnalysisResult = JSON.parse(jsonStr);

    // Save detected items
    for (const item of result.items) {
      await db.insert(inventoryImageItems).values({
        imageId: image.id,
        ingredientId: item.ingredient_id,
        rawLabel: item.raw_label,
        estimatedQuantity: String(item.estimated_quantity),
        unit: item.unit,
        confidence: String(item.confidence),
        notes: item.notes,
      });

      // If matched to a known ingredient, create/update an inventory snapshot
      if (item.ingredient_id) {
        const today = new Date().toISOString().split("T")[0];
        await db.insert(inventorySnapshots).values({
          locationId: image.locationId,
          ingredientId: item.ingredient_id,
          date: today,
          quantityOnHand: String(item.estimated_quantity),
          source: "image",
          confidence: String(item.confidence),
        });
      }
    }

    // Mark as completed
    await db
      .update(inventoryImages)
      .set({ status: "completed", processedAt: new Date() })
      .where(eq(inventoryImages.id, image.id));

    return result.items;
  } catch (err) {
    await db
      .update(inventoryImages)
      .set({ status: "failed" })
      .where(eq(inventoryImages.id, image.id));
    throw err;
  }
}

function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return mimeMap[ext || ""] || "image/jpeg";
}
