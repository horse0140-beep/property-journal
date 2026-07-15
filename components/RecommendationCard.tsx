import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { type EnrichedRecommendation, PRIORITY_EMOJI, PRIORITY_LABEL } from "@/lib/scoreMeta";
import { colors } from "@/constants/theme";

type Props = {
  recommendation: EnrichedRecommendation;
  compact?: boolean;
};

export function RecommendationCard({ recommendation, compact }: Props) {
  const onPress = () => {
    if (recommendation.route) {
      router.push({
        pathname: recommendation.route as never,
        params: recommendation.params as Record<string, string> | undefined,
      });
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [s.card, compact && s.compact, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={s.topRow}>
        <Text style={s.priority}>
          {PRIORITY_EMOJI[recommendation.priority]} {PRIORITY_LABEL[recommendation.priority]}
        </Text>
        <Text style={s.points}>+{recommendation.points} Health Score</Text>
      </View>
      <Text style={s.label}>{recommendation.label}</Text>
      {!compact && (
        <>
          <Text style={s.impact}>Estimated impact: {recommendation.valueImpact}</Text>
          <View style={s.metaRow}>
            <Text style={s.meta}>⏱ ~{recommendation.estimatedTime}</Text>
            {recommendation.categoryLabel ? (
              <Text style={s.metaCat}>{recommendation.categoryLabel}</Text>
            ) : null}
          </View>
        </>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  compact: { padding: 10 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  priority: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  points: { fontSize: 12, fontWeight: "700", color: colors.success },
  label: { fontSize: 15, fontWeight: "600", color: colors.textPrimary, marginBottom: 6 },
  impact: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: 6 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { fontSize: 12, color: colors.textSecondary },
  metaCat: { fontSize: 12, color: colors.primary },
});
