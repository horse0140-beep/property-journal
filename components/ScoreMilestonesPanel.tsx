import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import type { Milestone } from "@/lib/scoreEngagement";
import { colors } from "@/constants/theme";

type Props = { milestones: Milestone[] };

function MilestoneBadge({ milestone }: { milestone: Milestone }) {
  const scale = useRef(new Animated.Value(milestone.earned ? 0.92 : 1)).current;

  useEffect(() => {
    if (milestone.earned) {
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    }
  }, [milestone.earned, scale]);

  return (
    <Animated.View
      style={[s.badge, milestone.earned ? s.badgeEarned : s.badgeLocked, { transform: [{ scale }] }]}
    >
      <Text style={s.emoji}>{milestone.emoji}</Text>
      <Text style={[s.title, !milestone.earned && s.titleLocked]} numberOfLines={1}>
        {milestone.title}
      </Text>
    </Animated.View>
  );
}

export function ScoreMilestonesPanel({ milestones }: Props) {
  const earned = milestones.filter((m) => m.earned);
  if (milestones.length === 0) return null;

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.heading}>Milestone Badges</Text>
        <Text style={s.count}>
          {earned.length}/{milestones.length}
        </Text>
      </View>
      <View style={s.row}>
        {milestones.map((m) => (
          <MilestoneBadge key={m.id} milestone={m} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  heading: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  count: { fontSize: 12, color: colors.textMuted },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badge: { width: 100, alignItems: "center", padding: 10, borderRadius: 12, borderWidth: 1 },
  badgeEarned: { borderColor: colors.primary, backgroundColor: colors.bgCard },
  badgeLocked: { borderColor: colors.borderLight, backgroundColor: colors.bg, opacity: 0.55 },
  emoji: { fontSize: 22, marginBottom: 4 },
  title: { fontSize: 10, fontWeight: "600", color: colors.textPrimary, textAlign: "center" },
  titleLocked: { color: colors.textMuted },
});
