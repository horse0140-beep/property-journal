import type {
  MaintenanceItem,
  Repair,
  Appliance,
  Document,
  Contractor,
  PaintColor,
  Property,
  PhotoItem,
} from "@/context/HomeWiseContext";
import { enrichRecommendation, sortByPriority, type RecommendationPriority, getCurrentSeason, SEASONAL_TIPS } from "@/lib/scoreMeta";

export type ScoreCategoryKey =
  | "roof"
  | "hvac"
  | "plumbing"
  | "electrical"
  | "foundation"
  | "exterior"
  | "interior"
  | "appliances"
  | "maintenance"
  | "safety"
  | "documents"
  | "warranty";

export type RecoverableAction = {
  label: string;
  points: number;
  route: string;
  params?: Record<string, string>;
  priority?: RecommendationPriority;
  estimatedTime?: string;
  valueImpact?: string;
};

export type ScoreCategoryInsight = {
  key: ScoreCategoryKey;
  label: string;
  score: number;
  icon: string;
  color: string;
  whyLow: string[];
  missingRecords: string[];
  overdueOrIssues: string[];
  relatedItems: string[];
  recommendations: string[];
  recoverableActions: RecoverableAction[];
  totalRecoverable: number;
  actionsRemaining: number;
  actionRoute: string;
  actionParams?: Record<string, string>;
  actionLabel: string;
  aiPrompt: string;
};

type CategoryDef = {
  key: ScoreCategoryKey;
  label: string;
  icon: string;
  color: string;
  matchMaint: (m: MaintenanceItem) => boolean;
  matchRepair: (r: Repair) => boolean;
  matchAppliance: (a: Appliance) => boolean;
  matchDoc: (d: Document) => boolean;
  defaultMissing: string[];
  fixRoute: string;
  fixParams?: Record<string, string>;
  fixLabel: string;
};

