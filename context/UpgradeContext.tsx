import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  hasFeatureAccess,
  type PremiumFeature,
} from "@/lib/premium";

type UpgradeContextValue = {
  visible: boolean;
  activeFeature: PremiumFeature | null;
  showUpgrade: (feature: PremiumFeature) => void;
  hideUpgrade: () => void;
  canAccess: (feature: PremiumFeature) => boolean;
  requireFeature: (feature: PremiumFeature, action: () => void) => void;
};

const UpgradeContext = createContext<UpgradeContextValue | undefined>(undefined);

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [visible, setVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState<PremiumFeature | null>(null);

  const canAccess = useCallback(
    (feature: PremiumFeature) => hasFeatureAccess(feature, user?.plan, isAdmin),
    [user?.plan, isAdmin]
  );

  const showUpgrade = useCallback((feature: PremiumFeature) => {
    setActiveFeature(feature);
    setVisible(true);
  }, []);

  const hideUpgrade = useCallback(() => {
    setVisible(false);
    setActiveFeature(null);
  }, []);

  const requireFeature = useCallback(
    (feature: PremiumFeature, action: () => void) => {
      if (hasFeatureAccess(feature, user?.plan, isAdmin)) {
        action();
      } else {
        showUpgrade(feature);
      }
    },
    [user?.plan, isAdmin, showUpgrade]
  );

  const value = useMemo(
    () => ({
      visible,
      activeFeature,
      showUpgrade,
      hideUpgrade,
      canAccess,
      requireFeature,
    }),
    [visible, activeFeature, showUpgrade, hideUpgrade, canAccess, requireFeature]
  );

  return (
    <UpgradeContext.Provider value={value}>{children}</UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  const ctx = useContext(UpgradeContext);
  if (!ctx) {
    throw new Error("useUpgrade must be inside UpgradeProvider");
  }
  return ctx;
}
