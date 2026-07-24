import type {
  Appliance,
  Document,
  MaintenanceItem,
  PhotoItem,
  Property,
  Repair,
} from "@/data/demoData";

export type ShareTimelineItem = {
  date: string;
  title: string;
  kind: "maintenance" | "repair";
  detail?: string;
};

export type ShareRepairItem = {
  title: string;
  date: string;
  category?: string;
  cost?: string;
  notes?: string;
};

export type ShareMaintenanceItem = {
  title: string;
  lastCompleted?: string;
  nextDue?: string;
  category?: string;
  status?: string;
  priority?: string;
};

export type ShareApplianceItem = {
  name: string;
  brand?: string;
  model?: string;
  installYear?: string;
  condition?: string;
  warrantyExpires?: string;
  photoUri?: string;
};

export type ShareGalleryItem = {
  uri: string;
  caption: string;
  date?: string;
};

export type ShareDocItem = {
  title: string;
  category: string;
  uploadDate?: string;
  expiresDate?: string;
};

export type ShareWarrantyItem = {
  title: string;
  expiresDate?: string;
  source: "document" | "appliance" | "repair";
};

export type PropertyShareSnapshot = {
  version: 2;
  nickname: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  fullAddress: string;
  propertyType: string;
  yearBuilt: string;
  squareFootage: string;
  bedrooms: string;
  bathrooms: string;
  lotSize: string;
  photoUri?: string;
  ownerMessage?: string;
  counts: {
    maintenance: number;
    repairs: number;
    appliances: number;
    documents: number;
    photos: number;
    warranties: number;
    upcomingMaintenance: number;
  };
  timeline: ShareTimelineItem[];
  recentRepairs: ShareRepairItem[];
  maintenanceHistory: ShareMaintenanceItem[];
  upcomingMaintenance: ShareMaintenanceItem[];
  appliances: ShareApplianceItem[];
  gallery: ShareGalleryItem[];
  documents: ShareDocItem[];
  warranties: ShareWarrantyItem[];
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  primary: "Primary Residence",
  rental: "Rental",
  vacation: "Vacation Home",
  investment: "Investment",
};

function display(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  return s;
}

function yearFromDate(value: string | undefined): string {
  const raw = display(value);
  if (!raw) return "";
  const match = raw.match(/(19|20)\d{2}/);
  return match?.[0] ?? "";
}

function parseSortableDate(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const t = Date.parse(value);
  if (!Number.isNaN(t)) return t;
  // Fallback for labels like "Nov 2024"
  const m = value.match(/(19|20)\d{2}/);
  return m ? Date.parse(`Jan 1, ${m[0]}`) : 0;
}

/** Documents treated as shareable for public links (no personal receipts by default). */
export function isShareableDocument(doc: Document, includePersonalInfo: boolean): boolean {
  const tags = (doc.tags ?? []).map((t) => t.toLowerCase());
  if (tags.includes("private") || tags.includes("personal")) return false;
  if (tags.includes("shareable") || tags.includes("public")) return true;
  if (["warranty", "inspection", "permit", "manual"].includes(doc.category)) return true;
  if (!includePersonalInfo && ["receipt", "contract", "insurance", "other"].includes(doc.category)) {
    return false;
  }
  return includePersonalInfo;
}

function formatPropertyType(type: string | undefined): string {
  if (!type) return "";
  return PROPERTY_TYPE_LABELS[type] ?? type;
}

function fullAddress(p: Property): string {
  return [p.address, p.city, p.state, p.zip].map(display).filter(Boolean).join(", ");
}

export type BuildShareSnapshotInput = {
  property: Property & { lotSize?: string };
  maintenanceItems: MaintenanceItem[];
  repairs: Repair[];
  appliances: Appliance[];
  documents: Document[];
  photos: PhotoItem[];
  includePersonalInfo: boolean;
  ownerMessage?: string;
};