const CATEGORIES: CategoryDef[] = [
  {
    key: "roof",
    label: "Roof Score",
    icon: "home-outline",
    color: "#7C3AED",
    matchMaint: (m) => /roof|gutter|shingle/i.test(m.category + m.title),
    matchRepair: (r) => /roof|gutter|shingle/i.test(r.category + r.title),
    matchAppliance: () => false,
    matchDoc: (d) => /roof|gutter/i.test(d.title + d.notes),
    defaultMissing: ["Roof inspection report", "Roof warranty", "Gutter maintenance log"],
    fixRoute: "/(tabs)/vault",
    fixParams: { tab: "inspection" },
    fixLabel: "Upload Documents",
  },
  {
    key: "hvac",
    label: "HVAC Score",
    icon: "thermometer-outline",
    color: "#0284C7",
    matchMaint: (m) => /hvac|furnace|ac|air condition|heat pump/i.test(m.category + m.title),
    matchRepair: (r) => /hvac|furnace|ac|heat/i.test(r.category + r.title),
    matchAppliance: (a) => /hvac|furnace|ac|heat|air/i.test(a.category + a.name),
    matchDoc: (d) => /hvac|furnace|ac/i.test(d.title),
    defaultMissing: ["HVAC service record", "HVAC warranty", "Filter change schedule"],
    fixRoute: "/(tabs)/maintenance",
    fixParams: { tab: "schedule" },
    fixLabel: "Maintenance",
  },
  {
    key: "plumbing",
    label: "Plumbing Score",
    icon: "water-outline",
    color: "#2563EB",
    matchMaint: (m) => /plumb|water heater|drain|sewer/i.test(m.category + m.title),
    matchRepair: (r) => /plumb|water|drain|sewer|pipe/i.test(r.category + r.title),
    matchAppliance: (a) => /plumb|water heater/i.test(a.category + a.name),
    matchDoc: (d) => /plumb|water heater/i.test(d.title),
    defaultMissing: ["Plumbing inspection", "Water heater service log", "Contractor receipt"],
    fixRoute: "/(tabs)/maintenance",
    fixParams: { tab: "repairs" },
    fixLabel: "Repairs",
  },
  {
    key: "electrical",
    label: "Electrical Score",
    icon: "flash-outline",
    color: "#D97706",
    matchMaint: (m) => /electr|panel|wiring|outlet/i.test(m.category + m.title),
    matchRepair: (r) => /electr|panel|wiring|outlet/i.test(r.category + r.title),
    matchAppliance: () => false,
    matchDoc: (d) => /electr|panel/i.test(d.title),
    defaultMissing: ["Electrical panel photo", "Inspection report", "Electrician receipt"],
    fixRoute: "/vault/photos",
    fixLabel: "Photos",
  },
  {
    key: "foundation",
    label: "Foundation Score",
    icon: "layers-outline",
    color: "#64748B",
    matchMaint: (m) => /foundation|basement|crawl|structural/i.test(m.category + m.title),
    matchRepair: (r) => /foundation|basement|structural|crack/i.test(r.category + r.title),
    matchAppliance: () => false,
    matchDoc: (d) => /foundation|structural/i.test(d.title),
    defaultMissing: ["Foundation inspection", "Structural repair history", "Basement moisture log"],
    fixRoute: "/(tabs)/vault",
    fixParams: { tab: "inspection" },
    fixLabel: "Documents",
  },
  {
    key: "exterior",
    label: "Exterior Score",
    icon: "leaf-outline",
    color: "#16A34A",
    matchMaint: (m) => /exterior|landscap|siding|driveway|deck|fence/i.test(m.category + m.title),
    matchRepair: (r) => /exterior|siding|deck|fence|landscap/i.test(r.category + r.title),
    matchAppliance: () => false,
    matchDoc: (d) => /exterior|siding|landscap/i.test(d.title),
    defaultMissing: ["Exterior maintenance log", "Landscaping schedule", "Siding/deck photos"],
    fixRoute: "/(tabs)/maintenance",
    fixParams: { tab: "schedule" },
    fixLabel: "Maintenance",
  },
  {
    key: "interior",
    label: "Interior Score",
    icon: "color-palette-outline",
    color: "#EC4899",
    matchMaint: (m) => /interior|paint|floor|drywall/i.test(m.category + m.title),
    matchRepair: (r) => /interior|paint|floor|drywall/i.test(r.category + r.title),
    matchAppliance: () => false,
    matchDoc: (d) => /paint|interior|floor/i.test(d.title),
    defaultMissing: ["Paint color records", "Flooring warranty", "Interior repair history"],
    fixRoute: "/(tabs)/maintenance",
    fixParams: { tab: "paint" },
    fixLabel: "Paint Colors",
  },
  {
    key: "appliances",
    label: "Appliances Score",
    icon: "hardware-chip-outline",
    color: "#F59E0B",
    matchMaint: (m) => /appliance/i.test(m.category),
    matchRepair: (r) => /appliance/i.test(r.category),
    matchAppliance: () => true,
    matchDoc: (d) => d.category === "warranty" || d.category === "manual",
    defaultMissing: ["Appliance serial numbers", "Install dates", "Warranty documents"],
    fixRoute: "/(tabs)/maintenance",
    fixParams: { tab: "appliances" },
    fixLabel: "Appliances",
  },
  {
    key: "maintenance",
    label: "Maintenance Score",
    icon: "construct-outline",
    color: "#1A3C8F",
    matchMaint: () => true,
    matchRepair: () => false,
    matchAppliance: () => false,
    matchDoc: () => false,
    defaultMissing: ["Scheduled maintenance tasks", "Seasonal checklists", "Contractor contacts"],
    fixRoute: "/(tabs)/maintenance",
    fixParams: { tab: "schedule" },
    fixLabel: "Maintenance",
  },
  {
    key: "safety",
    label: "Safety Score",
    icon: "shield-checkmark-outline",
    color: "#DC2626",
    matchMaint: (m) => /smoke|co detector|carbon|fire|extinguisher|alarm|safety/i.test(m.category + m.title),
    matchRepair: (r) => /smoke|detector|fire|safety/i.test(r.category + r.title),
    matchAppliance: () => false,
    matchDoc: (d) => /smoke|fire|safety|insurance/i.test(d.title + d.category),
    defaultMissing: ["Smoke detector battery log", "CO detector check", "Fire extinguisher inspection"],
    fixRoute: "/(tabs)/maintenance",
    fixParams: { tab: "schedule" },
    fixLabel: "Add Safety Task",
  },
  {
    key: "documents",
    label: "Document Score",
    icon: "folder-open-outline",
    color: "#6366F1",
    matchMaint: () => false,
    matchRepair: () => false,
    matchAppliance: () => false,
    matchDoc: (d) => ["inspection", "permit", "manual", "contract", "insurance"].includes(d.category),
    defaultMissing: ["Home inspection report", "Permits", "Insurance policy", "Appliance manuals"],
    fixRoute: "/(tabs)/vault",
    fixParams: { tab: "inspection" },
    fixLabel: "Document Vault",
  },
  {
    key: "warranty",
    label: "Warranty Score",
    icon: "document-text-outline",
    color: "#0D9488",
    matchMaint: () => false,
    matchRepair: () => false,
    matchAppliance: (a) => !!a.warrantyExpires,
    matchDoc: (d) => d.category === "warranty",
    defaultMissing: ["Appliance warranties", "Roof warranty", "HVAC warranty"],
    fixRoute: "/(tabs)/vault",
    fixParams: { tab: "warranty" },
    fixLabel: "Warranties",
  },
];

