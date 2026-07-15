import { Alert, Linking, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardModal } from "@/components/KeyboardModal";
import { colors, styles } from "@/constants/theme";
import type { Contractor } from "@/data/demoData";
import { contractorEmail, contractorPhone } from "@/lib/contractorUtils";

type ContractorViewerModalProps = {
  visible: boolean;
  contractor: Contractor | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit?: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

export function ContractorViewerModal({
  visible,
  contractor,
  onClose,
  onDelete,
  onEdit,
}: ContractorViewerModalProps) {
  if (!contractor) {
    return null;
  }

  const c = contractor;
  const phone = contractorPhone(c);
  const email = contractorEmail(c);

  async function handleCall() {
    if (!phone) return;
    const url = `tel:${phone.replace(/\s/g, "")}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert("Call Failed", e instanceof Error ? e.message : "Could not start call.");
    }
  }

  async function handleEmail() {
    if (!email) return;
    const url = `mailto:${email}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert("Email Failed", e instanceof Error ? e.message : "Could not open email app.");
    }
  }

  function handleDelete() {
    Alert.alert("Delete", `Remove "${c.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          onDelete(c.id);
          onClose();
        },
      },
    ]);
  }

  return (
    <KeyboardModal visible={visible} onRequestClose={onClose}>
      <View style={styles.rowBetween}>
        <Text style={[styles.modalTitle, { flex: 1, marginRight: 12 }]} numberOfLines={2}>
          {c.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {onEdit ? (
            <Pressable onPress={onEdit} hitSlop={8}>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>Edit</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <DetailRow label="Trade / Type" value={c.trade || "—"} />
      <DetailRow label="Phone" value={phone || "—"} />
      <DetailRow label="Email" value={email || "—"} />
      {c.lastUsed ? <DetailRow label="Last Used" value={c.lastUsed} /> : null}
      {c.licenseNumber ? <DetailRow label="License" value={c.licenseNumber} /> : null}
      {c.notes ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.label}>Notes</Text>
          <Text style={[styles.muted, { fontSize: 14, lineHeight: 20 }]}>{c.notes}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.primaryButton, !phone && { opacity: 0.5 }]}
        onPress={handleCall}
        disabled={!phone}
      >
        <Text style={styles.primaryButtonText}>Call</Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, !email && { opacity: 0.5 }]}
        onPress={handleEmail}
        disabled={!email}
      >
        <Text style={styles.secondaryButtonText}>Email</Text>
      </Pressable>

      <Pressable style={[styles.secondaryButton, { borderColor: colors.danger }]} onPress={handleDelete}>
        <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>Delete</Text>
      </Pressable>

      <Pressable style={styles.ghostButton} onPress={onClose}>
        <Text style={styles.ghostButtonText}>Close</Text>
      </Pressable>
      <View style={{ height: 20 }} />
    </KeyboardModal>
  );
}
