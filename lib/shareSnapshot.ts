import type {
  Appliance,
  Document,
  MaintenanceItem,
  PhotoItem,
  Property,
  Repair,
} from "@/data/demoData";
import {
  defaultSharePermissions,
  parseSharePermissions,
  type SharePermissions,
} from "@/lib/sharePermissions";

export type ShareTimelineItem = {
  date: string;
  title: string;
  kind: "maintenance" | "repair";
  detail?: string;
};

export type ShareRepairItem = {
  id?: string;
  title: string;
  date: string;
  category?: string;
  cost?: string;
  contractor?: string;
  notes?: string;
};

export type ShareMaintenanceItem = {
  id?: string;
  title: string;
  lastCompleted?: string;
  nextDue?: string;
  category?: string;
  status?: string;
  priority?: string;
};

export type ShareApplianceItem = {
  id?: string;
  name: string;
  brand?: string;
  model?: string;
  serial?: string;
  installYear?: string;
  condition?: string;
  warrantyExpires?: string;
  photoUri?: string;
};

export type ShareGalleryItem = {
  id?: string;
  uri: string;
  caption: string;
  date?: string;
};

export type ShareDocItem = {
  id?: string;
  title: string;
  category: string;
  uploadDate?: string;
  expiresDate?: string;
};

export type ShareWarrantyItem = {
  id?: string;
  title: string;
  expiresDate?: string;
  source: "document" | "appliance" | "repair";
};

export type PropertyShareSnapshot = {
  version: 3;
  permissions: SharePermissions;
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
  ownerContact?: { email?: string; phone?: string };
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
  return String(value).trim();
}

function yearFromDate(value: string | undefined): string {
  const raw = display(value);
  if (!raw) return "";
  return raw.match(/(19|20)\d{2}/)?.[0] ?? "";
}

function parseSortableDate(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const t = Date.parse(value);
  if (!Number.isNaN(t)) return t;
  const m = value.match(/(19|20)\d{2}/);
  return m ? Date.parse(`Jan 1, ${m[0]}`) : 0;
}

function formatPropertyType(type: string | undefined): string {
  if (!type) return "";
  return PROPERTY_TYPE_LABELS[type] ?? type;
}

function fullAddress(p: Property): string {
  return [p.address, p.city, p.state, p.zip].map(display).filter(Boolean).join(", ");
}

function idSet(ids: string[]): Set<string> {
  return new Set(ids.filter(Boolean));
}

export type BuildShareSnapshotInput = {
  property: Property & { lotSize?: string };
  maintenanceItems: MaintenanceItem[];
  repairs: Repair[];
  appliances: Appliance[];
  documents: Document[];
  photos: PhotoItem[];
  permissions: SharePermissions;
  ownerMessage?: string;
  ownerEmail?: string;
  ownerPhone?: string;
};