function computeCategoryScore(
  def: CategoryDef,
  maintenance: MaintenanceItem[],
  repairs: Repair[],
  appliances: Appliance[],
  documents: Document[],
  paintColors: PaintColor[],
  photos: PhotoItem[]
): number {
  if (def.key === "maintenance") {
    const overdue = maintenance.filter((m) => m.status === "Overdue").length;
    const dueSoon = maintenance.filter((m) => m.status === "Due Soon").length;
    if (maintenance.length === 0) return 55;
    return Math.max(40, 100 - overdue * 12 - dueSoon * 5);
  }

  if (def.key === "appliances") {
    if (appliances.length === 0) return 58;
    const condMap: Record<string, number> = {
      Excellent: 100,
      Good: 85,
      Fair: 70,
      Poor: 45,
      "Replace Soon": 30,
    };
    return Math.round(
      appliances.reduce((acc, a) => acc + (condMap[a.condition] ?? 70), 0) / appliances.length
    );
  }

  if (def.key === "interior") {
    let score = 55;
    if (paintColors.length > 0) score += 15;
    if (repairs.some(def.matchRepair)) score += 10;
    if (maintenance.some(def.matchMaint)) score += 10;
    return Math.min(100, score);
  }

  if (def.key === "documents") {
    const docs = documents.filter(def.matchDoc);
    const inspections = documents.filter((d) => d.category === "inspection");
    if (inspections.length === 0 && docs.length === 0) return 52;
    return Math.min(100, 55 + docs.length * 8 + (inspections.length > 0 ? 12 : 0));
  }

  if (def.key === "warranty") {
    const warranties = documents.filter((d) => d.category === "warranty");
    const withWarranty = appliances.filter((a) => a.warrantyExpires).length;
    if (warranties.length === 0 && withWarranty === 0) return 50;
    return Math.min(100, 60 + warranties.length * 10 + withWarranty * 3);
  }

  if (def.key === "safety") {
    const safetyMaint = maintenance.filter(def.matchMaint);
    if (safetyMaint.length === 0) return 48;
    const overdue = safetyMaint.filter((m) => m.status === "Overdue").length;
    return Math.max(45, 88 - overdue * 15);
  }

  const catMaint = maintenance.filter(def.matchMaint);
  const catRepairs = repairs.filter(def.matchRepair);
  const catDocs = documents.filter(def.matchDoc);
  const catApps = appliances.filter(def.matchAppliance);
  const hasPhoto =
    def.key === "electrical"
      ? photos.some((p) => /electrical|panel/i.test(p.caption ?? ""))
      : def.key === "roof"
        ? photos.some((p) => /roof/i.test(p.caption ?? ""))
        : false;

  let score = 52;
  if (catMaint.length > 0) score += 18;
  if (catRepairs.length > 0) score += 12;
  if (catDocs.length > 0) score += 10;
  if (catApps.length > 0) score += 8;
  if (hasPhoto) score += 8;
  score -= catMaint.filter((m) => m.status === "Overdue").length * 10;

  return Math.max(35, Math.min(100, Math.round(score)));
}

