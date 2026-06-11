import { Text } from "react-native";
import { colors } from "@/constants/theme";

type Variant = "success" | "warning" | "danger" | "info" | "primary" | "muted";

const variantStyles: Record<Variant, { color: string; bg: string }> = {
  success: { color: colors.success, bg: colors.successBg },
  warning: { color: colors.warning, bg: colors.warningBg },
  danger: { color: colors.danger, bg: colors.dangerBg },
  info: { color: colors.info, bg: colors.infoBg },
  primary: { color: colors.textLight, bg: colors.primary },
  muted: { color: colors.textMuted, bg: colors.bgSection },
};

export function AdminBadge({ label, variant = "muted" }: { label: string; variant?: Variant }) {
  const v = variantStyles[variant];
  return (
    <Text
      style={{
        color: v.color,
        backgroundColor: v.bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        fontWeight: "700",
        fontSize: 11,
        overflow: "hidden",
        textTransform: "capitalize",
      }}
    >
      {label.replace(/_/g, " ")}
    </Text>
  );
}
