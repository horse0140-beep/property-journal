import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

type Props = {
  score: number;
  size?: number;
  label?: string;
};

function scoreColor(score: number) {
  if (score >= 90) return colors.scoreExcellent;
  if (score >= 80) return colors.scoreGood;
  if (score >= 65) return colors.scoreFair;
  return colors.scorePoor;
}

export function ScoreRing({ score, size = 100, label }: Props) {
  const color = scoreColor(score);
  const border = Math.round(size * 0.07);

  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: border,
          borderColor: color,
          backgroundColor: `${color}14`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color, fontSize: size * 0.3, fontWeight: "900" }}>{score}</Text>
        {label && (
          <Text style={{ color, fontSize: size * 0.12, fontWeight: "700", marginTop: 1 }}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

export function ScoreBar({
  score,
  label,
  onPress,
}: {
  score: number;
  label: string;
  onPress?: () => void;
}) {
  const color = scoreColor(score);
  const body = (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ color, fontSize: 13, fontWeight: "800" }}>{score}</Text>
          {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.textMuted} /> : null}
        </View>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.bgSection, overflow: "hidden" }}>
        <View style={{ width: `${score}%`, height: 6, borderRadius: 3, backgroundColor: color }} />
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {body}
      </Pressable>
    );
  }
  return body;
}
