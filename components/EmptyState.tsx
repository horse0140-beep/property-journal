import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles, hitSlopDefault } from "@/constants/theme";
import { WebHomeButton } from "@/components/WebHomeButton";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

export function EmptyState({ icon, title, message, actionLabel, onAction, compact }: Props) {
  const iconSize = compact ? 60 : 72;
  const glyphSize = compact ? 28 : 34;

  return (
    <View style={[styles.emptyState, compact && { padding: 24 }]}>
      <View
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize / 2,
          backgroundColor: colors.bgSection,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={glyphSize} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateText}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          style={[styles.primaryButton, { alignSelf: "stretch", marginTop: 20 }]}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Inline back control for stack screens (features, subscriptions, etc.). */
export function BackLink({
  label = "Back",
  onPress,
  showHomeOnWeb = true,
}: {
  label?: string;
  onPress: () => void;
  showHomeOnWeb?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
        minHeight: 44,
        alignSelf: "flex-start",
      }}
    >
      <Pressable
        onPress={onPress}
        hitSlop={hitSlopDefault}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingRight: 4,
          minHeight: 44,
        }}
      >
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>{label}</Text>
      </Pressable>
      {showHomeOnWeb ? <WebHomeButton /> : null}
    </View>
  );
}