function buildRecoverableActions(
  def: CategoryDef,
  score: number,
  maintenance: MaintenanceItem[],
  repairs: Repair[],
  appliances: Appliance[],
  documents: Document[],
  paintColors: PaintColor[],
  photos: PhotoItem[]
): RecoverableAction[] {
  const actions: RecoverableAction[] = [];
  const gap = 100 - score;
  const catMaint = maintenance.filter(def.matchMaint);

  if (def.key === "roof") {
    if (!documents.some((d) => d.category === "inspection" && /roof/i.test(d.title))) {
      actions.push({ label: "Add roof inspection report", points: Math.min(10, gap), route: "/(tabs)/vault", params: { tab: "inspection" } });
    }
    if (!documents.some((d) => d.category === "warranty" && /roof/i.test(d.title))) {
      actions.push({ label: "Add roof warranty", points: Math.min(8, gap), route: "/(tabs)/vault", params: { tab: "warranty" } });
    }
    if (catMaint.length === 0) {
      actions.push({ label: "Schedule roof/gutter maintenance", points: Math.min(6, gap), route: "/(tabs)/maintenance", params: { tab: "schedule" } });
    }
  } else if (def.key === "hvac") {
    if (catMaint.length === 0) {
      actions.push({ label: "Schedule HVAC service", points: Math.min(10, gap), route: "/(tabs)/maintenance", params: { tab: "schedule" } });
    }
    if (!documents.some((d) => /hvac/i.test(d.title) && d.category === "warranty")) {
      actions.push({ label: "Upload HVAC warranty", points: Math.min(8, gap), route: "/(tabs)/vault", params: { tab: "warranty" } });
    }
  } else if (def.key === "safety") {
    if (!maintenance.some((m) => /smoke|detector/i.test(m.title))) {
      actions.push({ label: "Add smoke detector check", points: Math.min(10, gap), route: "/(tabs)/maintenance", params: { tab: "schedule" } });
    }
    if (!photos.some((p) => /panel|detector|extinguisher/i.test(p.caption ?? ""))) {
      actions.push({ label: "Photograph safety equipment", points: Math.min(5, gap), route: "/vault/photos" });
    }
  } else if (def.key === "appliances") {
    if (appliances.length === 0) {
      actions.push({ label: "Add appliances", points: Math.min(15, gap), route: "/(tabs)/maintenance", params: { tab: "appliances" } });
    }
    if (appliances.some((a) => !a.serial)) {
      actions.push({ label: "Add appliance serial numbers", points: Math.min(6, gap), route: "/(tabs)/maintenance", params: { tab: "appliances" } });
    }
    if (!documents.some((d) => d.category === "warranty")) {
      actions.push({ label: "Upload appliance warranties", points: Math.min(8, gap), route: "/(tabs)/vault", params: { tab: "warranty" } });
    }
  } else if (def.key === "maintenance") {
    const overdue = maintenance.filter((m) => m.status === "Overdue");
    if (overdue.length > 0) {
      actions.push({ label: `Complete ${overdue.length} overdue task(s)`, points: Math.min(overdue.length * 8, gap), route: "/(tabs)/maintenance", params: { tab: "schedule" } });
    }
    if (maintenance.length === 0) {
      actions.push({ label: "Create maintenance schedule", points: Math.min(12, gap), route: "/(tabs)/maintenance", params: { tab: "schedule" } });
    }
  } else if (def.key === "documents") {
    if (!documents.some((d) => d.category === "inspection")) {
      actions.push({ label: "Upload home inspection report", points: Math.min(12, gap), route: "/(tabs)/vault", params: { tab: "inspection" } });
    }
  } else if (def.key === "warranty") {
    if (!documents.some((d) => d.category === "warranty")) {
      actions.push({ label: "Upload warranty documents", points: Math.min(12, gap), route: "/(tabs)/vault", params: { tab: "warranty" } });
    }
  } else if (def.key === "interior" && paintColors.length === 0) {
    actions.push({ label: "Record paint colors", points: Math.min(8, gap), route: "/(tabs)/maintenance", params: { tab: "paint" } });
  } else {
    if (catMaint.length === 0) {
      actions.push({ label: `Schedule ${def.label.replace(" Score", "")} maintenance`, points: Math.min(8, gap), route: def.fixRoute, params: def.fixParams });
    }
    if (repairs.filter(def.matchRepair).length === 0) {
      actions.push({ label: "Log related repair history", points: Math.min(6, gap), route: "/(tabs)/maintenance", params: { tab: "repairs" } });
    }
  }

  return actions.filter((a) => a.points > 0).slice(0, 4);
}

