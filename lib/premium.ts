import type { UserProfile } from "@/context/AuthContext";
import { adminPlanBadge, hasUnrestrictedAccess } from "@/lib/admin";

export const PREMIUM_PLANS = ["premium", "landlord", "realtor"] as const;
export const FREE_PROPERTY_LIMIT = 1;

export type PremiumFeature =
  | "unlimited_properties"
  | "pdf_reports"
  | "buyer_share_links"
  | "cloud_backup"
  | "ai_forecasting"
  | "landlord_dashboard"
  | "realtor_tools"
  | "property_sharing"
  | "contractor_portal";

const FEATURE_PLANS: Record<PremiumFeature, readonly UserProfile["plan"][]> = {
  unlimited_properties: PREMIUM_PLANS,
  pdf_reports: PREMIUM_PLANS,
  buyer_share_links: PREMIUM_PLANS,
  cloud_backup: PREMIUM_PLANS,
  ai_forecasting: PREMIUM_PLANS,
  property_sharing: PREMIUM_PLANS,
  contractor_portal: PREMIUM_PLANS,
  landlord_dashboard: ["landlord"],
  realtor_tools: ["realtor"],
};

export const FEATURE_LABELS: Record<PremiumFeature, string> = {
  unlimited_properties: "Unlimited Properties",
  pdf_reports: "PDF Reports",
  buyer_share_links: "Buyer Share Links",
  cloud_backup: "Cloud Backup",
  ai_forecasting: "AI Maintenance Forecasting",
  landlord_dashboard: "Landlord Pro Dashboard",
  realtor_tools: "Realtor Pro Tools",
  property_sharing: "Property Sharing",
  contractor_portal: "Contractor Portal",
};

export const FEATURE_DESCRIPTIONS: Record<PremiumFeature, string> = {
  unlimited_properties: "Track more than one property with a Premium plan.",
  pdf_reports: "Generate and share professional Home History PDF reports.",
  buyer_share_links: "Create secure share links for buyers and realtors.",
  cloud_backup: "Back up documents, photos, and receipts to the cloud.",
  ai_forecasting: "Get AI-powered maintenance cost and priority forecasts.",
  landlord_dashboard: "Manage multiple rentals with the Landlord Pro dashboard.",
  realtor_tools: "Access branded reports and client management for realtors.",
  property_sharing: "Share read-only property history with family or partners.",
  contractor_portal: "Invite contractors to view maintenance and repair schedules.",
};

export function isPremiumUser(
  plan?: UserProfile["plan"] | null,
  isAdmin = false,
  email?: string | null
): boolean {
  if (hasUnrestrictedAccess(email, isAdmin)) return true;
  return !!plan && PREMIUM_PLANS.includes(plan as (typeof PREMIUM_PLANS)[number]);
}

export function hasFullPremiumAccess(
  plan?: UserProfile["plan"] | null,
  isAdmin = false,
  email?: string | null
): boolean {
  return isPremiumUser(plan, isAdmin, email);
}

export function planLabel(plan?: UserProfile["plan"] | null): string {
  const labels: Record<UserProfile["plan"], string> = {
    free: "Free",
    premium: "Premium",
    landlord: "Landlord Pro",
    realtor: "Realtor Pro",
  };
  return labels[plan ?? "free"] ?? "Free";
}

export function requiredPlanForFeature(feature: PremiumFeature): UserProfile["plan"] {
  if (feature === "landlord_dashboard") return "landlord";
  if (feature === "realtor_tools") return "realtor";
  return "premium";
}

export function hasFeatureAccess(
  feature: PremiumFeature,
  plan?: UserProfile["plan"] | null,
  isAdmin = false,
  email?: string | null
): boolean {
  if (hasUnrestrictedAccess(email, isAdmin)) return true;
  if (!plan) return false;
  return FEATURE_PLANS[feature].includes(plan);
}

export function displayPlanLabel(
  plan?: UserProfile["plan"] | null,
  opts?: { isAdmin?: boolean; email?: string | null; isOwner?: boolean }
): string {
  if (opts?.isOwner) {
    return adminPlanBadge(opts.email);
  }
  if (hasUnrestrictedAccess(opts?.email, opts?.isAdmin ?? false)) {
    return adminPlanBadge(opts?.email);
  }
  return planLabel(plan);
}

export function canAddProperty(
  currentCount: number,
  plan?: UserProfile["plan"] | null,
  isAdmin = false,
  email?: string | null
): boolean {
  if (hasUnrestrictedAccess(email, isAdmin)) return true;
  if (isPremiumUser(plan, false, email)) return true;
  return currentCount < FREE_PROPERTY_LIMIT;
}
