import { Platform } from "react-native";
import type { UserProfile } from "@/context/AuthContext";

/** RevenueCat entitlement identifiers — must match your RevenueCat dashboard. */
export const REVENUECAT_ENTITLEMENTS = {
  premium: "premium",
  landlord: "landlord",
  realtor: "realtor",
} as const;

export type RevenueCatEntitlement = keyof typeof REVENUECAT_ENTITLEMENTS;

export type SubscriptionPackage = {
  identifier: string;
  title: string;
  price: string;
  period: "monthly" | "yearly" | "lifetime";
  plan: UserProfile["plan"];
};

export type RevenueCatState = {
  isConfigured: boolean;
  isPremium: boolean;
  activePlan: UserProfile["plan"];
  packages: SubscriptionPackage[];
  customerInfo: Record<string, unknown> | null;
};

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let purchasesModule: any = null;

async function getPurchases() {
  if (purchasesModule) return purchasesModule;

  try {
    purchasesModule = require("react-native-purchases");
    return purchasesModule;
  } catch {
    return null;
  }
}

export function isRevenueCatConfigured(): boolean {
  if (Platform.OS === "web") return false;
  if (Platform.OS === "ios") return IOS_KEY.length > 0;
  if (Platform.OS === "android") return ANDROID_KEY.length > 0;
  return false;
}

export async function configureRevenueCat(userId: string): Promise<boolean> {
  if (!isRevenueCatConfigured()) return false;

  const mod = await getPurchases();
  if (!mod) return false;

  const apiKey = Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;
  mod.default.setLogLevel(mod.LOG_LEVEL.WARN);
  await mod.default.configure({ apiKey, appUserID: userId });
  return true;
}

export async function logOutRevenueCat(): Promise<void> {
  const mod = await getPurchases();
  if (!mod || !isRevenueCatConfigured()) return;

  try {
    await mod.default.logOut();
  } catch {
    // Non-fatal — user may not have been configured yet
  }
}

function planFromEntitlements(
  active: Record<string, { isActive: boolean }>
): UserProfile["plan"] {
  if (active[REVENUECAT_ENTITLEMENTS.landlord]?.isActive) return "landlord";
  if (active[REVENUECAT_ENTITLEMENTS.realtor]?.isActive) return "realtor";
  if (active[REVENUECAT_ENTITLEMENTS.premium]?.isActive) return "premium";
  return "free";
}

function planFromPackageIdentifier(identifier: string): UserProfile["plan"] {
  const id = identifier.toLowerCase();
  if (id.includes("landlord")) return "landlord";
  if (id.includes("realtor")) return "realtor";
  return "premium";
}

function periodFromPackageType(mod: { PACKAGE_TYPE: Record<string, string> }, packageType: string) {
  if (packageType === mod.PACKAGE_TYPE.ANNUAL) return "yearly" as const;
  if (packageType === mod.PACKAGE_TYPE.LIFETIME) return "lifetime" as const;
  return "monthly" as const;
}

export async function fetchRevenueCatState(
  fallbackPlan: UserProfile["plan"] = "free"
): Promise<RevenueCatState> {
  if (!isRevenueCatConfigured()) {
    return {
      isConfigured: false,
      isPremium: fallbackPlan !== "free",
      activePlan: fallbackPlan,
      packages: [],
      customerInfo: null,
    };
  }

  const mod = await getPurchases();
  if (!mod) {
    return {
      isConfigured: false,
      isPremium: fallbackPlan !== "free",
      activePlan: fallbackPlan,
      packages: [],
      customerInfo: null,
    };
  }

  try {
    const [info, offerings] = await Promise.all([
      mod.default.getCustomerInfo(),
      mod.default.getOfferings(),
    ]);

    const active = info.entitlements.active as Record<string, { isActive: boolean }>;
    const activePlan = planFromEntitlements(active);
    const current = offerings.current;

    const packages: SubscriptionPackage[] = (current?.availablePackages ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pkg: any) => ({
        identifier: pkg.identifier,
        title: pkg.product.title,
        price: pkg.product.priceString,
        period: periodFromPackageType(mod, pkg.packageType),
        plan: planFromPackageIdentifier(pkg.identifier),
      })
    );

    return {
      isConfigured: true,
      isPremium: activePlan !== "free",
      activePlan,
      packages,
      customerInfo: info as unknown as Record<string, unknown>,
    };
  } catch (e) {
    console.warn("RevenueCat fetch failed:", e);
    return {
      isConfigured: true,
      isPremium: fallbackPlan !== "free",
      activePlan: fallbackPlan,
      packages: [],
      customerInfo: null,
    };
  }
}

export async function purchasePackage(packageId: string): Promise<UserProfile["plan"]> {
  const mod = await getPurchases();
  if (!mod) throw new Error("In-app purchases require a native build with RevenueCat configured.");

  const offerings = await mod.default.getOfferings();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pkg = offerings.current?.availablePackages.find((p: any) => p.identifier === packageId);

  if (!pkg) throw new Error("Subscription package not found.");

  const { customerInfo } = await mod.default.purchasePackage(pkg);
  const active = customerInfo.entitlements.active as Record<string, { isActive: boolean }>;
  return planFromEntitlements(active);
}

export async function restorePurchases(): Promise<UserProfile["plan"]> {
  const mod = await getPurchases();
  if (!mod) throw new Error("In-app purchases require a native build with RevenueCat configured.");

  const info = await mod.default.restorePurchases();
  const active = info.entitlements.active as Record<string, { isActive: boolean }>;
  return planFromEntitlements(active);
}