function buildWhyLow(
  def: CategoryDef,
  score: number,
  maintenance: MaintenanceItem[],
  repairs: Repair[],
  appliances: Appliance[],
  documents: Document[],
  property?: Property
): string[] {
  const reasons: string[] = [];
  const catMaint = maintenance.filter(def.matchMaint);
  const overdue = catMaint.filter((m) => m.status === "Overdue");

  if (def.key === "roof") {
    if (!documents.some((d) => d.category === "inspection" && /roof/i.test(d.title))) {
      reasons.push("No roof inspection recorded in the last 3 years.");
    }
    if (property?.yearBuilt) {
      const age = new Date().getFullYear() - parseInt(property.yearBuilt, 10);
      if (!Number.isNaN(age) && age > 15 && repairs.filter(def.matchRepair).length === 0) {
        reasons.push(`Home built ${age} years ago — roof may be nearing end of typical lifespan.`);
      }
    }
    if (!documents.some((d) => d.category === "warranty" && /roof/i.test(d.title))) {
      reasons.push("No roof warranty information on file.");
    }
  }

  if (overdue.length > 0) {
    reasons.push(`${overdue.length} overdue task(s) in this category.`);
  }

  if (def.key === "appliances") {
    const poor = appliances.filter((a) => ["Poor", "Replace Soon", "Fair"].includes(a.condition));
    if (poor.length > 0) reasons.push(`${poor.length} appliance(s) need attention.`);
    if (appliances.length === 0) reasons.push("No appliances logged yet.");
  }

  if (def.key === "safety" && catMaint.length === 0) {
    reasons.push("No smoke/CO detector or safety checks scheduled.");
  }

  if (def.key === "documents" && !documents.some((d) => d.category === "inspection")) {
    reasons.push("Missing home inspection report.");
  }

  if (def.key === "warranty" && !documents.some((d) => d.category === "warranty")) {
    reasons.push("No warranty documents uploaded.");
  }

  if (reasons.length === 0) {
    if (score >= 85) reasons.push("Strong coverage — keep records up to date.");
    else if (score >= 70) reasons.push("Good progress — a few records would boost this score.");
    else reasons.push("Limited records for this category.");
  }

  return reasons;
}

function buildRecommendations(def: CategoryDef, maintenance: MaintenanceItem[], appliances: Appliance[]): string[] {
  const recs: string[] = [];
  const catMaint = maintenance.filter(def.matchMaint);

  if (def.key === "roof") recs.push("Schedule a professional roof inspection.");
  if (def.key === "hvac") {
    recs.push("Replace HVAC filters every 90 days.");
    if (catMaint.length === 0) recs.push("Book annual HVAC tune-up.");
  }
  if (def.key === "safety") {
    recs.push("Replace smoke detector batteries twice per year.");
    recs.push("Test CO detectors monthly.");
  }
  if (def.key === "electrical") recs.push("Photograph your electrical panel and main breaker.");
  if (def.key === "appliances") {
    const n = appliances.filter((a) => !a.serial).length;
    if (n > 0) recs.push(`Add serial numbers for ${n} appliance(s).`);
  }
  if (def.key === "plumbing" && catMaint.length === 0) {
    recs.push("Flush water heater and check for leaks annually.");
  }

  const season = getCurrentSeason();
  const seasonTips = SEASONAL_TIPS[season];
  if (def.key === "hvac" && seasonTips[0]) recs.unshift(seasonTips[0]);
  if ((def.key === "roof" || def.key === "exterior") && seasonTips[1]) recs.unshift(seasonTips[1]);
  if (def.key === "safety" && season === "fall" && seasonTips[2]) recs.unshift(seasonTips[2]);

  if (recs.length === 0) {
    recs.push(`Keep ${def.label.replace(" Score", "").toLowerCase()} records current after each service.`);
  }

  return recs.slice(0, 4);
}

