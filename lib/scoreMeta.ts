import type { RecoverableAction, ScoreCategoryKey } from "@/lib/scoreCategories";

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export type EnrichedRecommendation = RecoverableAction & {
  priority: RecommendationPriority;
  estimatedTime: string;
  valueImpact: string;
  categoryKey?: ScoreCategoryKey;
  categoryLabel?: string;
};

export const PRIORITY_ORDER: Record<RecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const PRIORITY_LABEL: Record<RecommendationPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PRIORITY_EMOJI: Record<RecommendationPriority, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

export const CATEGORY_WEIGHTS: { key: ScoreCategoryKey; label: string; weight: number; tip: string }[] = [
  { key: "maintenance", label: "Maintenance", weight: 15, tip: "Complete scheduled tasks and clear overdue items." },
  { key: "appliances", label: "Appliances", weight: 12, tip: "Log appliances with serial numbers and warranty dates." },
  { key: "roof", label: "Roof", weight: 10, tip: "Upload inspections and schedule gutter/roof service." },
  { key: "hvac", label: "HVAC", weight: 10, tip: "Annual tune-ups and filter changes boost this score." },
  { key: "plumbing", label: "Plumbing", weight: 8, tip: "Document water heater service and leak repairs." },
  { key: "safety", label: "Safety", weight: 8, tip: "Schedule smoke/CO checks and safety equipment photos." },
  { key: "warranty", label: "Warranty", weight: 8, tip: "Store warranty PDFs for appliances and major systems." },
  { key: "documents", label: "Documents", weight: 8, tip: "Keep inspection reports and permits in Vault." },
  { key: "electrical", label: "Electrical", weight: 6, tip: "Photo the panel and log licensed electrician work." },
  { key: "exterior", label: "Exterior", weight: 5, tip: "Track siding, deck, and landscaping maintenance." },
  { key: "foundation", label: "Foundation", weight: 5, tip: "Document structural inspections and basement checks." },
  { key: "interior", label: "Interior", weight: 5, tip: "Record paint colors and interior repair history." },
];

export type Season = "spring" | "summer" | "fall" | "winter";

export function getCurrentSeason(): Season {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

export const SEASONAL_TIPS: Record<Season, string[]> = {
  spring: [
    "Schedule HVAC service before summer heat.",
    "Inspect exterior siding, gutters, and drainage.",
    "Clear gutters and check roof after winter.",
  ],
  summer: [
    "Check irrigation and outdoor faucets for leaks.",
    "Inspect deck, fence, and exterior paint.",
    "Service AC filters and condenser unit.",
  ],
  fall: [
    "Schedule furnace inspection before heating season.",
    "Clean chimney and check smoke detector batteries.",
    "Winterize exterior faucets and hoses.",
  ],
  winter: [
    "Protect pipes in unheated areas from freezing.",
    "Inspect water heater and flush sediment.",
    "Monitor roof for ice dams and snow load where applicable.",
  ],
};

function inferPriority(label: string): RecommendationPriority {
  const lower = label.toLowerCase();
  if (lower.includes("overdue") || lower.includes("complete") && lower.includes("task")) return "critical";
  if (lower.includes("inspection") || lower.includes("smoke") || lower.includes("safety")) return "high";
  if (lower.includes("warranty") || lower.includes("hvac") || lower.includes("schedule")) return "high";
  if (lower.includes("serial") || lower.includes("photograph") || lower.includes("receipt")) return "medium";
  if (lower.includes("paint") || lower.includes("record")) return "low";
  return "medium";
}

function inferTime(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("upload") && (lower.includes("receipt") || lower.includes("warranty"))) return "30 seconds";
  if (lower.includes("photograph")) return "1 minute";
  if (lower.includes("serial")) return "2 minutes";
  if (lower.includes("schedule") || lower.includes("maintenance")) return "5 minutes";
  if (lower.includes("inspection") || lower.includes("complete")) return "3 minutes";
  if (lower.includes("appliance")) return "2 minutes";
  if (lower.includes("create")) return "5 minutes";
  return "2 minutes";
}

function inferValueImpact(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("roof") && lower.includes("inspection")) {
    return "Improves maintenance history for resale documentation.";
  }
  if (lower.includes("hvac") && lower.includes("warranty")) {
    return "Helps support future warranty claims and buyer confidence.";
  }
  if (lower.includes("hvac") || lower.includes("schedule") && lower.includes("service")) {
    return "Helps reduce long-term repair costs and energy waste.";
  }
  if (lower.includes("overdue") || lower.includes("complete") && lower.includes("task")) {
    return "Prevents deferred maintenance from lowering property value.";
  }
  if (lower.includes("smoke") || lower.includes("safety")) {
    return "Documents life-safety compliance for insurance and resale.";
  }
  if (lower.includes("inspection")) {
    return "Strengthens buyer trust with verified home condition records.";
  }
  if (lower.includes("warranty")) {
    return "Protects against unexpected replacement costs and supports claims.";
  }
  if (lower.includes("serial") || lower.includes("appliance")) {
    return "Creates a complete asset inventory for insurance and resale.";
  }
  if (lower.includes("photograph") || lower.includes("electrical")) {
    return "Provides visual proof of system condition for future reference.";
  }
  if (lower.includes("receipt") || lower.includes("repair")) {
    return "Documents repair investment for resale and tax records.";
  }
  if (lower.includes("paint")) {
    return "Helps future touch-ups and maintains interior documentation.";
  }
  return "Builds a stronger home history that supports long-term value.";
}

export function enrichRecommendation(
  action: RecoverableAction,
  categoryKey?: ScoreCategoryKey,
  categoryLabel?: string
): EnrichedRecommendation {
  return {
    ...action,
    priority: inferPriority(action.label),
    estimatedTime: inferTime(action.label),
    valueImpact: inferValueImpact(action.label),
    categoryKey,
    categoryLabel,
  };
}

export function sortByPriority(actions: EnrichedRecommendation[]): EnrichedRecommendation[] {
  return [...actions].sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pd !== 0) return pd;
    return b.points - a.points;
  });
}

export function flattenPrioritizedRecommendations(
  insights: { key: ScoreCategoryKey; label: string; recoverableActions: RecoverableAction[] }[]
): EnrichedRecommendation[] {
  const all = insights.flatMap((i) =>
    i.recoverableActions.map((a) => enrichRecommendation(a, i.key, i.label))
  );
  return sortByPriority(all);
}

export function computeCompletionPercent(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
