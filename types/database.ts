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
import { isColumnMissing } from "@/lib/dbErrors";
import {
  setDateFieldNullable,
  setNumericFieldNullable,
  setTextField,
  toDisplayString,
  toNumericOrNull,
} from "@/lib/dbSanitize";

function parsePhotoUri(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function setIfPresent(
  row: Record<string, unknown>,
  column: string,
  value: unknown
) {
  if (isColumnMissing(column)) return;
  if (value === undefined || value === null || value === "") return;
  row[column] = value;
}

export function rowToProperty(row: Record<string, unknown>): Property {
  return {
    id: row.id as string,
    nickname: toDisplayString(row.nickname),
    address: row.address as string,
    city: toDisplayString(row.city),
    state: toDisplayString(row.state),
    zip: toDisplayString(row.zip),
    type: (row.type as Property["type"]) ?? "primary",
    yearBuilt: toDisplayString(row.year_built),
    squareFeet: toDisplayString(row.square_feet),
    bedrooms: toDisplayString(row.bedrooms),
    bathrooms: toDisplayString(row.bathrooms),
    purchasePrice: toDisplayString(row.purchase_price),
    estimatedValue: toDisplayString(row.estimated_value ?? row.value),
    purchaseDate: toDisplayString(row.purchase_date),
    photoUri: parsePhotoUri(row.photo_url),
    isSelected: Boolean(row.is_selected),
  };
}

export function propertyToRow(userId: string, p: Property): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: p.id,
    user_id: userId,
    address: p.address,
    type: p.type,
  };

  setTextField(row, "nickname", p.nickname);
  setTextField(row, "city", p.city);
  setTextField(row, "state", p.state);
  setTextField(row, "zip", p.zip);
  setTextField(row, "year_built", p.yearBuilt);
  setNumericFieldNullable(row, "square_feet", p.squareFeet);
  setNumericFieldNullable(row, "bedrooms", p.bedrooms);
  setNumericFieldNullable(row, "bathrooms", p.bathrooms);
  setNumericFieldNullable(row, "purchase_price", p.purchasePrice);
  setNumericFieldNullable(row, "estimated_value", p.estimatedValue);
  setNumericFieldNullable(row, "value", p.estimatedValue);
  setDateFieldNullable(row, "purchase_date", p.purchaseDate);

  const photo = parsePhotoUri(p.photoUri);
  if (photo && !isColumnMissing("photo_url")) {
    row.photo_url = photo;
  }
  if (p.isSelected && !isColumnMissing("is_selected")) {
    row.is_selected = true;
  }

  return row;
}

export function rowToMaintenance(row: Record<string, unknown>): MaintenanceItem {
  const interval = row.interval_days;
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    title: row.title as string,
    category: toDisplayString(row.category),
    lastCompleted: toDisplayString(row.last_completed),
    nextDue: toDisplayString(row.next_due),
    status: (row.status as MaintenanceItem["status"]) ?? "Upcoming",
    notes: toDisplayString(row.notes),
    recurring: Boolean(row.recurring),
    intervalDays: interval === null || interval === undefined ? undefined : Number(interval),
    priority: (row.priority as MaintenanceItem["priority"]) ?? "medium",
  };
}

export function maintenanceToRow(userId: string, m: MaintenanceItem): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: m.id,
    user_id: userId,
    property_id: m.propertyId,
    title: m.title,
  };

  setTextField(row, "category", m.category);
  setDateFieldNullable(row, "last_completed", m.lastCompleted);
  setDateFieldNullable(row, "next_due", m.nextDue);
  setTextField(row, "status", m.status);
  setTextField(row, "notes", m.notes);
  setTextField(row, "priority", m.priority);
  setNumericFieldNullable(row, "interval_days", m.intervalDays);

  if (m.recurring === true && !isColumnMissing("recurring")) {
    row.recurring = true;
  }

  return row;
}

