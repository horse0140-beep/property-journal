import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors, styles } from "@/constants/theme";
import type { ScoreCategoryInsight } from "@/lib/scoreCategories";
import { PRIORITY_EMOJI, enrichRecommendation } from "@/lib/scoreMeta";

type Props = {
  insight: ScoreCategoryInsight;
  expanded: boolean;
  onToggle: () => void;
};

export function ScoreInsightPanel({ insight, expanded, onToggle }: Props) {
  const scoreColor =
    insight.score >= 90
      ? colors.scoreExcellent
      : insight.score >= 80
        ? colors.scoreGood
        : insight.score >= 65
          ? colors.scoreFair
          : colors.scorePoor;

  function openDetail() {
    router.push({ pathname: "/score/[category]", params: { category: insight.key } });
  }

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: expanded ? colors.primary : colors.border,
        borderRadius: 12,
        marginBottom: 10,
        overflow: "hidden",
        backgroundColor: expanded ? colors.bgSection : colors.bgCard,
      }}
    >
      <Pressable
        onPress={onToggle}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`${insight.label}, ${insight.score} out of 100`}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: `${insight.color}18`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={insight.icon as keyof typeof Ionicons.glyphMap} size={18} color={insight.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
            {insight.label}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {insight.whyLow[0]}
            {insight.totalRecoverable > 0 ? ` · +${insight.totalRecoverable} recoverable` : ""}
          </Text>
        </View>
        <Text style={{ color: scoreColor, fontWeight: "900", fontSize: 16 }}>{insight.score}</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
      </Pressable>

      {expanded ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
          {insight.recoverableActions.slice(0, 2).map((a) => {
            const enriched = enrichRecommendation(a, insight.key, insight.label);
            return (
              <View key={a.label} style={{ gap: 4 }}>
                <View style={styles.rowBetween}>
                  <Text style={{ color: colors.textSecondary, flex: 1, fontSize: 13 }} numberOfLines={2}>
                    {PRIORITY_EMOJI[enriched.priority]} {a.label}
                  </Text>
                  <Text style={{ color: colors.success, fontWeight: "800" }}>+{a.points}</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>~{enriched.estimatedTime}</Text>
              </View>
            );
          })}
          <Pressable onPress={openDetail} style={[styles.primaryButton, { marginTop: 0, paddingVertical: 12 }]}>
            <Text style={styles.primaryButtonText}>View Full Breakdown</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