export type ScoreInsightInput = {
  property?: Property;
  maintenance: MaintenanceItem[];
  repairs: Repair[];
  appliances: Appliance[];
  documents: Document[];
  contractors: Contractor[];
  paintColors: PaintColor[];
  photos: PhotoItem[];
};

export function buildAllScoreCategoryInsights(input: ScoreInsightInput): ScoreCategoryInsight[] {
  const { property, maintenance, repairs, appliances, documents, contractors, paintColors, photos } = input;

  return CATEGORIES.map((def) => {
    const score = computeCategoryScore(def, maintenance, repairs, appliances, documents, paintColors, photos);
    const rawActions = buildRecoverableActions(def, score, maintenance, repairs, appliances, documents, paintColors, photos);
    const recoverableActions = sortByPriority(
      rawActions.map((a) => enrichRecommendation(a, def.key, def.label))
    );
    const totalRecoverable = recoverableActions.reduce((s, a) => s + a.points, 0);
    const catMaint = maintenance.filter(def.matchMaint);
    const overdue = catMaint.filter((m) => m.status === "Overdue");
    const catDocs = documents.filter(def.matchDoc);

    const missingRecords = def.defaultMissing.filter((m) => {
      if (m.includes("inspection") && catDocs.some((d) => d.category === "inspection")) return false;
      if (m.includes("warranty") && catDocs.some((d) => d.category === "warranty")) return false;
      if (m.includes("maintenance") && catMaint.length > 0) return false;
      if (m.includes("Appliance") && appliances.length > 0) return false;
      if (m.includes("Paint") && paintColors.length > 0) return false;
      if (m.includes("Contractor") && contractors.length > 0) return false;
      return true;
    });

    return {
      key: def.key,
      label: def.label,
      score,
      icon: def.icon,
      color: def.color,
      whyLow: buildWhyLow(def, score, maintenance, repairs, appliances, documents, property),
      missingRecords,
      overdueOrIssues: overdue.map((m) => `${m.title} — Overdue`),
      relatedItems: [
        ...catMaint.slice(0, 3).map((m) => `${m.title} (${m.status})`),
        ...repairs.filter(def.matchRepair).slice(0, 2).map((r) => r.title),
        ...appliances.filter(def.matchAppliance).slice(0, 2).map((a) => `${a.name} (${a.condition})`),
      ].slice(0, 6),
      recommendations: buildRecommendations(def, maintenance, appliances),
      recoverableActions,
      totalRecoverable,
      actionsRemaining: recoverableActions.length,
      actionRoute: def.fixRoute,
      actionParams: def.fixParams,
      actionLabel: def.fixLabel,
      aiPrompt: `Explain my ${def.label} (${score}/100) for ${property?.address ?? "my home"}. Why does it matter, how can I improve it, and which actions give the best cost vs benefit?`,
    };
  });
}

export function getCategoryInsight(key: ScoreCategoryKey, input: ScoreInsightInput): ScoreCategoryInsight | undefined {
  return buildAllScoreCategoryInsights(input).find((i) => i.key === key);
}

export function computeOverallFromCategories(insights: ScoreCategoryInsight[]): number {
  const weights: Partial<Record<ScoreCategoryKey, number>> = {
    maintenance: 0.15,
    appliances: 0.12,
    roof: 0.1,
    hvac: 0.1,
    plumbing: 0.08,
    electrical: 0.06,
    safety: 0.08,
    warranty: 0.08,
    documents: 0.08,
    exterior: 0.05,
    foundation: 0.05,
    interior: 0.05,
  };
  let total = 0;
  let wSum = 0;
  for (const i of insights) {
    const w = weights[i.key] ?? 0.05;
    total += i.score * w;
    wSum += w;
  }
  return Math.round(total / wSum);
}