export function rowToRepair(row: Record<string, unknown>): Repair {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    title: row.title as string,
    date: toDisplayString(row.date),
    cost: toDisplayString(row.cost),
    contractor: toDisplayString(row.contractor),
    category: toDisplayString(row.category),
    notes: toDisplayString(row.notes),
    photoUris: (row.photo_urls as string[]) ?? [],
    receiptUri: parsePhotoUri(row.receipt_url),
    warrantyExpires: toDisplayString(row.warranty_expires) || undefined,
  };
}

export function repairToRow(userId: string, r: Repair): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: r.id,
    user_id: userId,
    property_id: r.propertyId,
    title: r.title,
  };

  setTextField(row, "contractor", r.contractor);
  setTextField(row, "category", r.category);
  setTextField(row, "notes", r.notes);
  setDateFieldNullable(row, "date", r.date);
  setNumericFieldNullable(row, "cost", r.cost);
  setDateFieldNullable(row, "warranty_expires", r.warrantyExpires);

  if (r.photoUris !== undefined) {
    row.photo_urls = r.photoUris;
  }
  if (r.receiptUri !== undefined) {
    row.receipt_url = parsePhotoUri(r.receiptUri) ?? null;
  }

  return row;
}

export function rowToAppliance(row: Record<string, unknown>): Appliance {
  const serial = toDisplayString(row.serial_number ?? row.serial);
  const installDate = toDisplayString(row.purchase_date ?? row.install_date);
  const warrantyExpires = toDisplayString(row.warranty_expiration ?? row.warranty_expires);

  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    name: row.name as string,
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
    photoUri: parsePhotoUri(row.photo_url),
    manualUri: parsePhotoUri(row.manual_url),
    receiptUri: parsePhotoUri(row.receipt_url),
  };
}

export function applianceToRow(userId: string, a: Appliance): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: a.id,
    user_id: userId,
    property_id: a.propertyId,
    name: a.name,
  };

  setTextField(row, "category", a.category || "Appliance");
  setTextField(row, "brand", a.brand);
  setTextField(row, "model", a.model);

  if (a.serial) {
    setIfPresent(row, "serial", a.serial);
    setIfPresent(row, "serial_number", a.serial);
  }

  setDateFieldNullable(row, "install_date", a.installDate);
  setDateFieldNullable(row, "purchase_date", a.installDate);
  setNumericFieldNullable(row, "purchase_price", a.purchasePrice);

  const lifeYears = toNumericOrNull(a.expectedLifeYears);
  if (lifeYears !== null) {
    setIfPresent(row, "expected_life_years", lifeYears);
  }

  setDateFieldNullable(row, "warranty_expires", a.warrantyExpires);
  setDateFieldNullable(row, "warranty_expiration", a.warrantyExpires);
  setTextField(row, "last_service", a.lastService);
  setTextField(row, "next_service", a.nextService);
  setTextField(row, "condition", a.condition || "Good");
  setTextField(row, "notes", a.notes);

  const photo = parsePhotoUri(a.photoUri);
  if (photo) setIfPresent(row, "photo_url", photo);

  const manual = parsePhotoUri(a.manualUri);
  if (manual) setIfPresent(row, "manual_url", manual);

  const receipt = parsePhotoUri(a.receiptUri);
  if (receipt) setIfPresent(row, "receipt_url", receipt);

  if (!isColumnMissing("is_active")) {
    row.is_active = true;
  }

  return row;
}

export function rowToDocument(row: Record<string, unknown>, categoryOverride?: Document["category"]): Document {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    title: row.title as string,
    category: categoryOverride ?? ((row.category as Document["category"]) ?? "other"),
    fileUri: (row.file_url as string) ?? undefined,
    fileType: (row.file_type as Document["fileType"]) ?? "pdf",
    fileSize: (row.file_size as string) ?? "",
    uploadDate: (row.upload_date as string) ?? "",
    expiresDate: (row.expires_date as string) ?? undefined,
    notes: (row.notes as string) ?? "",
    tags: (row.tags as string[]) ?? [],
  };
}

export function rowToPhoto(row: Record<string, unknown>): PhotoItem {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    uri: row.file_url as string,
    caption: (row.caption as string) ?? "",
    date: (row.date as string) ?? "",
    category: (row.category as string) ?? "general",
  };
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
