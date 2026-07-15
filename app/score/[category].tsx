import { ScrollView, Text, View, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { ScoreCategoryDetailView } from "@/components/ScoreCategoryDetailView";
import { colors, styles } from "@/constants/theme";
import { useHomeWise } from "@/context/HomeWiseContext";
import {
  getCategoryInsight,
  type ScoreCategoryKey,
} from "@/lib/scoreCategories";

const VALID_KEYS: ScoreCategoryKey[] = [
  "roof", "hvac", "plumbing", "electrical", "foundation", "exterior",
  "interior", "appliances", "maintenance", "safety", "documents", "warranty",
];

export default function ScoreCategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const {
    selectedProperty,
    maintenanceItems,
    repairs,
    appliances,
    documents,
    contractors,
    paintColors,
    photos,
  } = useHomeWise();

  const key = VALID_KEYS.includes(category as ScoreCategoryKey)
    ? (category as ScoreCategoryKey)
    : "maintenance";

  const pid = selectedProperty?.id ?? "";
  const input = {
    property: selectedProperty,
    maintenance: maintenanceItems.filter((m) => m.propertyId === pid),
    repairs: repairs.filter((r) => r.propertyId === pid),
    appliances: appliances.filter((a) => a.propertyId === pid),
    documents: documents.filter((d) => d.propertyId === pid),
    contractors: contractors.filter((c) => !c.propertyId || c.propertyId === pid),
    paintColors: paintColors.filter((p) => p.propertyId === pid),
    photos: photos.filter((p) => p.propertyId === pid),
  };

  const insight = getCategoryInsight(key, input);

  if (!insight) {
    return (
      <Screen>
        <Header title="Score Detail" onBack={() => router.back()} />
        <Text style={styles.muted}>Category not found.</Text>
      </Screen>
    );
  }

  return (
    <Screen noPad>
      <Header title={insight.label} subtitle={selectedProperty?.address} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card elevated>
          <ScoreCategoryDetailView insight={insight} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
