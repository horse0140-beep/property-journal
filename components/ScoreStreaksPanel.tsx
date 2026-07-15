import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { EngagementStats } from "@/lib/scoreEngagement";
import { colors } from "@/constants/theme";

type Props = { stats: EngagementStats };

export function ScoreStreaksPanel({ stats }: Props) {
  const items = [
    stats.activeStreakDays >= 7
      ? { label: "7-Day Streak", value: `${stats.activeStreakDays} days`, active: true }
      : stats.activeStreakDays > 0
        ? { label: "Active Streak", value: `${stats.activeStreakDays} day${stats.activeStreakDays === 1 ? "" : "s"}`, active: false }
        : null,
    stats.maintenanceStreakDays >= 30
      ? { label: "30-Day Maintenance Streak", value: `${stats.maintenanceStreakDays} days`, active: true }
      : stats.maintenanceStreakDays > 0
        ? { label: "Maintenance Streak", value: `${stats.maintenanceStreakDays} days`, active: false }
        : null,
    stats.completedTasksCount > 0
      ? {
          label: "Tasks Completed",
          value: `${stats.completedTasksCount} maintenance tasks`,
          active: stats.completedTasksCount >= 12,
        }
      : null,
  ].filter(Boolean) as { label: string; value: string; active: boolean }[];

  if (items.length === 0) return null;

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Smart Streaks</Text>
      <View style={s.row}>
        {items.map((item) => (
          <View key={item.label} style={[s.chip, item.active && s.chipActive]}>
            <Text style={[s.chipLabel, item.active && s.chipLabelActive]}>{item.label}</Text>
            <Text style={[s.chipValue, item.active && s.chipValueActive]}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 14 },
  title: { fontSize: 15, fontWeight: "600", color: colors.textPrimary, marginBottom: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minWidth: 140,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.bgSection },
  chipLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  chipLabelActive: { color: colors.primary },
  chipValue: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  chipValueActive: { color: colors.primary },
});
