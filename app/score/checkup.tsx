import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { Header } from "@/components/Header";
import { AnnualCheckupPanel } from "@/components/AnnualCheckupPanel";
import { useHomeWise } from "@/context/HomeWiseContext";
import { useMemo } from "react";
import { buildAllScoreCategoryInsights, computeOverallFromCategories } from "@/lib/scoreCategories";
import { flattenPrioritizedRecommendations, computeCompletionPercent } from "@/lib/scoreMeta";

export default function ScoreCheckupScreen() {
  const { propertyId: paramId } = useLocalSearchParams<{ propertyId?: string }>();
  const {
    selectedProperty,
    properties,
    maintenanceItems,
    repairs,
    appliances,
    documents,
    contractors,
    paintColors,
    photos,
    getPropertyScore,
  } = useHomeWise();

  const property = useMemo(() => {
    if (paramId) return properties.find((p) => p.id === paramId) ?? selectedProperty;
    return selectedProperty;
  }, [paramId, properties, selectedProperty]);

  const insights = useMemo(() => {
    if (!property) return [];
    return buildAllScoreCategoryInsights({
      property,
      maintenance: maintenanceItems.filter((m) => m.propertyId === property.id),
      repairs: repairs.filter((r) => r.propertyId === property.id),
      appliances: appliances.filter((a) => a.propertyId === property.id),
      documents: documents.filter((d) => d.propertyId === property.id),
      contractors: contractors.filter((c) => !c.propertyId || c.propertyId === property.id),
      paintColors: paintColors.filter((x) => x.propertyId === property.id),
      photos: photos.filter((x) => x.propertyId === property.id),
    });
  }, [property, maintenanceItems, repairs, appliances, documents, contractors, paintColors, photos]);

  const overallScore = useMemo(() => {
    if (!property || insights.length === 0) return 0;
    const base = getPropertyScore(property.id).overall;
    const enhanced = computeOverallFromCategories(insights);
    return Math.round((base + enhanced) / 2);
  }, [property, insights, getPropertyScore]);

  const recommendations = useMemo(() => flattenPrioritizedRecommendations(insights), [insights]);

  if (!property) {
    return (
      <Screen>
        <Header title="Annual Checkup" />
      </Screen>
    );
  }

  return (
    <Screen noPad>
      <Header title="Annual Checkup" />
      <AnnualCheckupPanel
        propertyId={property.id}
        address={property.address}
        overallScore={overallScore}
        completionPercent={computeCompletionPercent(overallScore)}
        recommendations={recommendations}
      />
    </Screen>
  );
}
