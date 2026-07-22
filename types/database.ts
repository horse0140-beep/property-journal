import type {
  Property,
  MaintenanceItem,
  Repair,
  Appliance,
  Document,
  PaintColor,
  Contractor,
  PhotoItem,
} from "@/data/demoData";
import type { PropertyScore } from "@/context/HomeWiseContext";
import { normalizePhotoItem } from "@/lib/photoUtils";
import {
  setNumericFieldNullable,
  setNumericFieldOmit,
  setTextField,
  toDisplayString,
  toNumericOrNull,
} from "@/lib/dbSanitize";
import {
  setIsoDateFieldOmit,
  setIsoDateFieldNullable,
  todayIsoDate,
  normalizeDateForDatabase,
} from "@/lib/dateForDatabase";

function parsePhotoUri(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Keep PostgreSQL date values as ISO YYYY-MM-DD in the domain model. */
function toIsoOrEmpty(value: unknown): string {
  if (value === undefined || value === null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // Legacy free-text already in DB: leave empty so picker forces a real date
  return "";
}

const DOCUMENT_CATEGORIES = [
  "warranty",
  "insurance",
  "inspection",
  "permit",
  "receipt",
  "contract",
  "manual",
  "other",
] as const satisfies readonly Document["category"][];

const DOCUMENT_CATEGORY_ALIASES: Record<string, Document["category"]> = {
  warranties: "warranty",
  receipts: "receipt",
  permits: "permit",
  inspections: "inspection",
  contracts: "contract",
  manuals: "manual",
};

export function normalizeDocumentCategory(
  raw: unknown,
  override?: Document["category"]
): Document["category"] {
  if (override) return override;
  const key = String(raw ?? "other").toLowerCase().trim();
  if ((DOCUMENT_CATEGORIES as readonly string[]).includes(key)) {
    return key as Document["category"];
  }
  return DOCUMENT_CATEGORY_ALIASES[key] ?? "other";
}

export function matchesPropertyId(
  a: string | undefined | null,
  b: string | undefined | null
): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/** upload_date is a date column in the live DB — always send ISO YYYY-MM-DD. */
function normalizeUploadDate(value?: string): string {
  if (value?.trim()) {
    const parsed = normalizeDateForDatabase(value);
    if (parsed.ok && parsed.iso) return parsed.iso;
  }
  return todayIsoDate();
}

function setIfPresent(row: Record<string, unknown>, column: string, value: unknown) {
  if (value === undefined || value === null || value === "") return;
  row[column] = value;
}

export function rowToProperty(row: Record<string, unknown>): Property {
  const address =
    toDisplayString(row.street_address) ||
    toDisplayString(row.address) ||
    toDisplayString(row.property_name);

  const rawType = row.property_type ?? row.type;
  const type = (rawType as Property["type"]) ?? "primary";

  return {
    id: row.id as string,
    nickname: toDisplayString(row.nickname ?? row.property_name),
    address,
    city: toDisplayString(row.city),
    state: toDisplayString(row.state),
    zip: toDisplayString(row.zip),
    type,
    yearBuilt: toDisplayString(row.year_built),
    squareFeet: toDisplayString(row.square_feet),
    bedrooms: toDisplayString(row.bedrooms),
    bathrooms: toDisplayString(row.bathrooms),
    purchasePrice: toDisplayString(row.purchase_price),
    estimatedValue: toDisplayString(row.estimated_value ?? row.value),
    purchaseDate: toIsoOrEmpty(row.purchase_date),
    photoUri: parsePhotoUri(row.photo_url ?? row.image_url),
    isSelected: Boolean(row.is_selected ?? row.is_primary),
  };
}

/** Property columns only — user_id is set in propertyService from supabase.auth.getUser(). */
export function propertyToRow(p: Property): Record<string, unknown> {
  const streetAddress = p.address?.trim() ?? "";
  const propertyName = p.nickname?.trim() || streetAddress;

  const row: Record<string, unknown> = {
    id: p.id,
    property_name: propertyName,
    address: streetAddress,
    street_address: streetAddress,
    property_type: p.type,
    is_primary: p.type === "primary",
    is_active: true,
    is_selected: Boolean(p.isSelected),
  };

  setTextField(row, "nickname", p.nickname);
  setTextField(row, "city", p.city);
  setTextField(row, "state", p.state);
  setTextField(row, "zip", p.zip);
  setNumericFieldNullable(row, "year_built", p.yearBuilt);
  setNumericFieldNullable(row, "square_feet", p.squareFeet);
  setNumericFieldNullable(row, "bedrooms", p.bedrooms);
  setNumericFieldNullable(row, "bathrooms", p.bathrooms);
  setNumericFieldNullable(row, "purchase_price", p.purchasePrice);
  setNumericFieldNullable(row, "estimated_value", p.estimatedValue);
  setIsoDateFieldNullable(row, "purchase_date", p.purchaseDate, "Purchase date");

  const photo = parsePhotoUri(p.photoUri);
  if (photo) {
    row.photo_url = photo;
    row.image_url = photo;
  }

  return row;
}

function propertyPartialToRow(updates: Partial<Property>): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (updates.nickname !== undefined) setTextField(row, "nickname", updates.nickname);
  if (updates.address !== undefined) {
    const streetAddress = updates.address.trim();
    row.address = streetAddress;
    row.street_address = streetAddress;
    row.property_name = updates.nickname?.trim() || streetAddress;
  }
  if (updates.city !== undefined) setTextField(row, "city", updates.city);
  if (updates.state !== undefined) setTextField(row, "state", updates.state);
  if (updates.zip !== undefined) setTextField(row, "zip", updates.zip);
  if (updates.type !== undefined) {
    row.property_type = updates.type;
    row.is_primary = updates.type === "primary";
  }
  if (updates.yearBuilt !== undefined) setNumericFieldNullable(row, "year_built", updates.yearBuilt);
  if (updates.squareFeet !== undefined) setNumericFieldNullable(row, "square_feet", updates.squareFeet);
  if (updates.bedrooms !== undefined) setNumericFieldNullable(row, "bedrooms", updates.bedrooms);
  if (updates.bathrooms !== undefined) setNumericFieldNullable(row, "bathrooms", updates.bathrooms);
  if (updates.purchasePrice !== undefined) setNumericFieldNullable(row, "purchase_price", updates.purchasePrice);
  if (updates.estimatedValue !== undefined) setNumericFieldNullable(row, "estimated_value", updates.estimatedValue);
  if (updates.purchaseDate !== undefined) setIsoDateFieldNullable(row, "purchase_date", updates.purchaseDate, "Purchase date");
  if (updates.photoUri !== undefined && updates.photoUri) {
    row.photo_url = updates.photoUri;
    row.image_url = updates.photoUri;
  }
  if (updates.isSelected !== undefined) row.is_selected = updates.isSelected;

  if (updates.nickname !== undefined && !updates.address) {
    setTextField(row, "property_name", updates.nickname);
  }

  return row;
}

export { propertyPartialToRow };

export function rowToMaintenance(row: Record<string, unknown>): MaintenanceItem {
  const interval = row.interval_days;
  const photoUris = Array.isArray(row.photo_urls)
    ? (row.photo_urls as string[]).map((u) => String(u ?? "").trim()).filter(Boolean)
    : [];
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    title: row.title as string,
    category: toDisplayString(row.category),
    // Keep ISO YYYY-MM-DD in the model; format only in UI.
    lastCompleted: toIsoOrEmpty(row.last_completed),
    nextDue: toIsoOrEmpty(row.next_due),
    status: (row.status as MaintenanceItem["status"]) ?? "Upcoming",
    notes: toDisplayString(row.notes),
    recurring: Boolean(row.recurring),
    intervalDays: interval === null || interval === undefined ? undefined : Number(interval),
    priority: (row.priority as MaintenanceItem["priority"]) ?? "medium",
    photoUris,
  };
}

