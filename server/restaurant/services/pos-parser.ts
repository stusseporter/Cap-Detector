/**
 * POS CSV Parser
 *
 * Parses a simple CSV export from POS systems (Toast, Square, etc.)
 * Expected columns: date, menu_item_name, quantity_sold
 *
 * Configurable column mapping can be added later.
 * For v1, we expect a header row with these exact column names (case-insensitive).
 */

interface ParsedSalesRow {
  locationId: string;
  date: string;
  menuItemName: string;
  quantitySold: number;
}

export function parsePosCSV(
  csvText: string,
  locationId: string
): ParsedSalesRow[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row");
  }

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));

  // Find column indices
  const dateIdx = headers.findIndex((h) =>
    ["date", "sale_date", "order_date", "business_date"].includes(h)
  );
  const itemIdx = headers.findIndex((h) =>
    ["menu_item_name", "item_name", "item", "menu_item", "product_name"].includes(h)
  );
  const qtyIdx = headers.findIndex((h) =>
    ["quantity_sold", "quantity", "qty", "qty_sold", "count"].includes(h)
  );

  if (dateIdx === -1) throw new Error("CSV missing date column");
  if (itemIdx === -1) throw new Error("CSV missing menu item name column");
  if (qtyIdx === -1) throw new Error("CSV missing quantity column");

  const rows: ParsedSalesRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);

    const dateStr = cols[dateIdx]?.trim();
    const itemName = cols[itemIdx]?.trim();
    const qtyStr = cols[qtyIdx]?.trim();

    if (!dateStr || !itemName || !qtyStr) continue;

    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty < 0) continue;

    // Normalize date to YYYY-MM-DD
    const normalizedDate = normalizeDate(dateStr);
    if (!normalizedDate) continue;

    rows.push({
      locationId,
      date: normalizedDate,
      menuItemName: itemName,
      quantitySold: qty,
    });
  }

  return rows;
}

/**
 * Simple CSV line parser that handles quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Normalize various date formats to YYYY-MM-DD.
 */
function normalizeDate(dateStr: string): string | null {
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // MM/DD/YYYY
  const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Try Date.parse as fallback
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return null;
}
