import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import {
  ANNUAL_CHECKUP_ITEMS,
  getCheckupProgress,
  setCheckupItemDone,
  markCheckupComplete,
  checkupCompletionPercent,
  generateAnnualReportPdf,
  shareAnnualReportPdf,
} from "@/lib/scoreAnnualCheckup";
import { colors, styles } from "@/constants/theme";
import type { EnrichedRecommendation } from "@/lib/scoreMeta";

type Props = {
  propertyId: string;
  address: string;
  overallScore: number;
  completionPercent: number;
  recommendations: EnrichedRecommendation[];
};

export function AnnualCheckupPanel({
  propertyId,
  address,
  overallScore,
  completionPercent,
  recommendations,
}: Props) {
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setProgress(await getCheckupProgress(propertyId));
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  const percent = checkupCompletionPercent(progress);
  const allDone = percent === 100;

  const toggle = async (id: string) => {
    const next = !progress[id];
    await setCheckupItemDone(propertyId, id, next);
    setProgress((prev) => ({ ...prev, [id]: next }));
  };

  const finish = async () => {
    setExporting(true);
    await markCheckupComplete(propertyId);
    const result = await generateAnnualReportPdf({
      address,
      overallScore,
      completionPercent,
      checkupPercent: percent,
      recommendations,
    });
    setExporting(false);
    if (result.error || !result.uri) {
      Alert.alert("Report", result.error ?? "Could not generate report.");
      return;
    }
    const share = await shareAnnualReportPdf(result.uri, address);
    if (share.error) Alert.alert("Share", share.error);
    else Alert.alert("Annual Checkup Complete", "Your HomeWise Annual Home Health Report is ready to share.");
  };

  if (loading) {
    return (
      <View style={{ padding: 24, alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.heading}>Annual Home Checkup</Text>
      <Text style={s.sub}>Complete this once per year to keep your Home Health records current.</Text>
      <Text style={s.percent}>{percent}% complete</Text>

      {ANNUAL_CHECKUP_ITEMS.map((item) => {
        const done = !!progress[item.id];
        return (
          <Pressable key={item.id} style={[s.item, done && s.itemDone]} onPress={() => toggle(item.id)}>
            <Text style={s.check}>{done ? "✓" : "○"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.itemLabel}>{item.label}</Text>
              <Text style={s.itemDesc}>{item.description}</Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: item.route as never,
                    params: item.params as Record<string, string> | undefined,
                  })
                }
              >
                <Text style={s.link}>Open →</Text>
              </Pressable>
            </View>
          </Pressable>
        );
      })}

      {allDone ? (
        <Pressable style={styles.primaryButton} onPress={finish} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Generate Annual Home Health Report</Text>
          )}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: 6 },
  sub: { fontSize: 15, color: colors.textSecondary, marginBottom: 14 },
  percent: { fontSize: 28, fontWeight: "700", color: colors.primary, marginBottom: 16 },
  item: {
    flexDirection: "row",
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  itemDone: { borderColor: colors.success },
  check: { fontSize: 18, width: 28, color: colors.primary },
  itemLabel: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  itemDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 6 },
  link: { fontSize: 12, color: colors.primary, fontWeight: "600" },
});