export function maintenanceToRow(userId: string, m: MaintenanceItem): Record<string, unknown> {
  const propertyId = (m.propertyId ?? "").trim();
  const title = (m.title ?? "").trim();
  if (!propertyId) throw new Error("property_id is required.");
  if (!title) throw new Error("title is required.");

  const row: Record<string, unknown> = {
    id: m.id,
    user_id: userId,
    property_id: propertyId,
    title,
    status: m.status || "Upcoming",
    priority: m.priority || "medium",
  };

  setTextField(row, "category", m.category || "General");
  setIsoDateFieldOmit(row, "last_completed", m.lastCompleted, "Last completed");
  setIsoDateFieldOmit(row, "next_due", m.nextDue, "Next due");
  setTextField(row, "notes", m.notes);
  setNumericFieldOmit(row, "interval_days", m.intervalDays);

  if (m.recurring === true) row.recurring = true;

  if (m.photoUris !== undefined) {
    row.photo_urls = m.photoUris.filter((u) => Boolean(String(u ?? "").trim()));
  }

  return row;
}

export function rowToRepair(row: Record<string, unknown>): Repair {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    title: row.title as string,
    date: toIsoOrEmpty(row.date),
    cost: toDisplayString(row.cost),
    contractor: toDisplayString(row.contractor),
    category: toDisplayString(row.category),
    notes: toDisplayString(row.notes),
    photoUris: (row.photo_urls as string[]) ?? [],
    receiptUri: parsePhotoUri(row.receipt_url),
    warrantyExpires: toIsoOrEmpty(row.warranty_expires) || undefined,
  };
}

