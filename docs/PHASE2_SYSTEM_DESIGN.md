# PHASE 2 – System Design & Agent Role

## Responsibility Split

### Backend (deterministic code)
- Store and serve all data (ingredients, suppliers, inventory, orders).
- Parse POS CSVs and write `daily_sales` rows.
- Store uploaded images (S3/local), create `inventory_image` records.
- Run the scheduler (cron): trigger image processing and draft order generation.
- Enforce business rules: delivery-day filtering, min-order constraints, order status transitions.
- Serve API endpoints to the frontend.

### AI Agent (LLM + vision, called via Claude API)
- **Image analysis**: Given an image + optional hint, identify ingredients and estimate quantities.
- **Draft order reasoning**: Given inventory state, sales history, and supplier constraints, produce purchase order recommendations with natural-language explanations.
- The agent does NOT have direct DB access. It calls tools that the backend exposes as function definitions in the Claude tool-use API.

### Flow: Image Processing
```
Chef uploads photo → Backend stores file, creates inventory_image (status=pending)
  → Worker picks up pending images
  → Worker calls Claude API with vision + tool definitions
  → Agent sees image, calls analyze_inventory_image tool (backend resolves)
  → Backend saves inventory_image_items
  → Frontend shows results for chef confirmation
```

### Flow: Draft Order Generation
```
Scheduler fires at 5 AM
  → Backend calls Claude API with tool definitions + instruction
  → Agent calls get_current_inventory → gets data
  → Agent calls get_sales_history → gets data
  → Agent calls get_supplier_constraints → gets data
  → Agent reasons about needs, calls propose_purchase_orders (its own output)
  → Backend receives proposed orders, calls save_purchase_order_draft
  → Draft orders appear in the app
```

---

## Agent Tool Definitions (Function-Calling API Contract)

### Tool 1: `get_current_inventory`

**When called**: At the start of draft order generation, or when the agent needs to know what's on hand.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "restaurant_id": { "type": "string", "format": "uuid" },
    "location_id": { "type": "string", "format": "uuid", "description": "Optional. If omitted, returns all locations." },
    "date": { "type": "string", "format": "date", "description": "Defaults to today." }
  },
  "required": ["restaurant_id"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "inventory": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "ingredient_id": { "type": "string" },
          "ingredient_name": { "type": "string" },
          "category": { "type": "string" },
          "unit": { "type": "string" },
          "par_level": { "type": "number" },
          "on_hand": { "type": "number" },
          "on_hand_source": { "type": "string", "enum": ["manual", "image", "calculated"] },
          "on_hand_confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "on_order": { "type": "number" },
          "on_order_delivery_date": { "type": "string", "format": "date", "nullable": true }
        }
      }
    }
  }
}
```

---

### Tool 2: `get_sales_history`

**When called**: To understand usage trends for forecasting.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "restaurant_id": { "type": "string", "format": "uuid" },
    "location_id": { "type": "string", "format": "uuid" },
    "start_date": { "type": "string", "format": "date" },
    "end_date": { "type": "string", "format": "date" }
  },
  "required": ["restaurant_id", "location_id", "start_date", "end_date"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "daily_ingredient_usage": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "date": { "type": "string", "format": "date" },
          "day_of_week": { "type": "string" },
          "ingredient_id": { "type": "string" },
          "ingredient_name": { "type": "string" },
          "estimated_usage": { "type": "number" },
          "unit": { "type": "string" }
        }
      }
    },
    "summary": {
      "type": "object",
      "description": "Pre-computed averages by day-of-week per ingredient",
      "properties": {
        "by_day_of_week": {
          "type": "object",
          "additionalProperties": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "ingredient_id": { "type": "string" },
                "avg_usage": { "type": "number" },
                "max_usage": { "type": "number" }
              }
            }
          }
        }
      }
    }
  }
}
```

---

### Tool 3: `get_supplier_constraints`

**When called**: To determine delivery schedules, lead times, and minimum order amounts.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "restaurant_id": { "type": "string", "format": "uuid" }
  },
  "required": ["restaurant_id"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "suppliers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "supplier_id": { "type": "string" },
          "name": { "type": "string" },
          "lead_time_days": { "type": "integer" },
          "delivery_days": {
            "type": "array",
            "items": { "type": "integer" },
            "description": "0=Sunday, 6=Saturday"
          },
          "min_order_amount": { "type": "number", "nullable": true },
          "ingredients": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "ingredient_id": { "type": "string" },
                "ingredient_name": { "type": "string" },
                "unit_cost": { "type": "number" },
                "supplier_sku": { "type": "string", "nullable": true }
              }
            }
          }
        }
      }
    }
  }
}
```

---

### Tool 4: `analyze_inventory_image`

**When called**: When the agent is given an image to process (during image processing worker flow).

**What the backend provides** (as part of the tool call context, not as a tool the agent calls — the image is passed directly in the Claude API message as an image content block):
- Image bytes/URL (sent as a base64 image in the user message).
- `image_id` (string): for tracking.
- `restaurant_id` (string): to match against known ingredients.
- `hint` (string, optional): e.g., "dairy shelf", "walk-in fridge top shelf", "screenshot of inventory spreadsheet".
- `known_ingredients` (array): list of `{ ingredient_id, name, unit, category }` for this restaurant, so the agent can map detected items.

**Expected Output** (agent returns this as structured content):
```json
{
  "type": "object",
  "properties": {
    "image_id": { "type": "string" },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "ingredient_id": { "type": "string", "nullable": true, "description": "Matched known ingredient ID, or null if no match" },
          "raw_label": { "type": "string", "description": "What the AI saw, e.g. 'salmon portions in vacuum bags'" },
          "estimated_quantity": { "type": "number" },
          "unit": { "type": "string" },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "notes": { "type": "string", "nullable": true, "description": "E.g., 'hard to see behind other items, might be more'" }
        }
      }
    },
    "image_notes": { "type": "string", "description": "General notes about image quality, visibility, etc." }
  }
}
```

**Key design decisions for image analysis**:
- Agent always returns `raw_label` even when matched, so the chef can see what the AI "saw".
- `confidence` below 0.6 triggers a "please verify" flag in the UI.
- Unmatched items (`ingredient_id: null`) are shown to the chef for manual mapping or dismissal.
- Screenshots of spreadsheets are handled: the agent reads text/numbers from the image and maps them.

---

### Tool 5: `save_purchase_order_draft`

**When called**: After the agent has computed recommended orders.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "restaurant_id": { "type": "string", "format": "uuid" },
    "location_id": { "type": "string", "format": "uuid" },
    "orders": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "supplier_id": { "type": "string" },
          "target_delivery_date": { "type": "string", "format": "date" },
          "explanation": { "type": "string", "description": "Chef-readable reasoning" },
          "lines": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "ingredient_id": { "type": "string" },
                "quantity": { "type": "number" },
                "unit": { "type": "string" },
                "unit_cost": { "type": "number" },
                "notes": { "type": "string", "nullable": true }
              },
              "required": ["ingredient_id", "quantity", "unit", "unit_cost"]
            }
          }
        },
        "required": ["supplier_id", "target_delivery_date", "explanation", "lines"]
      }
    }
  },
  "required": ["restaurant_id", "location_id", "orders"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "created_order_ids": {
      "type": "array",
      "items": { "type": "string" }
    },
    "status": { "type": "string", "enum": ["success", "partial_failure"] },
    "errors": { "type": "array", "items": { "type": "string" } }
  }
}
```
