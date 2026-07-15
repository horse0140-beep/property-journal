import { StyleSheet } from "react-native";

export const colors = {
  // Primary blues
  primary: "#1A3C8F",
  primaryDark: "#0F2460",
  primaryLight: "#2B52B8",
  accent: "#3B82F6",
  accentLight: "#60A5FA",

  // Backgrounds
  bg: "#F0F4FF",
  bgCard: "#FFFFFF",
  bgSection: "#EEF2FF",

  // Text
  textPrimary: "#0F1F3D",
  textSecondary: "#4A5568",
  textMuted: "#8A9AB8",
  textLight: "#FFFFFF",

  // Status
  success: "#16A34A",
  successBg: "#DCFCE7",
  warning: "#D97706",
  warningBg: "#FEF3C7",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
  info: "#0284C7",
  infoBg: "#E0F2FE",

  // Borders
  border: "#DDE3F0",
  borderLight: "#EEF2FF",

  // Score colors
  scoreExcellent: "#16A34A",
  scoreGood: "#2563EB",
  scoreFair: "#D97706",
  scorePoor: "#DC2626",

  // Misc
  gold: "#F59E0B",
  shadow: "rgba(15,31,61,0.1)",
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 999,
};

/** Minimum tappable height per Apple HIG / Material guidance. */
export const touchTarget = 48;

export const hitSlopDefault = { top: 8, bottom: 8, left: 8, right: 8 };

export const shadow = {
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const styles = StyleSheet.create({
  // ── Layout ─────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 108,
  },
  // ── Cards ──────────────────────────────────────────────
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  cardElevated: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 14,
    ...shadow.md,
  },
  // ── Typography ─────────────────────────────────────────
  screenTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  screenSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 16,
  },
  /** Use inside TabScreenHeader — no extra bottom margin. */
  tabHeaderTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 2,
  },
  tabHeaderSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginBottom: 10,
    marginTop: 4,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
    marginTop: 12,
  },
  price: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "800",
  },
  // ── Rows ───────────────────────────────────────────────
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  rowStart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  // ── Badges ─────────────────────────────────────────────
  badge: {
    color: colors.success,
    backgroundColor: colors.successBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    fontWeight: "700",
    overflow: "hidden",
    fontSize: 12,
  },
  badgeWarn: {
    color: colors.warning,
    backgroundColor: colors.warningBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    fontWeight: "700",
    overflow: "hidden",
    fontSize: 12,
  },
  badgeDanger: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    fontWeight: "700",
    overflow: "hidden",
    fontSize: 12,
  },
  badgeInfo: {
    color: colors.info,
    backgroundColor: colors.infoBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    fontWeight: "700",
    overflow: "hidden",
    fontSize: 12,
  },
  badgePrimary: {
    color: colors.textLight,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    fontWeight: "700",
    overflow: "hidden",
    fontSize: 12,
  },
  // ── Buttons ────────────────────────────────────────────
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: touchTarget,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    ...shadow.sm,
  },
  primaryButtonText: {
    color: colors.textLight,
    fontWeight: "800",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: colors.bgSection,
    borderRadius: radius.md,
    minHeight: touchTarget,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 15,
  },
  ghostButton: {
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: 8,
  },
  ghostButtonText: {
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 14,
  },
  deleteText: {
    color: colors.danger,
    fontWeight: "700",
    marginTop: 12,
    fontSize: 14,
  },
  // ── Inputs ─────────────────────────────────────────────
  input: {
    backgroundColor: colors.bgSection,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 13,
    color: colors.textPrimary,
    fontSize: 15,
  },
  inputFocused: {
    borderColor: colors.accent,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  // ── Stats ──────────────────────────────────────────────
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    ...shadow.sm,
  },
  statValue: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 2,
  },
  // ── Health bar ─────────────────────────────────────────
  healthBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bgSection,
    marginTop: 6,
    overflow: "hidden",
  },
  healthBarFill: {
    height: 6,
    borderRadius: 3,
  },
  // ── Tabs ───────────────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.bgSection,
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: radius.md,
  },
  tabItemActive: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    ...shadow.sm,
  },
  tabItemText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 13,
  },
  tabItemTextActive: {
    color: colors.textLight,
    fontWeight: "800",
    fontSize: 13,
  },
  // ── Modal ──────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,31,61,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 16,
  },
  // ── Section labels ─────────────────────────────────────
  sectionLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 4,
  },
  viewAllText: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 13,
  },
  // ── Chips ──────────────────────────────────────────────
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.bgSection,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.textLight,
    fontWeight: "700",
    fontSize: 13,
  },
  // ── Empty state ────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyStateText: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
    fontSize: 14,
  },
  emptyStateTitle: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
    marginTop: 10,
  },
  // ── Divider ────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  // ── Icon containers ────────────────────────────────────
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgSection,
  },
  iconCirclePrimary: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  iconCircleSm: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgSection,
  },
});
