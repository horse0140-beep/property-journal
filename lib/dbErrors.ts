/** True when a table/column is missing or the schema does not match. */
export function isMissingSchemaError(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("null value") || lower.includes("not-null") || lower.includes("violates not-null")) {
    return false;
  }
  return (
    lower.includes("does not exist") ||
    lower.includes("relation") ||
    lower.includes("column") ||
    lower.includes("42p01") ||
    lower.includes("could not find")
  );
}

export const PROPERTY_OPTIONAL_COLUMNS = ["photo_url", "is_selected"] as const;

/** Optional photos columns — file_url is always required on insert. */
export const PHOTO_OPTIONAL_COLUMNS = ["photo_url", "uri", "storage_path", "storage_bucket"] as const;

export const MAINTENANCE_OPTIONAL_COLUMNS = [
  "recurring",
  "interval_days",
  "priority",
  "last_completed",
  "next_due",
  "notes",
  "category",
  "status",
] as const;

export const REPAIR_OPTIONAL_COLUMNS = [
  "photo_urls",
  "receipt_url",
  "warranty_expires",
  "date",
  "cost",
  "contractor",
  "category",
  "notes",
] as const;

export const APPLIANCE_OPTIONAL_COLUMNS = [
  // appliance_name must precede name: substring matching would otherwise strip
  // the valid "name" column when the error is about "appliance_name".
  "appliance_name",
  "name",
  "photo_url",
  "manual_url",
  "receipt_url",
  "is_active",
  "serial_number",
  "purchase_date",
  "warranty_expiration",
  "serial",
  "install_date",
  "warranty_expires",
  "purchase_price",
  "expected_life_years",
  "last_service",
  "next_service",
  "condition",
  "notes",
  "brand",
  "model",
  "category",
] as const;

const missingColumns = new Set<string>();

/** Remember a column that is absent from the live Supabase schema. */
export function markColumnMissing(column: string) {
  missingColumns.add(column);
}

export function isColumnMissing(column: string): boolean {
  return missingColumns.has(column);
}

/** Remove columns already known to be missing from a row before writing. */
export function stripKnownMissingColumns(
  row: Record<string, unknown>,
  optionalColumns: readonly string[]
): Record<string, unknown> {
  const next = { ...row };
  for (const col of optionalColumns) {
    if (isColumnMissing(col) && col in next) {
      delete next[col];
    }
  }
  return next;
}

/** Strip optional columns from a row when Supabase reports they are missing. */
export function omitMissingOptionalColumn(
  row: Record<string, unknown>,
  message: string,
  optionalColumns: readonly string[] = PROPERTY_OPTIONAL_COLUMNS
): Record<string, unknown> | null {
  if (!isMissingSchemaError(message)) return null;

  const lower = message.toLowerCase();
  for (const col of optionalColumns) {
    if (lower.includes(col) && col in row) {
      markColumnMissing(col);
      const next = { ...row };
      delete next[col];
      return next;
    }
  }

  for (const col of optionalColumns) {
    if (col in row) {
      markColumnMissing(col);
      const next = { ...row };
      delete next[col];
      return next;
    }
  }

  return null;
}