export function repairToRow(userId: string, r: Repair): Record<string, unknown> {
  const propertyId = (r.propertyId ?? "").trim();
  const title = (r.title ?? "").trim();
  if (!propertyId) throw new Error("property_id is required.");
  if (!title) throw new Error("title is required.");

  const row: Record<string, unknown> = {
    id: r.id,
    user_id: userId,
    property_id: propertyId,
    title,
  };

  setTextField(row, "contractor", r.contractor);
  setTextField(row, "category", r.category || "General");
  setTextField(row, "notes", r.notes);
  setIsoDateFieldOmit(row, "date", r.date, "Repair date");
  setTextField(row, "cost", r.cost);
  setIsoDateFieldOmit(row, "warranty_expires", r.warrantyExpires, "Warranty expires");

  if (r.photoUris?.length) {
    row.photo_urls = r.photoUris;
  }
  const receipt = parsePhotoUri(r.receiptUri);
  if (receipt) row.receipt_url = receipt;

  return row;
}

export function rowToAppliance(row: Record<string, unknown>): Appliance {
  const serial = toDisplayString(row.serial_number ?? row.serial);
  const installDate = toIsoOrEmpty(row.purchase_date ?? row.install_date);
  const warrantyExpires = toIsoOrEmpty(row.warranty_expiration ?? row.warranty_expires);
  const fromArray = Array.isArray(row.photo_urls)
    ? (row.photo_urls as string[]).map((u) => String(u ?? "").trim()).filter(Boolean)
    : [];
  const singular = parsePhotoUri(row.photo_url);
  const photoUris = fromArray.length > 0 ? fromArray : singular ? [singular] : [];

  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    name: toDisplayString(row.appliance_name ?? row.name),
    category: toDisplayString(row.category),
    brand: toDisplayString(row.brand),
    model: toDisplayString(row.model),
    serial,
    installDate,
    purchasePrice: toDisplayString(row.purchase_price),
    expectedLifeYears: (row.expected_life_years as number) ?? 10,
    warrantyExpires,
    lastService: toDisplayString(row.last_service),
    nextService: toDisplayString(row.next_service),
    condition: (row.condition as Appliance["condition"]) ?? "Good",
    notes: toDisplayString(row.notes),
    photoUris,
    photoUri: photoUris[0],
    manualUri: parsePhotoUri(row.manual_url),
    receiptUri: parsePhotoUri(row.receipt_url),
  };
}

export function applianceToRow(userId: string, a: Appliance): Record<string, unknown> {
  const displayName = (a.name ?? "").trim();
  const row: Record<string, unknown> = {
    id: a.id,
    user_id: userId,
    property_id: a.propertyId,
    appliance_name: displayName,
    name: displayName,
  };

  setTextField(row, "category", a.category || "Appliance");
  setTextField(row, "brand", a.brand);
  setTextField(row, "model", a.model);

  if (a.serial) {
    setTextField(row, "serial", a.serial);
  }

  setIsoDateFieldNullable(row, "install_date", a.installDate, "Install date");
  setNumericFieldNullable(row, "purchase_price", a.purchasePrice);

  const lifeYears = toNumericOrNull(a.expectedLifeYears);
  if (lifeYears !== null) {
    row.expected_life_years = lifeYears;
  }

  setIsoDateFieldNullable(row, "warranty_expires", a.warrantyExpires, "Warranty expires");
  setTextField(row, "last_service", a.lastService);
  setTextField(row, "next_service", a.nextService);
  setTextField(row, "condition", a.condition || "Good");
  setTextField(row, "notes", a.notes);

  const photoUris =
    a.photoUris !== undefined
      ? a.photoUris.map((u) => parsePhotoUri(u)).filter(Boolean)
      : a.photoUri !== undefined
        ? (() => {
            const photo = parsePhotoUri(a.photoUri);
            return photo ? [photo] : [];
          })()
        : undefined;

  if (photoUris !== undefined) {
    row.photo_urls = photoUris;
    row.photo_url = photoUris[0] ?? null;
  }

  const manual = parsePhotoUri(a.manualUri);
  if (a.manualUri !== undefined) {
    row.manual_url = manual || null;
  }
  const receipt = parsePhotoUri(a.receiptUri);
  if (a.receiptUri !== undefined) {
    row.receipt_url = receipt || null;
  }

  return row;
}

