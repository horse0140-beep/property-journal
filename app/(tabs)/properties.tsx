import { ScrollView, Text, View, Pressable, Modal, TextInput, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { ScoreRing } from "@/components/ScoreRing";
import { colors, styles } from "@/constants/theme";
import { useHomeWise } from "@/context/HomeWiseContext";
import type { Property } from "@/context/HomeWiseContext";
import { useAuth } from "@/context/AuthContext";
import { useUpgrade } from "@/context/UpgradeContext";
import { canAddProperty } from "@/lib/premium";

type TypeOption = Property["type"];
const TYPE_OPTIONS: { value: TypeOption; label: string; icon: string }[] = [
  { value: "primary",    label: "Primary Home",   icon: "home" },
  { value: "rental",     label: "Rental",         icon: "key" },
  { value: "vacation",   label: "Vacation Home",  icon: "sunny" },
  { value: "investment", label: "Investment",     icon: "trending-up" },
];

const EMPTY_FORM = {
  nickname: "", address: "", city: "", state: "", zip: "",
  type: "primary" as TypeOption,
  yearBuilt: "", squareFeet: "", bedrooms: "", bathrooms: "",
  purchasePrice: "", estimatedValue: "", purchaseDate: "",
};

export default function PropertiesScreen() {
  const {
    properties,
    selectedPropertyId,
    selectProperty,
    addProperty,
    deleteProperty,
    getPropertyScore,
    isLoading,
    loadError,
    refreshData,
  } = useHomeWise();
  const { user, isAdmin } = useAuth();
  const { showUpgrade } = useUpgrade();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function openAddProperty() {
    if (!canAddProperty(properties.length, user?.plan, isAdmin)) {
      showUpgrade("unlimited_properties");
      return;
    }
    setShowAdd(true);
  }

  function save() {
    if (!form.address.trim()) {
      Alert.alert("Required", "Please enter the property address.");
      return;
    }
    if (!canAddProperty(properties.length, user?.plan, isAdmin)) {
      showUpgrade("unlimited_properties");
      return;
    }
    addProperty({ ...form, photoUri: undefined });
    setShowAdd(false);
    setForm(EMPTY_FORM);
  }

  function confirmDelete(id: string, address: string) {
    Alert.alert("Remove Property", `Remove "${address}" from HomeWise?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteProperty(id) },
    ]);
  }

  function scoreColor(v: number) {
    if (v >= 90) return colors.scoreExcellent;
    if (v >= 80) return colors.scoreGood;
    if (v >= 65) return colors.scoreFair;
    return colors.scorePoor;
  }

  return (
    <Screen noPad tabScreen>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={styles.screenTitle}>My Properties</Text>
        <Text style={styles.screenSubtitle}>{properties.length} {properties.length === 1 ? "property" : "properties"} tracked</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={{ height: 16 }} />

        {loadError ? (
          <Card style={{ backgroundColor: colors.dangerBg, borderColor: colors.danger }}>
            <Text style={{ color: colors.danger }}>{loadError}</Text>
            <Pressable style={[styles.secondaryButton, { marginTop: 8 }]} onPress={refreshData}>
              <Text style={styles.secondaryButtonText}>Retry</Text>
            </Pressable>
          </Card>
        ) : null}

        {properties.length === 0 && !loadError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No properties yet</Text>
            <Text style={styles.emptyStateText}>Add your first home to start tracking its history.</Text>
          </View>
        ) : null}

        {properties.map((p) => {
          const score = getPropertyScore(p.id);
          const isSelected = p.id === selectedPropertyId;
          return (
            <Pressable
              key={p.id}
              onPress={() => selectProperty(p.id)}
              style={({ pressed }) => [
                styles.card,
                isSelected && { borderColor: colors.primary, borderWidth: 2 },
                pressed && { opacity: 0.9 },
              ]}
            >
              {/* Row top */}
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    {isSelected && (
                      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>ACTIVE</Text>
                      </View>
                    )}
                    <View style={{ backgroundColor: colors.bgSection, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "700" }}>
                        {p.type.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800" }}>{p.address}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{p.city}, {p.state} {p.zip}</Text>
                </View>
                {/* Score mini */}
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  borderWidth: 5, borderColor: scoreColor(score.overall),
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: `${scoreColor(score.overall)}14`,
                }}>
                  <Text style={{ color: scoreColor(score.overall), fontSize: 20, fontWeight: "900" }}>{score.overall}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Details row */}
              <View style={{ flexDirection: "row", gap: 16 }}>
                {[
                  { label: "Built", value: p.yearBuilt },
                  { label: "Sq Ft", value: p.squareFeet },
                  { label: "Value", value: `$${p.estimatedValue}` },
                  { label: "Beds", value: p.bedrooms },
                ].map((item) => (
                  <View key={item.label}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "700" }}>{item.label}</Text>
                    <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 13 }}>{item.value}</Text>
                  </View>
                ))}
              </View>

              {/* Actions */}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                {!isSelected && (
                  <Pressable
                    onPress={() => selectProperty(p.id)}
                    style={[styles.primaryButton, { flex: 1, marginTop: 0 }]}
                  >
                    <Text style={styles.primaryButtonText}>Set Active</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => confirmDelete(p.id, p.address)}
                  style={[styles.secondaryButton, { flex: isSelected ? 1 : undefined, marginTop: 0, paddingVertical: 12 }]}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  {isSelected && <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 14 }}>Remove</Text>}
                </Pressable>
              </View>
            </Pressable>
          );
        })}

        {/* Add property CTA */}
        <Pressable
          onPress={openAddProperty}
          style={[styles.primaryButton, { flexDirection: "row", gap: 8 }]}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>Add Property</Text>
        </Pressable>
      </ScrollView>
      )}

      {/* ── Add Property Modal ──────────────────────────────────── */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalSheet} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHandle} />
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Add Property</Text>
              <Pressable onPress={() => setShowAdd(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.label}>Property Type</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {TYPE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => set("type", opt.value)}
                  style={[styles.chip, form.type === opt.value && styles.chipActive]}
                >
                  <Text style={form.type === opt.value ? styles.chipTextActive : styles.chipText}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Nickname (optional)</Text>
            <TextInput style={styles.input} placeholder="e.g. Lake House" placeholderTextColor={colors.textMuted} value={form.nickname} onChangeText={(v) => set("nickname", v)} />

            <Text style={styles.label}>Street Address *</Text>
            <TextInput style={styles.input} placeholder="123 Main Street" placeholderTextColor={colors.textMuted} value={form.address} onChangeText={(v) => set("address", v)} />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 2 }}>
                <Text style={styles.label}>City *</Text>
                <TextInput style={styles.input} placeholder="Austin" placeholderTextColor={colors.textMuted} value={form.city} onChangeText={(v) => set("city", v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>State</Text>
                <TextInput style={styles.input} placeholder="TX" placeholderTextColor={colors.textMuted} value={form.state} onChangeText={(v) => set("state", v)} maxLength={2} autoCapitalize="characters" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>ZIP</Text>
                <TextInput style={styles.input} placeholder="78701" placeholderTextColor={colors.textMuted} value={form.zip} onChangeText={(v) => set("zip", v)} keyboardType="numeric" maxLength={5} />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Year Built</Text>
                <TextInput style={styles.input} placeholder="2010" placeholderTextColor={colors.textMuted} value={form.yearBuilt} onChangeText={(v) => set("yearBuilt", v)} keyboardType="numeric" maxLength={4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Square Feet</Text>
                <TextInput style={styles.input} placeholder="2,000" placeholderTextColor={colors.textMuted} value={form.squareFeet} onChangeText={(v) => set("squareFeet", v)} keyboardType="numeric" />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Beds</Text>
                <TextInput style={styles.input} placeholder="3" placeholderTextColor={colors.textMuted} value={form.bedrooms} onChangeText={(v) => set("bedrooms", v)} keyboardType="numeric" maxLength={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Baths</Text>
                <TextInput style={styles.input} placeholder="2" placeholderTextColor={colors.textMuted} value={form.bathrooms} onChangeText={(v) => set("bathrooms", v)} keyboardType="numeric" maxLength={2} />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Purchase Price</Text>
                <TextInput style={styles.input} placeholder="400,000" placeholderTextColor={colors.textMuted} value={form.purchasePrice} onChangeText={(v) => set("purchasePrice", v)} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Est. Value</Text>
                <TextInput style={styles.input} placeholder="450,000" placeholderTextColor={colors.textMuted} value={form.estimatedValue} onChangeText={(v) => set("estimatedValue", v)} keyboardType="numeric" />
              </View>
            </View>

            <Text style={styles.label}>Purchase Date</Text>
            <TextInput style={styles.input} placeholder="March 2021" placeholderTextColor={colors.textMuted} value={form.purchaseDate} onChangeText={(v) => set("purchaseDate", v)} />

            <Pressable style={styles.primaryButton} onPress={save}>
              <Text style={styles.primaryButtonText}>Save Property</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => setShowAdd(false)}>
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}
