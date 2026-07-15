import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import type { MonthlyReportData } from "@/lib/scoreMonthlyReport";
import { generateMonthlyReportPdf, shareMonthlyReportPdf } from "@/lib/scoreMonthlyReport";
import { colors } from "@/constants/theme";

type Props = { reportData: MonthlyReportData };

export function MonthlyHealthReportPanel({ reportData }: Props) {
  const [busy, setBusy] = useState(false);

  const exportPdf = async () => {
    setBusy(true);
    const result = await generateMonthlyReportPdf(reportData);
    setBusy(false);
    if (result.error || !result.uri) {
      Alert.alert("Export failed", result.error ?? "Could not create PDF.");
      return;
    }
    const share = await shareMonthlyReportPdf(result.uri, reportData.propertyAddress);
    if (share.error) Alert.alert("Share", share.error);
  };

  const trendLabel =
    reportData.trend === "up"
      ? `↑ +${reportData.trendDelta}`
      : reportData.trend === "down"
        ? `↓ ${reportData.trendDelta}`
        : "→ Stable";

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Monthly Home Health Report</Text>
      <Text style={s.sub}>{reportData.monthLabel}</Text>
      <View style={s.stats}>
        <Stat label="Score" value={String(reportData.overallScore)} />
        <Stat label="Trend" value={trendLabel} />
        <Stat label="Tasks done" value={String(reportData.completedTasks)} />
        <Stat label="Upcoming" value={String(reportData.upcomingTasks)} />
        <Stat label="New docs" value={String(reportData.newDocuments)} />
        <Stat label="Open recs" value={String(reportData.recommendations.length)} />
      </View>
      <Pressable style={s.btn} onPress={exportPdf} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Export PDF & Share</Text>}
      </Pressable>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  title: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  stat: { minWidth: "28%", alignItems: "center", paddingVertical: 6 },
  statValue: { fontSize: 15, fontWeight: "700", color: colors.primary },
  statLabel: { fontSize: 10, color: colors.textMuted, textAlign: "center" },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