export function documentToRow(
  userId: string,
  doc: Document,
  table: "documents" | "receipts" | "warranties" = "documents"
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: doc.id,
    user_id: userId,
    property_id: doc.propertyId,
    title: doc.title.trim(),
    file_url: doc.fileUri?.trim() || "",
    file_type: doc.fileType || "pdf",
    upload_date: normalizeUploadDate(doc.uploadDate),
    notes: doc.notes ?? "",
  };

  // tags: documents/receipts/warranties — column added in migration 016
  if (doc.tags?.length) {
    row.tags = doc.tags;
  }

  setTextField(row, "file_size", doc.fileSize);
  setIsoDateFieldOmit(row, "expires_date", doc.expiresDate, "Expiration date");

  if (table === "documents") {
    row.category = normalizeDocumentCategory(doc.category);
  }

  return row;
}

export function contractorToRow(userId: string, c: Contractor): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: c.id,
    user_id: userId,
    name: c.name,
  };

  if (c.propertyId) row.property_id = c.propertyId;
  setTextField(row, "trade", c.trade);
  setTextField(row, "phone", c.phone);
  setTextField(row, "email", c.email);
  setTextField(row, "website", c.website);
  setTextField(row, "notes", c.notes);
  setTextField(row, "last_used", c.lastUsed);
  setTextField(row, "license_number", c.licenseNumber);

  const rating = toNumericOrNull(c.rating);
  if (rating !== null) row.rating = rating;

  return row;
}

export function paintToRow(userId: string, p: PaintColor): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: p.id,
    user_id: userId,
    property_id: p.propertyId,
    room: p.room,
  };

  setTextField(row, "brand", p.brand);
  setTextField(row, "color_name", p.colorName);
  setTextField(row, "color_code", p.colorCode);
  setTextField(row, "finish", p.finish);
  setTextField(row, "hex", p.hex);
  setIsoDateFieldNullable(row, "purchase_date", p.purchaseDate, "Purchase date");
  setTextField(row, "notes", p.notes);

  return row;
}

export function rowToDocument(row: Record<string, unknown>, categoryOverride?: Document["category"]): Document {
  const fileUrl = toDisplayString(row.file_url);
  let fileName: string | undefined;
  if (fileUrl) {
    try {
      const clean = decodeURIComponent(fileUrl.split("?")[0]);
      const base = clean.split("/").pop()?.trim();
      if (base) fileName = base;
    } catch {
      // ignore
    }
  }
  return {
    id: row.id as string,
    propertyId: toDisplayString(row.property_id ?? row.propertyId),
    title: toDisplayString(row.title),
    category: normalizeDocumentCategory(row.category, categoryOverride),
    fileUri: fileUrl || undefined,
    fileName,
    fileType: (row.file_type as Document["fileType"]) ?? "pdf",
    fileSize: (row.file_size as string) ?? "",
    uploadDate: (row.upload_date as string) ?? "",
    expiresDate: toIsoOrEmpty(row.expires_date) || undefined,
    notes: (row.notes as string) ?? "",
    tags: (row.tags as string[]) ?? [],
  };
}

export function rowToPhoto(row: Record<string, unknown>): PhotoItem {
  return normalizePhotoItem(row);
}

export function rowToContractor(row: Record<string, unknown>): Contractor {
  return {
    id: row.id as string,
    propertyId: (row.property_id as string) ?? undefined,
    name: row.name as string,
    trade: (row.trade as string) ?? "",
    phone: (row.phone as string) ?? "",
    email: (row.email as string) ?? "",
    website: (row.website as string) ?? "",
    rating: (row.rating as number) ?? 5,
    notes: (row.notes as string) ?? "",
    lastUsed: (row.last_used as string) ?? "",
    licenseNumber: (row.license_number as string) ?? "",
  };
}

export function rowToPaint(row: Record<string, unknown>): PaintColor {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    room: row.room as string,
    brand: (row.brand as string) ?? "",
    colorName: (row.color_name as string) ?? "",
    colorCode: (row.color_code as string) ?? "",
    finish: (row.finish as string) ?? "",
    hex: (row.hex as string) ?? "",
    purchaseDate: (row.purchase_date as string) ?? "",
    notes: (row.notes as string) ?? "",
  };
}

export function rowToScore(row: Record<string, unknown>): PropertyScore {
  return {
    overall: row.overall as number,
    maintenance: row.maintenance as number,
    appliances: row.appliances as number,
    repairs: row.repairs as number,
    warranty: row.warranty as number,
    inspections: row.inspections as number,
    label: row.label as PropertyScore["label"],
  };
}

export function scoreToRow(userId: string, propertyId: string, score: PropertyScore) {
  return {
    user_id: userId,
    property_id: propertyId,
    overall: score.overall,
    maintenance: score.maintenance,
    appliances: score.appliances,
    repairs: score.repairs,
    warranty: score.warranty,
    inspections: score.inspections,
    label: score.label,
    updated_at: new Date().toISOString(),
  };
}
