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

export function rowToProperty(row: Record<string, unknown>): Property {
  return {
    id: row.id as string,
    nickname: (row.nickname as string) ?? "",
    address: row.address as string,
    city: (row.city as string) ?? "",
    state: (row.state as string) ?? "",
    zip: (row.zip as string) ?? "",
    type: (row.type as Property["type"]) ?? "primary",
    yearBuilt: (row.year_built as string) ?? "",
    squareFeet: (row.square_feet as string) ?? "",
    bedrooms: (row.bedrooms as string) ?? "",
    bathrooms: (row.bathrooms as string) ?? "",
    purchasePrice: (row.purchase_price as string) ?? "",
    estimatedValue: (row.estimated_value as string) ?? "",
    purchaseDate: (row.purchase_date as string) ?? "",
    photoUri: (row.photo_url as string) ?? undefined,
    isSelected: Boolean(row.is_selected),
  };
}

export function propertyToRow(userId: string, p: Property) {
  return {
    id: p.id,
    user_id: userId,
    nickname: p.nickname,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    type: p.type,
    year_built: p.yearBuilt,
    square_feet: p.squareFeet,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    purchase_price: p.purchasePrice,
    estimated_value: p.estimatedValue,
    purchase_date: p.purchaseDate,
    photo_url: p.photoUri ?? null,
    is_selected: p.isSelected,
  };
}

export function rowToMaintenance(row: Record<string, unknown>): MaintenanceItem {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    title: row.title as string,
    category: (row.category as string) ?? "",
    lastCompleted: (row.last_completed as string) ?? "",
    nextDue: (row.next_due as string) ?? "",
    status: (row.status as MaintenanceItem["status"]) ?? "Upcoming",
    notes: (row.notes as string) ?? "",
    recurring: Boolean(row.recurring),
    intervalDays: row.interval_days as number | undefined,
    priority: (row.priority as MaintenanceItem["priority"]) ?? "medium",
  };
}

export function maintenanceToRow(userId: string, m: MaintenanceItem) {
  return {
    id: m.id,
    user_id: userId,
    property_id: m.propertyId,
    title: m.title,
    category: m.category,
    last_completed: m.lastCompleted,
    next_due: m.nextDue,
    status: m.status,
    notes: m.notes,
    recurring: m.recurring,
    interval_days: m.intervalDays ?? null,
    priority: m.priority,
  };
}

export function rowToRepair(row: Record<string, unknown>): Repair {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    title: row.title as string,
    date: (row.date as string) ?? "",
    cost: (row.cost as string) ?? "",
    contractor: (row.contractor as string) ?? "",
    category: (row.category as string) ?? "",
    notes: (row.notes as string) ?? "",
    photoUris: (row.photo_urls as string[]) ?? [],
    receiptUri: (row.receipt_url as string) ?? undefined,
    warrantyExpires: (row.warranty_expires as string) ?? undefined,
  };
}

export function repairToRow(userId: string, r: Repair) {
  return {
    id: r.id,
    user_id: userId,
    property_id: r.propertyId,
    title: r.title,
    date: r.date,
    cost: r.cost,
    contractor: r.contractor,
    category: r.category,
    notes: r.notes,
    photo_urls: r.photoUris,
    receipt_url: r.receiptUri ?? null,
    warranty_expires: r.warrantyExpires ?? null,
  };
}

export function rowToAppliance(row: Record<string, unknown>): Appliance {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    name: row.name as string,
    category: (row.category as string) ?? "",
    brand: (row.brand as string) ?? "",
    model: (row.model as string) ?? "",
    serial: (row.serial as string) ?? "",
    installDate: (row.install_date as string) ?? "",
    purchasePrice: (row.purchase_price as string) ?? "",
    expectedLifeYears: (row.expected_life_years as number) ?? 10,
    warrantyExpires: (row.warranty_expires as string) ?? "",
    lastService: (row.last_service as string) ?? "",
    nextService: (row.next_service as string) ?? "",
    condition: (row.condition as Appliance["condition"]) ?? "Good",
    notes: (row.notes as string) ?? "",
    photoUri: (row.photo_url as string) ?? undefined,
    manualUri: (row.manual_url as string) ?? undefined,
    receiptUri: (row.receipt_url as string) ?? undefined,
  };
}

export function applianceToRow(userId: string, a: Appliance) {
  return {
    id: a.id,
    user_id: userId,
    property_id: a.propertyId,
    name: a.name,
    category: a.category,
    brand: a.brand,
    model: a.model,
    serial: a.serial,
    install_date: a.installDate,
    purchase_price: a.purchasePrice,
    expected_life_years: a.expectedLifeYears,
    warranty_expires: a.warrantyExpires,
    last_service: a.lastService,
    next_service: a.nextService,
    condition: a.condition,
    notes: a.notes,
    photo_url: a.photoUri ?? null,
    manual_url: a.manualUri ?? null,
    receipt_url: a.receiptUri ?? null,
  };
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
