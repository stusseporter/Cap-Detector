# PHASE 1 – MVP Product Specification

## Overview

**Product**: Restaurant Ops AI Agent — helps chefs forecast ingredient usage, track inventory via photos, and generate draft supplier orders.

**Target users**: Independent restaurants and small groups (3–20 locations).

**Timeline**: 2–3 weeks, 1–2 developers.

**Stack**: Node/TypeScript, Express, Postgres (Drizzle ORM), React frontend, Claude API for agent reasoning + vision.

---

## Core User Stories

### 1. Restaurant Setup (one-time)
- Manager creates a restaurant and 1+ locations.
- Manager adds ingredients with par levels (e.g., "Salmon filet, par = 20 lbs").
- Manager adds suppliers with lead times, delivery days, and min order amounts.
- Manager maps ingredients → suppliers (which supplier provides what).

### 2. POS Data Upload
- Chef or manager uploads a CSV export from Toast/Square for a given date.
- System parses CSV, maps menu items → ingredients via a configurable recipe matrix.
- System updates daily usage estimates per ingredient.

### 3. Inventory Photo Upload
- Chef opens app, taps "Snap Inventory", takes 1–5 photos of walk-in, shelves, dry storage.
- System sends each image to the AI agent for analysis.
- Agent returns estimated quantities per detected ingredient (with confidence scores).
- System shows results; chef confirms or adjusts quantities.
- **Limitation**: Counts are approximate. High-value items (proteins, specialty items) always require chef confirmation before orders are placed.

### 4. Daily Draft Order Generation
- Every morning at 5:00 AM local time, a batch job runs:
  1. Pulls latest inventory snapshot (manual counts + image-based estimates).
  2. Pulls last 14 days of POS sales data.
  3. Projects usage for the next `supplier.lead_time + 1` days.
  4. Compares projected need vs. on-hand vs. already on-order.
  5. Groups shortfalls by supplier, respects min-order and delivery-day constraints.
  6. Generates a draft purchase order per supplier with a natural-language explanation.
- Chef opens app, sees draft orders, reads explanations like:
  > "Based on last 3 Fridays (avg 45 salmon dishes), your current 12 lbs on hand, and Saturday delivery, I recommend ordering 40 lbs from Pacific Seafood."
- Chef approves, edits, or dismisses each draft.

### 5. Order Approval
- Chef taps "Approve" on a draft order → status moves to `approved`.
- (v1: no auto-send to supplier. Chef copies the order or emails it manually.)

---

## Data Model

### `restaurant`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | TEXT | |
| timezone | TEXT | e.g., "America/Chicago" |
| created_at | TIMESTAMP | |

### `location`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| name | TEXT | e.g., "Downtown", "Kitchen 2" |

### `user`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| username | TEXT (UNIQUE) | |
| password | TEXT | hashed |
| role | TEXT | "chef" or "manager" |

### `ingredient`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| name | TEXT | e.g., "Salmon filet" |
| unit | TEXT | "lbs", "each", "cases" |
| par_level | NUMERIC | target minimum on-hand |
| category | TEXT | "protein", "dairy", "produce", "dry", "other" |

### `supplier`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| name | TEXT | |
| lead_time_days | INT | |
| delivery_days | INT[] | 0=Sun..6=Sat |
| min_order_amount | NUMERIC | in dollars, nullable |
| email | TEXT | nullable |

### `ingredient_supplier` (join table)
| Column | Type | Notes |
|--------|------|-------|
| ingredient_id | UUID (FK) | |
| supplier_id | UUID (FK) | |
| unit_cost | NUMERIC | price per ingredient.unit |
| supplier_sku | TEXT | nullable |

### `recipe_item` (menu item → ingredient mapping)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| menu_item_name | TEXT | as it appears in POS CSV |
| ingredient_id | UUID (FK) | |
| quantity_per_serving | NUMERIC | e.g., 0.5 lbs salmon per dish |

### `daily_sales`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| location_id | UUID (FK) | |
| date | DATE | |
| menu_item_name | TEXT | |
| quantity_sold | INT | |

### `inventory_snapshot`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| location_id | UUID (FK) | |
| ingredient_id | UUID (FK) | |
| date | DATE | |
| quantity_on_hand | NUMERIC | |
| source | TEXT | "manual", "image", "calculated" |
| confidence | NUMERIC | 0.0–1.0, null for manual |

### `inventory_image`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| location_id | UUID (FK) | |
| file_path | TEXT | S3 key or local path |
| hint | TEXT | nullable, e.g., "dairy shelf" |
| captured_at | TIMESTAMP | |
| processed_at | TIMESTAMP | nullable |
| status | TEXT | "pending", "processing", "completed", "failed" |

### `inventory_image_item`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| image_id | UUID (FK) | |
| ingredient_id | UUID (FK) | nullable (if unmatched) |
| raw_label | TEXT | what the AI saw, e.g., "salmon portions" |
| estimated_quantity | NUMERIC | |
| unit | TEXT | |
| confidence | NUMERIC | 0.0–1.0 |
| notes | TEXT | nullable |

### `purchase_order`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| restaurant_id | UUID (FK) | |
| location_id | UUID (FK) | |
| supplier_id | UUID (FK) | |
| target_delivery_date | DATE | |
| status | TEXT | "draft", "approved", "sent", "received" |
| explanation | TEXT | natural-language reasoning |
| created_at | TIMESTAMP | |
| approved_at | TIMESTAMP | nullable |

### `purchase_order_line`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| purchase_order_id | UUID (FK) | |
| ingredient_id | UUID (FK) | |
| quantity | NUMERIC | |
| unit | TEXT | |
| unit_cost | NUMERIC | |
| notes | TEXT | nullable |

---

## Assumptions & Limitations (v1)

1. **Image accuracy is approximate.** The system clearly labels image-derived quantities as estimates. Chefs must confirm before high-value orders go out.
2. **Recipe matrix is manually configured.** No automatic menu-item-to-ingredient inference in v1.
3. **Single POS CSV format** supported initially (configurable column mapping).
4. **No automatic order submission.** Draft orders require manual approval and transmission.
5. **No multi-location aggregation.** Each location generates its own orders independently.
6. **Timezone-aware scheduling** — batch job runs at 5 AM in the restaurant's local timezone.
