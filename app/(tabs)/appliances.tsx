import { useEffect } from "react";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { LoadingView } from "@/components/LoadingView";
import { useHomeWise } from "@/context/HomeWiseContext";

/** Appliances live under Maintenance on the property record. */
export default function AppliancesRedirectScreen() {
  const { selectedProperty, isLoading } = useHomeWise();

  useEffect(() => {
    if (isLoading) return;
    if (selectedProperty?.id) {
      router.replace(`/properties/${selectedProperty.id}?section=maintenance&tab=appliances`);
      return;
    }
    router.replace("/(tabs)/properties");
  }, [isLoading, selectedProperty?.id]);

  return (
    <Screen>
      <LoadingView message="Opening appliances…" />
    </Screen>
  );
}
