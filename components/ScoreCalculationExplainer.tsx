import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { CATEGORY_WEIGHTS } from "@/lib/scoreMeta";
import { colors, styles } from "@/constants/theme";

type Props = { onClose?: () => void };

export function ScoreCalculationExplainer({ onClose }: Props) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.heading}>How is this score calculated?</Text>
      <Text style={s.intro}>
        Your Home Health Score combines 12 categories. Each category is scored 0–100 based on your
        maintenance records, documents, appliances, and photos. The overall score is a weighted
        average — categories that protect your home most carry slightly more weight.
      </Text>

      {CATEGORY_WEIGHTS.map((cat) => (
        <View key={cat.key} style={s.row}>
          <View style={s.rowTop}>
            <Text style={s.catLabel}>{cat.label}</Text>
            <Text style={s.weight}>{cat.weight}%</Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${cat.weight * 4}%` }]} />
          </View>
          <Text style={s.tip}>{cat.tip}</Text>
        </View>
      ))}

      <Text style={s.footer}>
        Complete the priority recommendations on your Reports tab to recover points quickly. Overdue
        maintenance and missing documentation have the largest impact.
      </Text>

      <Pressable style={styles.primaryButton} onPress={onClose ?? (() => router.back())}>
        <Text style={styles.primaryButtonText}>{onClose ? "Got it" : "Back"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: 10 },
  intro: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 16 },
  row: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  catLabel: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  weight: { fontSize: 15, fontWeight: "700", color: colors.primary },
  barTrack: { height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginBottom: 6, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 3 },
  tip: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  footer: { fontSize: 12, color: colors.textSecondary, lineHeight: 20, marginVertical: 16 },
});
