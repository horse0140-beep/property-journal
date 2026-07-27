/**
 * Owner-controlled share content permissions.
 * Stored inside property_shares.snapshot_json (JSONB) — no new column required.
 * Sensitive sections default OFF; public consumers only ever see filtered snapshot data.
 */

export type ShareSectionKey =
  | "basicPropertyInfo"
  | "propertyAddress"
  | "propertyPhotos"
  | "maintenanceHistory"
  | "upcomingMaintenance"
  | "completedRepairs"
  | "repairCosts"
  | "contractorContact"
  | "appliances"
  | "appliancePhotos"
  | "applianceModelSerial"
  | "documents"
  | "warranties"
  | "receipts"
  | "inspectionReports"
  | "permits"
  | "ownerMessage"
  | "ownerContact";

export type SharePresetId = "buyer" | "contractor" | "insurance" | "family" | "custom";

export type ShareItemIds = {
  maintenance: string[];
  repairs: string[];
  appliances: string[];
  documents: string[];
  photos: string[];
};

export type SharePermissions = {
  preset: SharePresetId;
  sections: Record<ShareSectionKey, boolean>;
  /** When a section is on, only these IDs are included (empty = none). */
  itemIds: ShareItemIds;
};

export const SHARE_SECTION_LABELS: Record<ShareSectionKey, string> = {
  basicPropertyInfo: "Basic property information",
  propertyAddress: "Property address",
  propertyPhotos: "Property photos",
  maintenanceHistory: "Maintenance history",
  upcomingMaintenance: "Upcoming maintenance",
  completedRepairs: "Completed repairs",
  repairCosts: "Repair costs",
  contractorContact: "Contractor names/contact information",
  appliances: "Appliances",
  appliancePhotos: "Appliance photos",
  applianceModelSerial: "Appliance model and serial numbers",
  documents: "Documents",
  warranties: "Warranties",
  receipts: "Receipts",
  inspectionReports: "Inspection reports",
  permits: "Permits",
  ownerMessage: "Owner message",
  ownerContact: "Owner contact information",
};

/** Sensitive by default — never auto-enable. */
export const SENSITIVE_SECTION_KEYS: ShareSectionKey[] = [
  "repairCosts",
  "contractorContact",
  "applianceModelSerial",
  "receipts",
  "ownerContact",
];

function allSectionsFalse(): Record<ShareSectionKey, boolean> {
  return {
    basicPropertyInfo: false,
    propertyAddress: false,
    propertyPhotos: false,
    maintenanceHistory: false,
    upcomingMaintenance: false,
    completedRepairs: false,
    repairCosts: false,
    contractorContact: false,
    appliances: false,
    appliancePhotos: false,
    applianceModelSerial: false,
    documents: false,
    warranties: false,
    receipts: false,
    inspectionReports: false,
    permits: false,
    ownerMessage: false,
    ownerContact: false,
  };
}

export function emptyItemIds(): ShareItemIds {
  return {
    maintenance: [],
    repairs: [],
    appliances: [],
    documents: [],
    photos: [],
  };
}

/** Safe intentional default: basic facts + address only. */
export function defaultSharePermissions(): SharePermissions {
  const sections = allSectionsFalse();
  sections.basicPropertyInfo = true;
  sections.propertyAddress = true;
  return {
    preset: "custom",
    sections,
    itemIds: emptyItemIds(),
  };
}

function enable(
  base: Record<ShareSectionKey, boolean>,
  keys: ShareSectionKey[]
): Record<ShareSectionKey, boolean> {
  const next = { ...base };
  for (const k of keys) next[k] = true;
  return next;
}

export type SharePresetCatalog = {
  id: SharePresetId;
  label: string;
  description: string;
  sections: ShareSectionKey[];
};

