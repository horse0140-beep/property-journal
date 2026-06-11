import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  configureRevenueCat,
  fetchRevenueCatState,
  isRevenueCatConfigured,
  purchasePackage,
  restorePurchases,
  type RevenueCatState,
  type SubscriptionPackage,
} from "@/services/revenueCatService";

type SubscriptionContextValue = RevenueCatState & {
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  purchase: (packageId: string) => Promise<{ error?: string }>;
  restore: () => Promise<{ error?: string; plan?: string }>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isSignedIn, isAdmin, updateProfile } = useAuth();
  const [state, setState] = useState<RevenueCatState>({
    isConfigured: false,
    isPremium: false,
    activePlan: "free",
    packages: [],
    customerInfo: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSignedIn || !user) {
      setState({
        isConfigured: isRevenueCatConfigured(),
        isPremium: false,
        activePlan: "free",
        packages: [],
        customerInfo: null,
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isRevenueCatConfigured()) {
        await configureRevenueCat(user.id);
      }

      const rc = await fetchRevenueCatState(user.plan);

      if (rc.isConfigured && !isAdmin && rc.activePlan !== user.plan) {
        await updateProfile({ plan: rc.activePlan });
      }

      setState({
        ...rc,
        isPremium: isAdmin || rc.isPremium,
        activePlan: isAdmin ? user.plan : rc.activePlan,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load subscriptions");
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, user, isAdmin, updateProfile]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const purchase = useCallback(
    async (packageId: string) => {
      if (isAdmin) return {};

      try {
        const plan = await purchasePackage(packageId);
        await updateProfile({ plan });
        await refresh();
        return {};
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Purchase failed";
        if (msg.toLowerCase().includes("cancel")) return {};
        return { error: msg };
      }
    },
    [refresh, updateProfile, isAdmin]
  );

  const restore = useCallback(async () => {
    if (isAdmin) return { plan: user?.plan };

    try {
      const plan = await restorePurchases();
      await updateProfile({ plan });
      await refresh();
      return { plan };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Restore failed" };
    }
  }, [refresh, updateProfile, isAdmin, user?.plan]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      ...state,
      isLoading,
      error,
      refresh,
      purchase,
      restore,
    }),
    [state, isLoading, error, refresh, purchase, restore]
  );

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be inside SubscriptionProvider");
  }
  return ctx;
}

export type { SubscriptionPackage };
