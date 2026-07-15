import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { getCurrentSeason, SEASONAL_TIPS, type Season } from "@/lib/scoreMeta";
import { colors } from "@/constants/theme";

const SEASON_LABEL: Record<Season, string> = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
};

type Props = { season?: Season };

export function ScoreSeasonalPanel({ season = getCurrentSeason() }: Props) {
  const tips = SEASONAL_TIPS[season];
  return (
    <View style={s.wrap}>
      <Text style={s.title}>{SEASON_LABEL[season]} Maintenance</Text>
      {tips.map((tip) => (
        <View key={tip} style={s.tipRow}>
          <Text style={s.bullet}>•</Text>
          <Text style={s.tip}>{tip}</Text>
        </View>
      ))}
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
  title: { fontSize: 15, fontWeight: "600", color: colors.primary, marginBottom: 10 },
  tipRow: { flexDirection: "row", marginBottom: 6 },
  bullet: { color: colors.primary, marginRight: 10, fontWeight: "700" },
  tip: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});