export function buildPropertyShareSnapshot(input: BuildShareSnapshotInput): PropertyShareSnapshot {
  const {
    property,
    maintenanceItems,
    repairs,
    appliances,
    documents,
    photos,
    permissions,
    ownerMessage,
    ownerEmail,
    ownerPhone,
  } = input;
  const s = permissions.sections;
  const pid = property.id;

  const maintAll = maintenanceItems.filter((m) => m.propertyId === pid);
  const repairAll = repairs.filter((r) => r.propertyId === pid);
  const appAll = appliances.filter((a) => a.propertyId === pid);
  const photoAll = photos.filter((p) => p.propertyId === pid && Boolean(p.uri?.trim()));
  const docAll = documents.filter((d) => d.propertyId === pid);

  const maintIds = idSet(permissions.itemIds.maintenance);
  const repairIds = idSet(permissions.itemIds.repairs);
  const appIds = idSet(permissions.itemIds.appliances);
  const photoIds = idSet(permissions.itemIds.photos);
  const docIds = idSet(permissions.itemIds.documents);

  const maint = (s.maintenanceHistory || s.upcomingMaintenance
    ? maintAll.filter((m) => maintIds.has(m.id))
    : []) as MaintenanceItem[];
  const propRepairs = s.completedRepairs
    ? repairAll.filter((r) => repairIds.has(r.id))
    : [];
  const propApps = s.appliances ? appAll.filter((a) => appIds.has(a.id)) : [];
  const propPhotos = s.propertyPhotos ? photoAll.filter((p) => photoIds.has(p.id)) : [];

  const selectedDocs = docAll.filter((d) => docIds.has(d.id));
  const docsForShare = selectedDocs.filter((d) => {
    if (d.category === "receipt") return s.receipts;
    if (d.category === "inspection") return s.inspectionReports || s.documents;
    if (d.category === "permit") return s.permits || s.documents;
    if (d.category === "warranty") return s.warranties || s.documents;
    return s.documents;
  });

  const upcoming = s.upcomingMaintenance
    ? maint
        .filter((m) => m.status === "Upcoming" || m.status === "Due Soon" || m.status === "Overdue")
        .sort((a, b) => parseSortableDate(a.nextDue) - parseSortableDate(b.nextDue))
    : [];

  const completedMaint = s.maintenanceHistory
    ? maint
        .filter((m) => Boolean(m.lastCompleted?.trim()))
        .sort((a, b) => parseSortableDate(b.lastCompleted) - parseSortableDate(a.lastCompleted))
    : [];

  const recentRepairs: ShareRepairItem[] = propRepairs
    .sort((a, b) => parseSortableDate(b.date) - parseSortableDate(a.date))
    .slice(0, 40)
    .map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date,
      category: r.category,
      cost: s.repairCosts ? r.cost : undefined,
      contractor: s.contractorContact ? r.contractor : undefined,
      // Private notes never included
      notes: undefined,
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
    id: a.id,
    name: a.name,
    brand: a.brand,
    model: s.applianceModelSerial ? a.model : undefined,
    serial: s.applianceModelSerial ? a.serial : undefined,
    installYear: yearFromDate(a.installDate),
    condition: a.condition,
    warrantyExpires: s.warranties ? a.warrantyExpires : undefined,
    photoUri: s.appliancePhotos
      ? a.photoUris?.find((u) => Boolean(u?.trim())) || a.photoUri?.trim() || undefined
      : undefined,
  }));

  const gallery: ShareGalleryItem[] = propPhotos.map((p) => ({
    id: p.id,
    uri: p.uri,
    caption: p.caption || p.category || "Property photo",
    date: p.date,
  }));

  const docRows: ShareDocItem[] = docsForShare.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    uploadDate: d.uploadDate,
    expiresDate: d.expiresDate,
  }));

  const warranties: ShareWarrantyItem[] = [];
  if (s.warranties) {
    for (const d of docsForShare.filter((x) => x.category === "warranty")) {
      warranties.push({
        id: d.id,
        title: d.title,
        expiresDate: d.expiresDate,
        source: "document",
      });
    }
    for (const a of propApps.filter((x) => Boolean(x.warrantyExpires?.trim()))) {
      warranties.push({
        id: a.id,
        title: `${a.name} warranty`,
        expiresDate: a.warrantyExpires,
        source: "appliance",
      });
    }
    for (const r of propRepairs.filter((x) => Boolean(x.warrantyExpires?.trim()))) {
      warranties.push({
        id: r.id,
        title: `${r.title} warranty`,
        expiresDate: r.warrantyExpires,
        source: "repair",
      });
    }
  }

  const showBasic = s.basicPropertyInfo;
  const showAddress = s.propertyAddress;

  return {
    version: 3,
    permissions,
    nickname: showBasic
      ? display(property.nickname) || display(property.address) || "Shared property"
      : "Shared property",
    address: showAddress ? display(property.address) : "",
    city: showAddress ? display(property.city) : "",
    state: showAddress ? display(property.state) : "",
    zip: showAddress ? display(property.zip) : "",
    fullAddress: showAddress ? fullAddress(property) : "",
    propertyType: showBasic ? formatPropertyType(property.type) : "",
    yearBuilt: showBasic ? display(property.yearBuilt) : "",
    squareFootage: showBasic ? display(property.squareFeet) : "",
    bedrooms: showBasic ? display(property.bedrooms) : "",
    bathrooms: showBasic ? display(property.bathrooms) : "",
    lotSize: showBasic ? display(property.lotSize) : "",
    photoUri:
      s.propertyPhotos && property.photoUri?.trim() ? property.photoUri.trim() : undefined,
    ownerMessage: s.ownerMessage ? display(ownerMessage) || undefined : undefined,
    ownerContact: s.ownerContact
      ? {
          email: display(ownerEmail) || undefined,
          phone: display(ownerPhone) || undefined,
        }
      : undefined,
    counts: {
      maintenance: completedMaint.length + (s.upcomingMaintenance ? upcoming.length : 0),
      repairs: recentRepairs.length,
      appliances: applianceRows.length,
      documents: docRows.length,
      photos: gallery.length + (s.propertyPhotos && property.photoUri ? 1 : 0),
      warranties: warranties.length,
      upcomingMaintenance: upcoming.length,
    },
    timeline: s.maintenanceHistory || s.completedRepairs ? timeline : [],
    recentRepairs,
    maintenanceHistory: completedMaint.slice(0, 40).map((m) => ({
      id: m.id,
      title: m.title,
      lastCompleted: m.lastCompleted,
      category: m.category,
      status: m.status,
    })),
    upcomingMaintenance: upcoming.slice(0, 40).map((m) => ({
      id: m.id,
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

/** Client + RPC defense: strip anything not allowed by embedded permissions. */
export function sanitizeShareSnapshot(raw: unknown): PropertyShareSnapshot {
  const snap = normalizeShareSnapshot(raw);
  // Legacy v1/v2 snapshots (no permissions object) already contain only what was
  // stored at create time — do not re-strip against modern defaults.
  const rawObj =
    raw != null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  if (!rawObj?.permissions) {
    snap.recentRepairs = snap.recentRepairs.map((r) => ({ ...r, notes: undefined }));
    return snap;
  }

  const p = snap.permissions ?? defaultSharePermissions();
  const s = p.sections;

  if (!s.basicPropertyInfo) {
    snap.propertyType = "";
    snap.yearBuilt = "";
    snap.squareFootage = "";
    snap.bedrooms = "";
    snap.bathrooms = "";
    snap.lotSize = "";
    if (!s.propertyAddress) snap.nickname = "Shared property";
  }
  if (!s.propertyAddress) {
    snap.address = "";
    snap.city = "";
    snap.state = "";
    snap.zip = "";
    snap.fullAddress = "";
  }
  if (!s.propertyPhotos) {
    snap.photoUri = undefined;
    snap.gallery = [];
  }
  if (!s.maintenanceHistory) snap.maintenanceHistory = [];
  if (!s.upcomingMaintenance) snap.upcomingMaintenance = [];
  if (!s.completedRepairs) snap.recentRepairs = [];
  if (!s.maintenanceHistory && !s.completedRepairs) snap.timeline = [];
  if (!s.repairCosts) {
    snap.recentRepairs = snap.recentRepairs.map((r) => ({ ...r, cost: undefined }));
  }
  if (!s.contractorContact) {
    snap.recentRepairs = snap.recentRepairs.map((r) => ({ ...r, contractor: undefined }));
  }
  if (!s.appliances) snap.appliances = [];
  if (!s.appliancePhotos) {
    snap.appliances = snap.appliances.map((a) => ({ ...a, photoUri: undefined }));
  }
  if (!s.applianceModelSerial) {
    snap.appliances = snap.appliances.map((a) => ({
      ...a,
      model: undefined,
      serial: undefined,
    }));
  }
  if (!s.documents && !s.receipts && !s.inspectionReports && !s.permits && !s.warranties) {
    snap.documents = [];
  } else {
    snap.documents = snap.documents.filter((d) => {
      if (d.category === "receipt") return s.receipts;
      if (d.category === "inspection") return s.inspectionReports || s.documents;
      if (d.category === "permit") return s.permits || s.documents;
      if (d.category === "warranty") return s.warranties || s.documents;
      return s.documents;
    });
  }
  if (!s.warranties) snap.warranties = [];
  if (!s.ownerMessage) snap.ownerMessage = undefined;
  if (!s.ownerContact) snap.ownerContact = undefined;

  // Never leak private notes
  snap.recentRepairs = snap.recentRepairs.map((r) => ({ ...r, notes: undefined }));

  snap.counts = {
    maintenance: snap.maintenanceHistory.length + snap.upcomingMaintenance.length,
    repairs: snap.recentRepairs.length,
    appliances: snap.appliances.length,
    documents: snap.documents.length,
    photos: snap.gallery.length + (snap.photoUri ? 1 : 0),
    warranties: snap.warranties.length,
    upcomingMaintenance: snap.upcomingMaintenance.length,
  };
  snap.permissions = p;
  snap.version = 3;
  return snap;
}

export function normalizeShareSnapshot(raw: unknown): PropertyShareSnapshot {
  if (raw == null) return emptySnapshot();
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
  const permissions = parseSharePermissions(o.permissions) ?? defaultSharePermissions();

  const version = Number(o.version) || 1;
  if (version < 2) {
    const address = display(o.address);
    const city = display(o.city);
    const state = display(o.state);
    const zip = display(o.zip);
    return {
      ...emptySnapshot(),
      permissions: {
        ...defaultSharePermissions(),
        sections: {
          ...defaultSharePermissions().sections,
          basicPropertyInfo: true,
          propertyAddress: true,
        },
      },
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
        maintenance: num(o.maintenanceCount),
        repairs: num(o.repairCount),
        appliances: num(o.applianceCount),
        documents: 0,
        photos: 0,
        warranties: 0,
        upcomingMaintenance: 0,
      },
    };
  }

  const counts = (o.counts as PropertyShareSnapshot["counts"]) ?? emptySnapshot().counts;
  return {
    version: 3,
    permissions,
    nickname: display(o.nickname) || "Shared property",
    address: display(o.address),
    city: display(o.city),
    state: display(o.state),
    zip: display(o.zip),
    fullAddress:
      display(o.fullAddress) ||
      [o.address, o.city, o.state, o.zip].map(display).filter(Boolean).join(", "),
    propertyType: display(o.propertyType),
    yearBuilt: display(o.yearBuilt),
    squareFootage: display(o.squareFootage),
    bedrooms: display(o.bedrooms),
    bathrooms: display(o.bathrooms),
    lotSize: display(o.lotSize),
    photoUri: display(o.photoUri) || undefined,
    ownerMessage: display(o.ownerMessage) || undefined,
    ownerContact:
      o.ownerContact && typeof o.ownerContact === "object"
        ? {
            email: display((o.ownerContact as { email?: string }).email) || undefined,
            phone: display((o.ownerContact as { phone?: string }).phone) || undefined,
          }
        : undefined,
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
    version: 3,
    permissions: defaultSharePermissions(),
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