export const SHARE_PRESETS: SharePresetCatalog[] = [
  {
    id: "buyer",
    label: "Buyer / Realtor",
    description: "Details, history, repairs, appliances, warranties, inspections, photos, docs",
    sections: [
      "basicPropertyInfo",
      "propertyAddress",
      "propertyPhotos",
      "maintenanceHistory",
      "upcomingMaintenance",
      "completedRepairs",
      "appliances",
      "appliancePhotos",
      "warranties",
      "inspectionReports",
      "documents",
      "permits",
    ],
  },
  {
    id: "contractor",
    label: "Contractor",
    description: "Address, maintenance, repairs, appliances, photos — no receipts/private docs",
    sections: [
      "propertyAddress",
      "basicPropertyInfo",
      "maintenanceHistory",
      "upcomingMaintenance",
      "completedRepairs",
      "appliances",
      "appliancePhotos",
      "propertyPhotos",
    ],
  },
  {
    id: "insurance",
    label: "Insurance / Adjuster",
    description: "Details, repairs, inspections, receipts, photos, warranties",
    sections: [
      "basicPropertyInfo",
      "propertyAddress",
      "completedRepairs",
      "repairCosts",
      "inspectionReports",
      "receipts",
      "propertyPhotos",
      "warranties",
      "documents",
    ],
  },
  {
    id: "family",
    label: "Family / Caretaker",
    description: "Details, maintenance, appliances, selected emergency docs",
    sections: [
      "basicPropertyInfo",
      "propertyAddress",
      "maintenanceHistory",
      "upcomingMaintenance",
      "appliances",
      "appliancePhotos",
      "documents",
      "warranties",
      "ownerMessage",
    ],
  },
  {
    id: "custom",
    label: "Custom",
    description: "Choose every section manually",
    sections: ["basicPropertyInfo", "propertyAddress"],
  },
];

export function applySharePreset(
  preset: SharePresetId,
  catalogIds: {
    maintenance: string[];
    repairs: string[];
    appliances: string[];
    documents: string[];
    photos: string[];
  }
): SharePermissions {
  const def = SHARE_PRESETS.find((p) => p.id === preset) ?? SHARE_PRESETS[SHARE_PRESETS.length - 1];
  const sections = enable(allSectionsFalse(), def.sections);
  const itemIds = emptyItemIds();

  if (sections.maintenanceHistory || sections.upcomingMaintenance) {
    itemIds.maintenance = [...catalogIds.maintenance];
  }
  if (sections.completedRepairs) {
    itemIds.repairs = [...catalogIds.repairs];
  }
  if (sections.appliances) {
    itemIds.appliances = [...catalogIds.appliances];
  }
  if (
    sections.documents ||
    sections.warranties ||
    sections.receipts ||
    sections.inspectionReports ||
    sections.permits
  ) {
    itemIds.documents = [...catalogIds.documents];
  }
  if (sections.propertyPhotos) {
    itemIds.photos = [...catalogIds.photos];
  }

  return { preset, sections, itemIds };
}

export function toggleItemId(
  list: string[],
  id: string,
  selected: boolean
): string[] {
  if (selected) return list.includes(id) ? list : [...list, id];
  return list.filter((x) => x !== id);
}

export function hasAnyShareSelection(
  permissions: SharePermissions,
  ownerMessage: string
): boolean {
  const s = permissions.sections;
  if (s.basicPropertyInfo || s.propertyAddress) return true;
  if (s.ownerMessage && ownerMessage.trim()) return true;
  if (s.ownerContact) return true;
  if (s.propertyPhotos && permissions.itemIds.photos.length > 0) return true;
  if (
    (s.maintenanceHistory || s.upcomingMaintenance) &&
    permissions.itemIds.maintenance.length > 0
  ) {
    return true;
  }
  if (s.completedRepairs && permissions.itemIds.repairs.length > 0) return true;
  if (s.appliances && permissions.itemIds.appliances.length > 0) return true;
  if (
    (s.documents ||
      s.warranties ||
      s.receipts ||
      s.inspectionReports ||
      s.permits) &&
    permissions.itemIds.documents.length > 0
  ) {
    return true;
  }
  return false;
}

