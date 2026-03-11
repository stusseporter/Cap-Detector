/**
 * Scheduler
 *
 * Simple cron-style scheduler that:
 * 1. Processes pending inventory images (every 5 minutes).
 * 2. Generates draft purchase orders every morning at 5 AM (restaurant local time).
 *
 * Uses setInterval for simplicity. In production, replace with a proper
 * job queue (BullMQ, pg-boss, etc.).
 */

import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import {
  inventoryImages,
  restaurants,
  locations,
} from "../../../shared/restaurant/schema";
import { processInventoryImage } from "./image-processor";
import { generateDraftOrders } from "./draft-orders";

const IMAGE_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ORDER_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute if it's 5 AM

// Track which restaurants already had orders generated today
const ordersGeneratedToday = new Set<string>();

export function startScheduler() {
  console.log("[scheduler] Starting background workers");

  // ─── Image processing worker ──────────────────────────────────
  setInterval(async () => {
    try {
      const pendingImages = await db
        .select()
        .from(inventoryImages)
        .where(eq(inventoryImages.status, "pending"))
        .limit(5);

      for (const image of pendingImages) {
        console.log(`[scheduler] Processing image ${image.id}`);
        try {
          await processInventoryImage(image);
          console.log(`[scheduler] Image ${image.id} processed successfully`);
        } catch (err) {
          console.error(`[scheduler] Image ${image.id} failed:`, err);
        }
      }
    } catch (err) {
      console.error("[scheduler] Image polling error:", err);
    }
  }, IMAGE_POLL_INTERVAL_MS);

  // ─── Daily order generation worker ────────────────────────────
  setInterval(async () => {
    try {
      const allRestaurants = await db.select().from(restaurants);

      for (const restaurant of allRestaurants) {
        const tz = restaurant.timezone || "America/Chicago";
        const now = new Date();

        // Get current hour in the restaurant's timezone
        const localHour = getHourInTimezone(now, tz);
        const todayKey = `${restaurant.id}-${now.toISOString().split("T")[0]}`;

        // Run at 5 AM local time, only once per day per restaurant
        if (localHour === 5 && !ordersGeneratedToday.has(todayKey)) {
          ordersGeneratedToday.add(todayKey);
          console.log(
            `[scheduler] Generating draft orders for restaurant ${restaurant.name}`
          );

          const restaurantLocations = await db
            .select()
            .from(locations)
            .where(eq(locations.restaurantId, restaurant.id));

          for (const location of restaurantLocations) {
            try {
              const today = now.toISOString().split("T")[0];
              const orders = await generateDraftOrders(
                restaurant.id,
                location.id,
                today
              );
              console.log(
                `[scheduler] Generated ${orders.length} orders for ${location.name}`
              );
            } catch (err) {
              console.error(
                `[scheduler] Order generation failed for ${location.name}:`,
                err
              );
            }
          }
        }

        // Reset the tracker at midnight
        if (localHour === 0) {
          const yesterdayKey = `${restaurant.id}-${getYesterday(now)}`;
          ordersGeneratedToday.delete(yesterdayKey);
        }
      }
    } catch (err) {
      console.error("[scheduler] Order generation polling error:", err);
    }
  }, ORDER_CHECK_INTERVAL_MS);
}

function getHourInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(date), 10);
}

function getYesterday(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
