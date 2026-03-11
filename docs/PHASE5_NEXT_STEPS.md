# PHASE 5 – Post-MVP Improvements (Prioritized)

## 1. Smart Shelf Templates & Repeat Photo Comparisons

**What**: Let chefs define "shelf zones" (e.g., "dairy shelf, 3 sections"). The system remembers what items usually live where and can do diff-based analysis: "Last Tuesday you had 4 butter cases here, now I see 2."

**Best handled by**:
- **Deterministic code**: Store shelf templates, zones, and historical image metadata. Run image-to-image comparison workflows.
- **Agent (LLM/vision)**: Compare current photo to reference photo. Detect changes in quantity and flag new/missing items.

**Impact**: Much more accurate image-based counts. Reduces chef confirmation friction.

---

## 2. Time-Series Demand Forecasting

**What**: Replace the simple 14-day average with a proper forecasting model that accounts for seasonality, holidays, weather, and local events (e.g., game days).

**Best handled by**:
- **Dedicated model**: A lightweight time-series forecaster (Prophet, or a simple LSTM) trained on each restaurant's POS data. Runs on a schedule, outputs daily ingredient-level demand predictions.
- **Deterministic code**: Feature engineering (day-of-week, month, holiday flags), model training pipeline, prediction serving.
- **Agent (LLM)**: Interpret unusual forecast results for the chef: "I'm predicting 40% higher salmon usage this Friday because it's a holiday weekend."

**Impact**: Better order accuracy, less waste, fewer 86'd items.

---

## 3. Barcode & Label Scanning

**What**: Use the camera to scan barcodes, QR codes, or printed labels on cases and packages. Auto-identify products and log exact quantities received.

**Best handled by**:
- **Dedicated model**: A barcode/OCR detection model (can use existing libraries like ZXing or Tesseract, or a vision model fine-tuned for food packaging labels).
- **Deterministic code**: Barcode-to-product lookup database, receiving workflow.
- **Agent (LLM/vision)**: Fallback for damaged/unclear labels — read partial text and fuzzy-match to known products.

**Impact**: Accurate receiving counts, closes the loop on order → delivery → inventory.

---

## 4. Supplier Integration & Auto-Ordering

**What**: Connect to supplier ordering systems (email, EDI, or API) to send approved orders directly instead of requiring manual copy-paste.

**Best handled by**:
- **Deterministic code**: Email templating and sending (for email-based suppliers). API integrations for major distributors (Sysco, US Foods have APIs). Order status tracking and delivery confirmation.
- **Agent (LLM)**: Generate well-formatted order emails from structured data. Handle supplier-specific formatting requirements.

**Impact**: Saves 15–30 minutes per day of manual order entry. Reduces transcription errors.

---

## 5. Multi-Location Aggregation & Central Purchasing

**What**: For restaurant groups (3–20 locations), aggregate orders across locations to hit better pricing tiers and minimum order thresholds. Show group-level dashboards.

**Best handled by**:
- **Deterministic code**: Order aggregation logic, pricing tier calculations, delivery route optimization, cross-location inventory transfer suggestions.
- **Agent (LLM)**: Write consolidated order explanations for group purchasers. Identify cross-location opportunities: "Location A has excess salmon, Location B needs 10 lbs — consider a transfer instead of ordering."

**Impact**: 5–15% cost savings from volume aggregation. Better visibility for multi-unit operators.

---

## Summary Table

| # | Improvement | Code | Agent (LLM) | Other Model |
|---|------------|------|-------------|-------------|
| 1 | Shelf templates & photo diffs | Template storage, workflow | Photo comparison, diff detection | — |
| 2 | Time-series forecasting | Feature engineering, pipeline | Interpret results for chefs | Prophet / LSTM forecaster |
| 3 | Barcode & label scanning | Product lookup DB, receiving flow | Fuzzy label matching fallback | Barcode/OCR model |
| 4 | Supplier integration | Email/API integrations | Format order communications | — |
| 5 | Multi-location aggregation | Aggregation logic, dashboards | Cross-location opportunity analysis | — |
