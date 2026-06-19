import {
  ScrollView,
  Text,
  View,
  Pressable,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  type LayoutChangeEvent,
  type TextInput as TextInputType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useRef, useState } from "react";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { ScoreRing } from "@/components/ScoreRing";
import { colors, styles } from "@/constants/theme";
import { useHomeWise } from "@/context/HomeWiseContext";
import type { Property } from "@/context/HomeWiseContext";
import { useAuth } from "@/context/AuthContext";
import { useUpgrade } from "@/context/UpgradeContext";
import { canAddProperty } from "@/lib/premium";
import { useTabScrollContentStyle } from "@/constants/layout";

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
    updateProperty,
    deleteProperty,
    getPropertyScore,
    isLoading,
    loadError,
    refreshData,
  } = useHomeWise();
  const { user, isAdmin } = useAuth();
  const { showUpgrade } = useUpgrade();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const tabScrollStyle = useTabScrollContentStyle();

  const formScrollRef = useRef<ScrollView>(null);
  const fieldPositions = useRef<Record<string, number>>({});
  const nicknameRef = useRef<TextInputType>(null);
  const addressRef = useRef<TextInputType>(null);
  const cityRef = useRef<TextInputType>(null);
  const stateRef = useRef<TextInputType>(null);
  const zipRef = useRef<TextInputType>(null);
  const yearBuiltRef = useRef<TextInputType>(null);
  const squareFeetRef = useRef<TextInputType>(null);
  const bedroomsRef = useRef<TextInputType>(null);
  const bathroomsRef = useRef<TextInputType>(null);
  const purchasePriceRef = useRef<TextInputType>(null);
  const estimatedValueRef = useRef<TextInputType>(null);
  const purchaseDateRef = useRef<TextInputType>(null);

  const scrollFieldIntoView = useCallback((key: string) => {
    requestAnimationFrame(() => {
      const y = fieldPositions.current[key];
      if (y != null) {
        formScrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
      }
    });
  }, []);

  const fieldWrapProps = useCallback(
    (key: string) => ({
      onLayout: (e: LayoutChangeEvent) => {
        fieldPositions.current[key] = e.nativeEvent.layout.y;
      },
    }),
    []
  );

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function openAddProperty() {
    if (!canAddProperty(properties.length, user?.plan, isAdmin, user?.email)) {
      showUpgrade("unlimited_properties");
      return;
    }
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowAdd(true);
  }

  function openEditProperty(p: Property) {
    setEditingId(p.id);
    setForm({
      nickname: p.nickname ?? "",
      address: p.address,
      city: p.city ?? "",
      state: p.state ?? "",
      zip: p.zip ?? "",
      type: p.type,
      yearBuilt: p.yearBuilt ?? "",
      squareFeet: p.squareFeet ?? "",
      bedrooms: p.bedrooms ?? "",
      bathrooms: p.bathrooms ?? "",
      purchasePrice: p.purchasePrice ?? "",
      estimatedValue: p.estimatedValue ?? "",
      purchaseDate: p.purchaseDate ?? "",
    });
    setShowAdd(true);
  }

  function closeModal() {
    setShowAdd(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function save() {
    if (!form.address.trim()) {
      Alert.alert("Required", "Please enter the property address.");
      return;
    }
    if (!editingId && !canAddProperty(properties.length, user?.plan, isAdmin, user?.email)) {
      showUpgrade("unlimited_properties");
      return;
    }
    if (editingId) {
      updateProperty(editingId, { ...form });
    } else {
      addProperty({ ...form });
    }
    closeModal();
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
      <ScrollView contentContainerStyle={tabScrollStyle}>
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
                  { label: "Value", value: p.estimatedValue ? `$${p.estimatedValue}` : "—" },
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
                <Pressable
                  onPress={() => openEditProperty(p)}
                  style={[styles.secondaryButton, { flex: 1, marginTop: 0, paddingVertical: 12, flexDirection: "row", gap: 6, justifyContent: "center" }]}
                >
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>Edit</Text>
                </Pressable>
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
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
        >
          <View style={[styles.modalSheet, { maxHeight: "92%", paddingBottom: 0 }]}>
            <View style={styles.modalHandle} />
            <View style={[styles.rowBetween, { paddingTop: 4 }]}>
              <Text style={styles.modalTitle}>{editingId ? "Edit Property" : "Add Property"}</Text>
              <Pressable onPress={closeModal}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              ref={formScrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{ paddingTop: 8, paddingBottom: 48 }}
            >
              <View {...fieldWrapProps("type")}>
                <Text style={styles.label}>Property Type</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {TYPE_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => set("type", opt.value)}
                      style={[styles.chip, form.type === opt.value && styles.chipActive]}
                    >
                      <Text style={form.type === opt.value ? styles.chipTextActive : styles.chipText}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View {...fieldWrapProps("nickname")}>
                <Text style={styles.label}>Nickname (optional)</Text>
                <TextInput
                  ref={nicknameRef}
                  style={styles.input}
                  placeholder="e.g. Lake House"
                  placeholderTextColor={colors.textMuted}
                  value={form.nickname}
                  onChangeText={(v) => set("nickname", v)}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => addressRef.current?.focus()}
                  onFocus={() => scrollFieldIntoView("nickname")}
                />
              </View>

              <View {...fieldWrapProps("address")}>
                <Text style={styles.label}>Street Address *</Text>
                <TextInput
                  ref={addressRef}
                  style={styles.input}
                  placeholder="123 Main Street"
                  placeholderTextColor={colors.textMuted}
                  value={form.address}
                  onChangeText={(v) => set("address", v)}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => cityRef.current?.focus()}
                  onFocus={() => scrollFieldIntoView("address")}
                />
              </View>

              <View {...fieldWrapProps("cityRow")}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.label}>City *</Text>
                    <TextInput
                      ref={cityRef}
                      style={styles.input}
                      placeholder="Austin"
                      placeholderTextColor={colors.textMuted}
                      value={form.city}
                      onChangeText={(v) => set("city", v)}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => stateRef.current?.focus()}
                      onFocus={() => scrollFieldIntoView("cityRow")}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>State</Text>
                    <TextInput
                      ref={stateRef}
                      style={styles.input}
                      placeholder="TX"
                      placeholderTextColor={colors.textMuted}
                      value={form.state}
                      onChangeText={(v) => set("state", v)}
                      maxLength={2}
                      autoCapitalize="characters"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => zipRef.current?.focus()}
                      onFocus={() => scrollFieldIntoView("cityRow")}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>ZIP</Text>
                    <TextInput
                      ref={zipRef}
                      style={styles.input}
                      placeholder="78701"
                      placeholderTextColor={colors.textMuted}
                      value={form.zip}
                      onChangeText={(v) => set("zip", v)}
                      keyboardType="numeric"
                      maxLength={5}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => yearBuiltRef.current?.focus()}
                      onFocus={() => scrollFieldIntoView("cityRow")}
                    />
                  </View>
                </View>
              </View>

              <View {...fieldWrapProps("sizeRow")}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Year Built</Text>
                    <TextInput
                      ref={yearBuiltRef}
                      style={styles.input}
                      placeholder="2010"
                      placeholderTextColor={colors.textMuted}
                      value={form.yearBuilt}
                      onChangeText={(v) => set("yearBuilt", v)}
                      keyboardType="numeric"
                      maxLength={4}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => squareFeetRef.current?.focus()}
                      onFocus={() => scrollFieldIntoView("sizeRow")}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Square Feet</Text>
                    <TextInput
                      ref={squareFeetRef}
                      style={styles.input}
                      placeholder="2,000"
                      placeholderTextColor={colors.textMuted}
                      value={form.squareFeet}
                      onChangeText={(v) => set("squareFeet", v)}
                      keyboardType="numeric"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => bedroomsRef.current?.focus()}
                      onFocus={() => scrollFieldIntoView("sizeRow")}
                    />
                  </View>
                </View>
              </View>

              <View {...fieldWrapProps("bedsRow")}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Beds</Text>
                    <TextInput
                      ref={bedroomsRef}
                      style={styles.input}
                      placeholder="3"
                      placeholderTextColor={colors.textMuted}
                      value={form.bedrooms}
                      onChangeText={(v) => set("bedrooms", v)}
                      keyboardType="numeric"
                      maxLength={2}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => bathroomsRef.current?.focus()}
                      onFocus={() => scrollFieldIntoView("bedsRow")}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Baths</Text>
                    <TextInput
                      ref={bathroomsRef}
                      style={styles.input}
                      placeholder="2"
                      placeholderTextColor={colors.textMuted}
                      value={form.bathrooms}
                      onChangeText={(v) => set("bathrooms", v)}
                      keyboardType="numeric"
                      maxLength={2}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => purchasePriceRef.current?.focus()}
                      onFocus={() => scrollFieldIntoView("bedsRow")}
                    />
                  </View>
                </View>
              </View>

              <View {...fieldWrapProps("valueRow")}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Purchase Price</Text>
                    <TextInput
                      ref={purchasePriceRef}
                      style={styles.input}
                      placeholder="400,000"
                      placeholderTextColor={colors.textMuted}
                      value={form.purchasePrice}
                      onChangeText={(v) => set("purchasePrice", v)}
                      keyboardType="numeric"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => estimatedValueRef.current?.focus()}
                      onFocus={() => scrollFieldIntoView("valueRow")}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Est. Value</Text>
                    <TextInput
                      ref={estimatedValueRef}
                      style={styles.input}
                      placeholder="450,000"
                      placeholderTextColor={colors.textMuted}
                      value={form.estimatedValue}
                      onChangeText={(v) => set("estimatedValue", v)}
                      keyboardType="numeric"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => purchaseDateRef.current?.focus()}
                      onFocus={() => scrollFieldIntoView("valueRow")}
                    />
                  </View>
                </View>
              </View>

              <View {...fieldWrapProps("purchaseDate")}>
                <Text style={styles.label}>Purchase Date</Text>
                <TextInput
                  ref={purchaseDateRef}
                  style={styles.input}
                  placeholder="March 2021"
                  placeholderTextColor={colors.textMuted}
                  value={form.purchaseDate}
                  onChangeText={(v) => set("purchaseDate", v)}
                  returnKeyType="done"
                  onFocus={() => scrollFieldIntoView("actions")}
                />
              </View>

              <View {...fieldWrapProps("actions")}>
                <Pressable style={styles.primaryButton} onPress={save}>
                  <Text style={styles.primaryButtonText}>{editingId ? "Save Changes" : "Save Property"}</Text>
                </Pressable>
                <Pressable style={styles.ghostButton} onPress={closeModal}>
                  <Text style={styles.ghostButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}
