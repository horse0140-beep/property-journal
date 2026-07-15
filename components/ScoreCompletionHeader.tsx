import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/constants/theme";

type Props = {
  score: number;
  label?: string;
};

export function ScoreCompletionHeader({ score, label = "Home Health Completion" }: Props) {
  const percent = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.percent}>{percent}%</Text>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={s.secondary}>Score {score} / 100</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  label: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  percent: { fontSize: 26, fontWeight: "700", color: colors.primary },
  track: { height: 10, backgroundColor: colors.borderLight, borderRadius: 5, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.primary, borderRadius: 5 },
  secondary: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
});
