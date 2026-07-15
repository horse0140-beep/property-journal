import { useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "@/constants/theme";
import {
  getScoreHistory,
  scoreTrend,
  type ScoreHistoryPeriod,
  type ScoreSnapshot,
} from "@/lib/scoreHistory";

const PERIODS: { key: ScoreHistoryPeriod; label: string }[] = [
  { key: "30d", label: "30 Days" },
  { key: "6m", label: "6 Months" },
  { key: "1y", label: "1 Year" },
  { key: "lifetime", label: "Lifetime" },
];

type Props = {
  propertyId: string;
  currentOverall: number;
};

export function ScoreHistoryPanel({ propertyId, currentOverall }: Props) {
  const [period, setPeriod] = useState<ScoreHistoryPeriod>("6m");
  const [history, setHistory] = useState<ScoreSnapshot[]>([]);

  useEffect(() => {
    getScoreHistory(propertyId, period)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [propertyId, period]);

  const trend = scoreTrend(history.length > 0 ? history : [{ date: new Date().toISOString(), overall: currentOverall, categories: {} }]);
  const trendIcon =
    trend === "up" ? "trending-up" : trend === "down" ? "trending-down" : "remove-outline";
  const trendColor =
    trend === "up" ? colors.success : trend === "down" ? colors.danger : colors.textMuted;

  const min = history.length > 0 ? Math.min(...history.map((h) => h.overall)) : currentOverall;
  const max = history.length > 0 ? Math.max(...history.map((h) => h.overall)) : currentOverall;

  return (
    <View>
      <Text style={styles.sectionHeader}>Score History</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setPeriod(p.key)}
            style={[
              period === p.key ? styles.chipActive : styles.chip,
              { marginTop: 0 },
            ]}
          >
            <Text style={period === p.key ? styles.chipTextActive : styles.chipText}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      {history.length < 2 ? (
        <Text style={styles.muted}>
          Score history builds as you use HomeWise. Check back after adding records or completing tasks.
        </Text>
      ) : (
        <>
          <View style={[styles.rowBetween, { marginBottom: 10 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name={trendIcon as keyof typeof Ionicons.glyphMap} size={18} color={trendColor} />
              <Text style={{ color: trendColor, fontWeight: "700" }}>
                {trend === "up" ? "Improving" : trend === "down" ? "Declining" : "Stable"}
              </Text>
            </View>
            <Text style={styles.muted}>
              {min} – {max} range
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 80 }}>
            {history.slice(-12).map((snap, i) => {
              const h = Math.max(8, (snap.overall / 100) * 72);
              const c =
                snap.overall >= 80
                  ? colors.scoreGood
                  : snap.overall >= 65
                    ? colors.scoreFair
                    : colors.scorePoor;
              return (
                <View key={`${snap.date}-${i}`} style={{ flex: 1, alignItems: "center" }}>
                  <View
                    style={{
                      width: "100%",
                      maxWidth: 24,
                      height: h,
                      backgroundColor: c,
                      borderRadius: 4,
                    }}
                  />
                  <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 4 }}>
                    {snap.overall}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}