export function parseSharePermissions(raw: unknown): SharePermissions | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!o.sections || typeof o.sections !== "object") return null;
  const base = defaultSharePermissions();
  const sections = { ...base.sections };
  for (const key of Object.keys(sections) as ShareSectionKey[]) {
    if (typeof (o.sections as Record<string, unknown>)[key] === "boolean") {
      sections[key] = Boolean((o.sections as Record<string, unknown>)[key]);
    }
  }
  const itemIds = emptyItemIds();
  const rawItems = o.itemIds as Record<string, unknown> | undefined;
  if (rawItems) {
    for (const k of Object.keys(itemIds) as (keyof ShareItemIds)[]) {
      if (Array.isArray(rawItems[k])) {
        itemIds[k] = (rawItems[k] as unknown[]).map(String);
      }
    }
  }
  const preset = (["buyer", "contractor", "insurance", "family", "custom"] as SharePresetId[]).includes(
    o.preset as SharePresetId
  )
    ? (o.preset as SharePresetId)
    : "custom";
  return { preset, sections, itemIds };
}

/** Infer permissions from a legacy snapshot that lacked an explicit permissions object. */
export function inferPermissionsFromSnapshot(snap: Record<string, unknown> | null): SharePermissions {
  const parsed = parseSharePermissions(snap?.permissions);
  if (parsed) return parsed;

  const sections = allSectionsFalse();
  sections.basicPropertyInfo = true;
  sections.propertyAddress = Boolean(
    String(snap?.fullAddress ?? snap?.address ?? "").trim()
  );
  const gallery = Array.isArray(snap?.gallery) ? (snap!.gallery as { id?: string }[]) : [];
  const repairs = Array.isArray(snap?.recentRepairs) ? (snap!.recentRepairs as { id?: string; cost?: string; contractor?: string }[]) : [];
  const maint = Array.isArray(snap?.maintenanceHistory)
    ? (snap!.maintenanceHistory as { id?: string }[])
    : [];
  const upcoming = Array.isArray(snap?.upcomingMaintenance)
    ? (snap!.upcomingMaintenance as { id?: string }[])
    : [];
  const apps = Array.isArray(snap?.appliances)
    ? (snap!.appliances as { id?: string; serial?: string; model?: string; photoUri?: string }[])
    : [];
  const docs = Array.isArray(snap?.documents)
    ? (snap!.documents as { id?: string; category?: string }[])
    : [];
  const warranties = Array.isArray(snap?.warranties) ? snap!.warranties : [];

  sections.propertyPhotos = gallery.length > 0 || Boolean(snap?.photoUri);
  sections.maintenanceHistory = maint.length > 0;
  sections.upcomingMaintenance = upcoming.length > 0;
  sections.completedRepairs = repairs.length > 0;
  sections.repairCosts = repairs.some((r) => Boolean(r.cost));
  sections.contractorContact = repairs.some((r) => Boolean(r.contractor));
  sections.appliances = apps.length > 0;
  sections.appliancePhotos = apps.some((a) => Boolean(a.photoUri));
  sections.applianceModelSerial = apps.some((a) => Boolean(a.serial || a.model));
  sections.documents = docs.length > 0;
  sections.warranties = Array.isArray(warranties) && warranties.length > 0;
  sections.receipts = docs.some((d) => d.category === "receipt");
  sections.inspectionReports = docs.some((d) => d.category === "inspection");
  sections.permits = docs.some((d) => d.category === "permit");
  sections.ownerMessage = Boolean(String(snap?.ownerMessage ?? "").trim());
  sections.ownerContact = Boolean(
    snap?.ownerContact && typeof snap.ownerContact === "object"
  );

  const itemIds = emptyItemIds();
  itemIds.photos = gallery.map((g) => String(g.id ?? "")).filter(Boolean);
  itemIds.repairs = repairs.map((r) => String(r.id ?? "")).filter(Boolean);
  itemIds.maintenance = [...maint, ...upcoming]
    .map((m) => String(m.id ?? ""))
    .filter(Boolean);
  itemIds.appliances = apps.map((a) => String(a.id ?? "")).filter(Boolean);
  itemIds.documents = docs.map((d) => String(d.id ?? "")).filter(Boolean);

  return { preset: "custom", sections, itemIds };
}