export function buildPropertyShareSnapshot(input: BuildShareSnapshotInput): PropertyShareSnapshot {
  const {
    property,
    maintenanceItems,
    repairs,
    appliances,
    documents,
    photos,
    includePersonalInfo,
    ownerMessage,
  } = input;

  const pid = property.id;
  const maint = maintenanceItems.filter((m) => m.propertyId === pid);
  const propRepairs = repairs.filter((r) => r.propertyId === pid);
  const propApps = appliances.filter((a) => a.propertyId === pid);
  const propPhotos = photos.filter((p) => p.propertyId === pid && Boolean(p.uri?.trim()));
  const shareableDocs = documents.filter(
    (d) => d.propertyId === pid && isShareableDocument(d, includePersonalInfo)
  );

  const upcoming = maint
    .filter((m) => m.status === "Upcoming" || m.status === "Due Soon" || m.status === "Overdue")
    .sort((a, b) => parseSortableDate(a.nextDue) - parseSortableDate(b.nextDue));

  const completedMaint = maint
    .filter((m) => Boolean(m.lastCompleted?.trim()))
    .sort((a, b) => parseSortableDate(b.lastCompleted) - parseSortableDate(a.lastCompleted));

  const recentRepairs = [...propRepairs]
    .sort((a, b) => parseSortableDate(b.date) - parseSortableDate(a.date))
    .slice(0, 12)
    .map((r) => ({
      title: r.title,
      date: r.date,
      category: r.category,
      cost: includePersonalInfo ? r.cost : undefined,
      notes: r.notes,
    }));

  const timeline: ShareTimelineItem[] = [
    ...completedMaint.map((m) => ({
      date: m.lastCompleted,
      title: m.title,
      kind: "maintenance" as const,
      detail: m.category,
    })),
    ...propRepairs.map((r) => ({
      date: r.date,
      title: r.title,
      kind: "repair" as const,
      detail: r.category,
    })),
  ]
    .filter((t) => Boolean(t.date?.trim()))
    .sort((a, b) => parseSortableDate(b.date) - parseSortableDate(a.date))
    .slice(0, 40);

  const applianceRows: ShareApplianceItem[] = propApps.map((a) => ({
    name: a.name,
    brand: a.brand,
    model: a.model,
    installYear: yearFromDate(a.installDate),
    condition: a.condition,
    warrantyExpires: a.warrantyExpires,
    photoUri:
      a.photoUris?.find((u) => Boolean(u?.trim())) || a.photoUri?.trim() || undefined,
  }));

  const gallery: ShareGalleryItem[] = propPhotos.map((p) => ({
    uri: p.uri,
    caption: p.caption || p.category || "Property photo",
    date: p.date,
  }));

  const docRows: ShareDocItem[] = shareableDocs.map((d) => ({
    title: d.title,
    category: d.category,
    uploadDate: d.uploadDate,
    expiresDate: d.expiresDate,
  }));

  const warrantyDocs = shareableDocs
    .filter((d) => d.category === "warranty")
    .map(
      (d): ShareWarrantyItem => ({
        title: d.title,
        expiresDate: d.expiresDate,
        source: "document",
      })
    );

  const warrantyApps = propApps
    .filter((a) => Boolean(a.warrantyExpires?.trim()))
    .map(
      (a): ShareWarrantyItem => ({
        title: `${a.name} warranty`,
        expiresDate: a.warrantyExpires,
        source: "appliance",
      })
    );

  const warrantyRepairs = propRepairs
    .filter((r) => Boolean(r.warrantyExpires?.trim()))
    .map(
      (r): ShareWarrantyItem => ({
        title: `${r.title} warranty`,
        expiresDate: r.warrantyExpires,
        source: "repair",
      })
    );

  const warranties = [...warrantyDocs, ...warrantyApps, ...warrantyRepairs];

  return {
    version: 2,
    nickname: display(property.nickname) || display(property.address) || "Shared property",
    address: display(property.address),
    city: display(property.city),
    state: display(property.state),
    zip: display(property.zip),
    fullAddress: fullAddress(property),
    propertyType: formatPropertyType(property.type),
    yearBuilt: display(property.yearBuilt),
    squareFootage: display(property.squareFeet),
    bedrooms: display(property.bedrooms),
    bathrooms: display(property.bathrooms),
    lotSize: display(property.lotSize),
    photoUri: property.photoUri?.trim() || undefined,
    ownerMessage: display(ownerMessage) || undefined,
    counts: {
      maintenance: maint.length,
      repairs: propRepairs.length,
      appliances: propApps.length,
      documents: shareableDocs.length,
      photos: propPhotos.length + (property.photoUri ? 1 : 0),
      warranties: warranties.length,
      upcomingMaintenance: upcoming.length,
    },
    timeline,
    recentRepairs,
    maintenanceHistory: completedMaint.slice(0, 20).map((m) => ({
      title: m.title,
      lastCompleted: m.lastCompleted,
      category: m.category,
      status: m.status,
    })),
    upcomingMaintenance: upcoming.slice(0, 20).map((m) => ({
      title: m.title,
      nextDue: m.nextDue,
      status: m.status,
      priority: m.priority,
      category: m.category,
    })),
    appliances: applianceRows,
    gallery,
    documents: docRows,
    warranties,
  };
}

