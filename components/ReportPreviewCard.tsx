import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { colors, styles } from "@/constants/theme";
import type { PropertyScore } from "@/context/HomeWiseContext";
import type { SavedReport } from "@/services/reportService";

type Props = {
  propertyAddress: string;
  ownerName: string;
  score: PropertyScore;
  maintenanceCount: number;
  repairCount: number;
  applianceCount: number;
  warrantyCount: number;
  receiptCount: number;
  documentCount: number;
  photoCount: number;
  lastSaved?: SavedReport | null;
  hasPdf?: boolean;
  locked?: boolean;
  generating?: boolean;
  previewing?: boolean;
  sharing?: boolean;
  saving?: boolean;
  onGenerate: () => void;
  onPreview: () => void;
  onShare: () => void;
  onSave: () => void;
  onUpgrade?: () => void;
};

function StatPill({ label, value, icon }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: "30%",
        backgroundColor: colors.bgSection,
        borderRadius: 12,
        padding: 12,
        alignItems: "center",
      }}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={{ color: colors.primary, fontWeight: "900", fontSize: 18, marginTop: 4 }}>
        {value}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "700", marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

export function ReportPreviewCard({
  propertyAddress,
  ownerName,
  score,
  maintenanceCount,
  repairCount,
  applianceCount,
  warrantyCount,
  receiptCount,
  documentCount,
  photoCount,
  lastSaved,
  hasPdf = false,
  locked = false,
  generating = false,
  previewing = false,
  sharing = false,
  saving = false,
  onGenerate,
  onPreview,
  onShare,
  onSave,
  onUpgrade,
}: Props) {
  function scoreColor(v: number) {
    if (v >= 90) return colors.scoreExcellent;
    if (v >= 80) return colors.scoreGood;
    if (v >= 65) return colors.scoreFair;
    return colors.scorePoor;
  }

  const accent = scoreColor(score.overall);
  const busy = generating || previewing || sharing || saving;

  return (
    <Card elevated>
      <View style={{ alignItems: "center", paddingBottom: 8 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.bgSection,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 10,
          }}
        >
          <Ionicons name="document-text" size={36} color={colors.primary} />
        </View>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "900" }}>
          Home History Report™
        </Text>
        <Text style={[styles.muted, { textAlign: "center", marginTop: 6, lineHeight: 20 }]}>
          {propertyAddress}
        </Text>
        <Text style={[styles.muted, { fontSize: 12, marginTop: 4 }]}>Owner: {ownerName}</Text>
      </View>

      <View
        style={{
          alignItems: "center",
          paddingVertical: 16,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
          marginVertical: 14,
        }}
      >
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            borderWidth: 8,
            borderColor: accent,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: `${accent}14`,
          }}
        >
          <Text style={{ color: accent, fontSize: 36, fontWeight: "900" }}>{score.overall}</Text>
        </View>
        <Text style={{ color: accent, fontWeight: "800", marginTop: 6 }}>{score.label}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
          Home Health Score™
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <StatPill label="Maintenance" value={maintenanceCount} icon="construct-outline" />
        <StatPill label="Repairs" value={repairCount} icon="hammer-outline" />
        <StatPill label="Appliances" value={applianceCount} icon="hardware-chip-outline" />
        <StatPill label="Warranties" value={warrantyCount} icon="shield-checkmark-outline" />
        <StatPill label="Receipts" value={receiptCount} icon="receipt-outline" />
        <StatPill label="Documents" value={documentCount} icon="folder-outline" />
        <StatPill label="Photos" value={photoCount} icon="images-outline" />
      </View>

      {lastSaved ? (
        <View
          style={{
            backgroundColor: colors.successBg,
            borderRadius: 12,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>
            Last saved {new Date(lastSaved.generated_at).toLocaleDateString()}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
            Score {lastSaved.health_score}/100 · {lastSaved.title}
          </Text>
        </View>
      ) : null}

      {locked ? (
        <View
          style={{
            backgroundColor: colors.warningBg,
            borderRadius: 14,
            padding: 16,
            alignItems: "center",
            gap: 10,
          }}
        >
          <Ionicons name="lock-closed" size={28} color={colors.gold} />
          <Text style={{ color: colors.textPrimary, fontWeight: "800", textAlign: "center" }}>
            Premium Required
          </Text>
          <Text style={[styles.muted, { textAlign: "center", lineHeight: 20 }]}>
            Upgrade to Premium to generate, preview, and share professional PDF Home History
            Reports.
          </Text>
          <Pressable style={styles.primaryButton} onPress={onUpgrade}>
            <Ionicons name="star" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Upgrade to Premium</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Pressable
            style={[styles.primaryButton, busy && { opacity: 0.7 }]}
            onPress={onGenerate}
            disabled={busy}
          >
            {generating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="document-text-outline" size={20} color="#fff" />
            )}
            <Text style={styles.primaryButtonText}>
              {generating ? "Generating…" : "Generate Report"}
            </Text>
          </Pressable>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={[styles.secondaryButton, { flex: 1, marginTop: 0 }, busy && { opacity: 0.7 }]}
              onPress={onPreview}
              disabled={busy}
            >
              {previewing ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Ionicons name="eye-outline" size={18} color={colors.primary} />
              )}
              <Text style={styles.secondaryButtonText}>Preview</Text>
            </Pressable>

            <Pressable
              style={[
                styles.secondaryButton,
                { flex: 1, marginTop: 0 },
                (!hasPdf || busy) && { opacity: 0.5 },
              ]}
              onPress={onShare}
              disabled={!hasPdf || busy}
            >
              {sharing ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Ionicons name="share-outline" size={18} color={colors.primary} />
              )}
              <Text style={styles.secondaryButtonText}>Share PDF</Text>
            </Pressable>
          </View>

          <Pressable
            style={[
              styles.secondaryButton,
              { marginTop: 0, borderColor: colors.success },
              (!hasPdf || busy) && { opacity: 0.5 },
            ]}
            onPress={onSave}
            disabled={!hasPdf || busy}
          >
            {saving ? (
              <ActivityIndicator color={colors.success} size="small" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={18} color={colors.success} />
            )}
            <Text style={[styles.secondaryButtonText, { color: colors.success }]}>Save Report</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}
