import { useEffect, useState } from "react";
import { Text, View, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import type { ScoreCelebration } from "@/lib/scoreHistory";
import { dismissCelebration } from "@/lib/scoreHistory";

type Props = {
  propertyId: string;
  celebration: ScoreCelebration;
  onDismiss: () => void;
};

export function ScoreCelebrationBanner({ propertyId, celebration, onDismiss }: Props) {
  const [opacity] = useState(new Animated.Value(0));
  const [scale] = useState(new Animated.Value(0.95));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  async function dismiss() {
    await dismissCelebration(propertyId, celebration.current);
    onDismiss();
  }

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ scale }],
        backgroundColor: colors.successBg,
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: colors.success,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.success,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="trending-up" size={24} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.success, fontWeight: "900", fontSize: 15 }}>
            Score Improved +{celebration.delta}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 20 }}>
            {celebration.message}
          </Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={8} accessibilityLabel="Dismiss">
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