/** Normalize RPC/legacy snapshot payloads for the public share page. */
export function normalizeShareSnapshot(raw: unknown): PropertyShareSnapshot {
  if (raw == null) {
    return emptySnapshot();
  }
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return emptySnapshot();
    }
  }
  if (typeof value !== "object" || Array.isArray(value)) return emptySnapshot();
  const o = value as Record<string, unknown>;

  // Legacy v1 snapshots (counts + address only)
  if (o.version !== 2) {
    const address = display(o.address);
    const city = display(o.city);
    const state = display(o.state);
    const zip = display(o.zip);
    return {
      ...emptySnapshot(),
      nickname: display(o.nickname) || address || "Shared property",
      address,
      city,
      state,
      zip,
      fullAddress: [address, city, state, zip].filter(Boolean).join(", "),
      propertyType: display(o.propertyType) || display(o.type),
      yearBuilt: display(o.yearBuilt),
      squareFootage: display(o.squareFootage) || display(o.squareFeet),
      bedrooms: display(o.bedrooms),
      bathrooms: display(o.bathrooms),
      lotSize: display(o.lotSize),
      photoUri: display(o.photoUri) || undefined,
      ownerMessage: display(o.ownerMessage) || undefined,
      counts: {
        maintenance: num(o.maintenanceCount ?? (o.counts as { maintenance?: number })?.maintenance),
        repairs: num(o.repairCount ?? (o.counts as { repairs?: number })?.repairs),
        appliances: num(o.applianceCount ?? (o.counts as { appliances?: number })?.appliances),
        documents: num((o.counts as { documents?: number })?.documents),
        photos: num((o.counts as { photos?: number })?.photos),
        warranties: num((o.counts as { warranties?: number })?.warranties),
        upcomingMaintenance: num((o.counts as { upcomingMaintenance?: number })?.upcomingMaintenance),
      },
    };
  }

  const counts = (o.counts as PropertyShareSnapshot["counts"]) ?? emptySnapshot().counts;
  return {
    version: 2,
    nickname: display(o.nickname) || "Shared property",
    address: display(o.address),
    city: display(o.city),
    state: display(o.state),
    zip: display(o.zip),
    fullAddress: display(o.fullAddress) || [o.address, o.city, o.state, o.zip].map(display).filter(Boolean).join(", "),
    propertyType: display(o.propertyType),
    yearBuilt: display(o.yearBuilt),
    squareFootage: display(o.squareFootage),
    bedrooms: display(o.bedrooms),
    bathrooms: display(o.bathrooms),
    lotSize: display(o.lotSize),
    photoUri: display(o.photoUri) || undefined,
    ownerMessage: display(o.ownerMessage) || undefined,
    counts: {
      maintenance: num(counts.maintenance),
      repairs: num(counts.repairs),
      appliances: num(counts.appliances),
      documents: num(counts.documents),
      photos: num(counts.photos),
      warranties: num(counts.warranties),
      upcomingMaintenance: num(counts.upcomingMaintenance),
    },
    timeline: Array.isArray(o.timeline) ? (o.timeline as ShareTimelineItem[]) : [],
    recentRepairs: Array.isArray(o.recentRepairs) ? (o.recentRepairs as ShareRepairItem[]) : [],
    maintenanceHistory: Array.isArray(o.maintenanceHistory)
      ? (o.maintenanceHistory as ShareMaintenanceItem[])
      : [],
    upcomingMaintenance: Array.isArray(o.upcomingMaintenance)
      ? (o.upcomingMaintenance as ShareMaintenanceItem[])
      : [],
    appliances: Array.isArray(o.appliances) ? (o.appliances as ShareApplianceItem[]) : [],
    gallery: Array.isArray(o.gallery) ? (o.gallery as ShareGalleryItem[]) : [],
    documents: Array.isArray(o.documents) ? (o.documents as ShareDocItem[]) : [],
    warranties: Array.isArray(o.warranties) ? (o.warranties as ShareWarrantyItem[]) : [],
  };
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function emptySnapshot(): PropertyShareSnapshot {
  return {
    version: 2,
    nickname: "Shared property",
    address: "",
    city: "",
    state: "",
    zip: "",
    fullAddress: "",
    propertyType: "",
    yearBuilt: "",
    squareFootage: "",
    bedrooms: "",
    bathrooms: "",
    lotSize: "",
    counts: {
      maintenance: 0,
      repairs: 0,
      appliances: 0,
      documents: 0,
      photos: 0,
      warranties: 0,
      upcomingMaintenance: 0,
    },
    timeline: [],
    recentRepairs: [],
    maintenanceHistory: [],
    upcomingMaintenance: [],
    appliances: [],
    gallery: [],
    documents: [],
    warranties: [],
  };
}
