import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors, styles } from "@/constants/theme";
import type { ScoreCategoryInsight, RecoverableAction } from "@/lib/scoreCategories";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ScoreCompletionHeader } from "@/components/ScoreCompletionHeader";

type Props = {
  insight: ScoreCategoryInsight;
  onFixNow?: () => void;
};

function scoreColor(score: number) {
  if (score >= 90) return colors.scoreExcellent;
  if (score >= 80) return colors.scoreGood;
  if (score >= 65) return colors.scoreFair;
  return colors.scorePoor;
}

function BulletList({ items, empty }: { items: string[]; empty?: string }) {
  if (items.length === 0) return empty ? <Text style={styles.muted}>{empty}</Text> : null;
  return (
    <View style={{ gap: 6 }}>
      {items.map((item) => (
        <View key={item} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <Text style={{ color: colors.primary, lineHeight: 20 }}>•</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1, lineHeight: 20 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function navigateAction(action: RecoverableAction) {
  if (action.params) {
    router.push({ pathname: action.route as never, params: action.params as never });
  } else {
    router.push(action.route as never);
  }
}

export function ScoreCategoryDetailView({ insight, onFixNow }: Props) {
  const c = scoreColor(insight.score);
  const potential = Math.min(100, insight.score + insight.totalRecoverable);

  function fixNow() {
    if (onFixNow) {
      onFixNow();
      return;
    }
    if (insight.recoverableActions[0]) {
      navigateAction(insight.recoverableActions[0]);
      return;
    }
    navigateAction({
      label: insight.actionLabel,
      points: 0,
      route: insight.actionRoute,
      params: insight.actionParams,
    });
  }

  function askAi() {
    router.push({ pathname: "/ai", params: { prompt: insight.aiPrompt } });
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: "center", paddingVertical: 8 }}>
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            borderWidth: 8,
            borderColor: c,
            backgroundColor: `${c}14`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: c, fontSize: 40, fontWeight: "900" }}>{insight.score}</Text>
          <Text style={{ color: c, fontSize: 12, fontWeight: "700" }}>/ 100</Text>
        </View>
        <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 18, marginTop: 12 }}>
          {insight.label}
        </Text>
      </View>

      <ScoreCompletionHeader score={insight.score} label={`${insight.label} Completion`} />

      <View>
        <Text style={styles.sectionHeader}>Why Points Were Lost</Text>
        <BulletList items={insight.whyLow} />
      </View>

      {insight.missingRecords.length > 0 ? (
        <View>
          <Text style={styles.sectionHeader}>Missing Records</Text>
          <BulletList items={insight.missingRecords} />
        </View>
      ) : null}

      {insight.overdueOrIssues.length > 0 ? (
        <View>
          <Text style={[styles.sectionHeader, { color: colors.danger }]}>Overdue / Issues</Text>
          <BulletList items={insight.overdueOrIssues} />
        </View>
      ) : null}

      {insight.recoverableActions.length > 0 ? (
        <View>
          <Text style={styles.sectionHeader}>Priority Recommendations</Text>
          {insight.recoverableActions.map((a) => (
            <RecommendationCard
              key={a.label}
              recommendation={{
                ...a,
                priority: a.priority ?? "medium",
                estimatedTime: a.estimatedTime ?? "2 minutes",
                valueImpact: a.valueImpact ?? "Builds a stronger home history.",
                categoryKey: insight.key,
                categoryLabel: insight.label,
              }}
            />
          ))}
          <Text style={[styles.muted, { marginTop: 8, fontWeight: "700" }]}>
            Potential improvement: +{insight.totalRecoverable} points (up to {potential}/100)
          </Text>
        </View>
      ) : null}

      <View>
        <Text style={styles.sectionHeader}>Smart Recommendations</Text>
        <BulletList items={insight.recommendations} />
      </View>

      {insight.relatedItems.length > 0 ? (
        <View>
          <Text style={styles.sectionHeader}>Related Property Items</Text>
          <BulletList items={insight.relatedItems} />
        </View>
      ) : null}

      <Pressable
        onPress={fixNow}
        style={[styles.primaryButton, { marginTop: 4 }]}
        accessibilityRole="button"
        accessibilityLabel="Fix now"
      >
        <Ionicons name="flash-outline" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Fix Now</Text>
      </Pressable>

      <Pressable
        onPress={askAi}
        style={[styles.secondaryButton, { marginTop: 0 }]}
        accessibilityRole="button"
        accessibilityLabel="Ask HomeWise AI"
      >
        <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
        <Text style={styles.secondaryButtonText}>Ask HomeWise AI</Text>
      </Pressable>
    </View>
  );
}
