import {
  ScrollView, Text, View, Pressable, Modal,
  TextInput, Alert, TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingView } from "@/components/LoadingView";
import { ErrorCard } from "@/components/ErrorCard";
import { colors, styles } from "@/constants/theme";
import { useHomeWise } from "@/context/HomeWiseContext";
import type { MaintenanceItem, Repair } from "@/context/HomeWiseContext";

type Tab = "schedule" | "repairs" | "appliances" | "paint" | "contractors";

const TABS: { key: Tab; label: string }[] = [
  { key: "schedule",    label: "Schedule" },
  { key: "repairs",     label: "Repairs" },
  { key: "appliances",  label: "Appliances" },
  { key: "paint",       label: "Paint" },
  { key: "contractors", label: "Contacts" },
];

const CATEGORIES = ["HVAC", "Plumbing", "Roof", "Exterior", "Electrical", "Appliances", "Foundation", "Landscaping", "General"];
const REPAIR_CATEGORIES = ["HVAC", "Plumbing", "Roof", "Electrical", "Appliances", "Flooring", "Painting", "Landscaping", "Other"];
const TRADES = ["HVAC", "Plumbing", "Electrical", "Roofing", "Painting", "Flooring", "General Contractor", "Appliances", "Landscaping", "Cleaning"];
const FINISHES = ["Flat", "Eggshell", "Satin", "Semi-gloss", "Gloss", "High-gloss"];

function statusBadge(status: string) {
  if (status === "Overdue") return styles.badgeDanger;
  if (status === "Due Soon") return styles.badgeWarn;
  if (status === "Completed") return styles.badge;
  return styles.badgeInfo;
}

function conditionColor(c: string) {
  if (c === "Excellent") return colors.scoreExcellent;
  if (c === "Good") return colors.scoreGood;
  if (c === "Fair") return colors.scoreFair;
  return colors.scorePoor;
}

export default function MaintenanceScreen() {
  const {
    selectedProperty,
    maintenanceItems, addMaintenanceItem, deleteMaintenanceItem, completeMaintenanceItem, updateMaintenanceItem,
    repairs, addRepair, deleteRepair,
    appliances, addAppliance, deleteAppliance,
    paintColors, addPaintColor, deletePaintColor,
    contractors, addContractor, deleteContractor,
    isLoading,
    loadError,
    refreshData,
  } = useHomeWise();

  const [tab, setTab] = useState<Tab>("schedule");
  const [showModal, setShowModal] = useState(false);

  // Maintenance form
  const [mTitle, setMTitle] = useState("");
  const [mCategory, setMCategory] = useState("General");
  const [mNextDue, setMNextDue] = useState("");
  const [mNotes, setMNotes] = useState("");
  const [mPriority, setMPriority] = useState<"low"|"medium"|"high">("medium");

  // Repair form
  const [rTitle, setRTitle] = useState("");
  const [rDate, setRDate] = useState("");
  const [rCost, setRCost] = useState("");
  const [rContractor, setRContractor] = useState("");
  const [rCategory, setRCategory] = useState("General");
  const [rNotes, setRNotes] = useState("");
  const [rWarranty, setRWarranty] = useState("");

  // Appliance form
  const [aName, setAName] = useState("");
  const [aBrand, setABrand] = useState("");
  const [aModel, setAModel] = useState("");
  const [aSerial, setASerial] = useState("");
  const [aInstall, setAInstall] = useState("");
  const [aPrice, setAPrice] = useState("");
  const [aWarranty, setAWarranty] = useState("");
  const [aCondition, setACondition] = useState<"Excellent"|"Good"|"Fair"|"Poor"|"Replace Soon">("Good");
  const [aNotes, setANotes] = useState("");
  const [aLife, setALife] = useState("12");

  // Paint form
  const [pRoom, setPRoom] = useState("");
  const [pBrand, setPBrand] = useState("");
  const [pName, setPName] = useState("");
  const [pCode, setPCode] = useState("");
  const [pFinish, setPFinish] = useState("Eggshell");
  const [pHex, setPHex] = useState("#F5EFE2");
  const [pDate, setPDate] = useState("");
  const [pNotes, setPNotes] = useState("");

  // Contractor form
  const [cName, setCName] = useState("");
  const [cTrade, setCTrade] = useState("General Contractor");
  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cNotes, setCNotes] = useState("");

  const pid = selectedProperty?.id ?? "";

  function resetForms() {
    setMTitle(""); setMNextDue(""); setMNotes(""); setMCategory("General"); setMPriority("medium");
    setRTitle(""); setRDate(""); setRCost(""); setRContractor(""); setRCategory("General"); setRNotes(""); setRWarranty("");
    setAName(""); setABrand(""); setAModel(""); setASerial(""); setAInstall(""); setAPrice(""); setAWarranty(""); setACondition("Good"); setANotes(""); setALife("12");
    setPRoom(""); setPBrand(""); setPName(""); setPCode(""); setPFinish("Eggshell"); setPHex("#F5EFE2"); setPDate(""); setPNotes("");
    setCName(""); setCTrade("General Contractor"); setCPhone(""); setCEmail(""); setCNotes("");
  }

  function saveMaintenance() {
    if (!mTitle.trim()) { Alert.alert("Required", "Enter a maintenance item name."); return; }
    addMaintenanceItem({ propertyId: pid, title: mTitle, category: mCategory, lastCompleted: "Not yet", nextDue: mNextDue || "TBD", status: "Upcoming", notes: mNotes, recurring: true, intervalDays: 180, priority: mPriority });
    resetForms(); setShowModal(false);
  }

  function saveRepair() {
    if (!rTitle.trim()) { Alert.alert("Required", "Enter a repair name."); return; }
    addRepair({ propertyId: pid, title: rTitle, date: rDate || "Date not set", cost: rCost || "0", contractor: rContractor || "Not listed", category: rCategory, notes: rNotes, photoUris: [], warrantyExpires: rWarranty || undefined });
    resetForms(); setShowModal(false);
  }

  function saveAppliance() {
    if (!aName.trim()) { Alert.alert("Required", "Enter appliance name."); return; }
    addAppliance({ propertyId: pid, name: aName, category: "Appliance", brand: aBrand, model: aModel, serial: aSerial, installDate: aInstall, purchasePrice: aPrice, expectedLifeYears: parseInt(aLife) || 12, warrantyExpires: aWarranty, lastService: "Not recorded", nextService: "TBD", condition: aCondition, notes: aNotes });
    resetForms(); setShowModal(false);
  }

  function savePaint() {
    if (!pRoom.trim()) { Alert.alert("Required", "Enter a room."); return; }
    addPaintColor({ propertyId: pid, room: pRoom, brand: pBrand, colorName: pName, colorCode: pCode, finish: pFinish, hex: pHex.startsWith("#") ? pHex : `#${pHex}`, purchaseDate: pDate, notes: pNotes });
    resetForms(); setShowModal(false);
  }

  function saveContractor() {
    if (!cName.trim()) { Alert.alert("Required", "Enter contractor name."); return; }
    addContractor({ name: cName, trade: cTrade, phone: cPhone, email: cEmail, website: "", rating: 5, notes: cNotes, lastUsed: "Not recorded", licenseNumber: "" });
    resetForms(); setShowModal(false);
  }

  function handleSave() {
    if (tab === "schedule") saveMaintenance();
    else if (tab === "repairs") saveRepair();
    else if (tab === "appliances") saveAppliance();
    else if (tab === "paint") savePaint();
    else saveContractor();
  }

  const propMaintenance = maintenanceItems.filter((m) => m.propertyId === pid);
  const propRepairs = repairs.filter((r) => r.propertyId === pid);
  const propAppliances = appliances.filter((a) => a.propertyId === pid);
  const propPaints = paintColors.filter((p) => p.propertyId === pid);

  const addLabel: Record<Tab, string> = {
    schedule: "Add Task",
    repairs: "Add Repair",
    appliances: "Add Appliance",
    paint: "Add Color",
    contractors: "Add Contact",
  };

  if (isLoading) {
    return (
      <Screen noPad tabScreen>
        <LoadingView message="Loading maintenance data…" />
      </Screen>
    );
  }

  if (!selectedProperty) {
    return (
      <Screen noPad tabScreen>
        <EmptyState
          icon="construct-outline"
          title="No property selected"
          message="Add or select a property to track maintenance, repairs, and appliances."
        />
      </Screen>
    );
  }

  return (
    <Screen noPad tabScreen>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.screenTitle}>Maintenance</Text>
            <Text style={styles.screenSubtitle}>{selectedProperty?.address ?? "Select a property"}</Text>
          </View>
          <Pressable
            onPress={() => { resetForms(); setShowModal(true); }}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{addLabel[tab]}</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 6 }}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
                backgroundColor: tab === t.key ? colors.primary : colors.bgSection,
                borderWidth: 1,
                borderColor: tab === t.key ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: tab === t.key ? "#fff" : colors.textSecondary, fontWeight: "700", fontSize: 13 }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loadError ? <ErrorCard message={loadError} onRetry={refreshData} /> : null}
        <View style={{ height: 16 }} />

        {/* ── Schedule Tab ────────────────────────────────── */}
        {tab === "schedule" && (
          propMaintenance.length === 0 ? (
            <EmptyState icon="construct-outline" title="No maintenance items" message="Add your first maintenance task to start tracking your home's health." />
          ) : (
            propMaintenance.map((item) => (
              <Card key={item.id}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <View style={{ backgroundColor: colors.bgSection, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "700" }}>{item.category.toUpperCase()}</Text>
                      </View>
                      <View style={{ backgroundColor: item.priority === "high" ? colors.dangerBg : item.priority === "medium" ? colors.warningBg : colors.infoBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                        <Text style={{ color: item.priority === "high" ? colors.danger : item.priority === "medium" ? colors.warning : colors.info, fontSize: 10, fontWeight: "700" }}>{item.priority.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.muted}>Last: {item.lastCompleted}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Due: {item.nextDue}</Text>
                    {item.notes ? <Text style={[styles.muted, { marginTop: 6 }]}>{item.notes}</Text> : null}
                  </View>
                  <Text style={statusBadge(item.status)}>{item.status}</Text>
                </View>
                <View style={[styles.divider, { marginTop: 12 }]} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={() => completeMaintenanceItem(item.id)}
                    style={{ flex: 1, backgroundColor: colors.successBg, borderRadius: 10, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                    <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>Mark Done</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => Alert.alert("Delete", `Remove "${item.title}"?`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteMaintenanceItem(item.id) },
                    ])}
                    style={{ paddingHorizontal: 14, backgroundColor: colors.dangerBg, borderRadius: 10, paddingVertical: 10, alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              </Card>
            ))
          )
        )}

        {/* ── Repairs Tab ─────────────────────────────────── */}
        {tab === "repairs" && (
          propRepairs.length === 0 ? (
            <EmptyState icon="hammer-outline" title="No repairs logged" message="Log repairs and upgrades to build your home's history report." />
          ) : (
            propRepairs.map((r) => (
              <Card key={r.id}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <View style={{ backgroundColor: colors.bgSection, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start", marginBottom: 6 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "700" }}>{r.category.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.cardTitle}>{r.title}</Text>
                    <Text style={styles.muted}>{r.date} • Contractor: {r.contractor}</Text>
                    {r.warrantyExpires && <Text style={{ color: colors.info, fontSize: 12, marginTop: 3 }}>Warranty: expires {r.warrantyExpires}</Text>}
                    {r.notes ? <Text style={[styles.muted, { marginTop: 6 }]}>{r.notes}</Text> : null}
                  </View>
                  <Text style={styles.price}>${r.cost}</Text>
                </View>
                <Pressable onPress={() => Alert.alert("Delete", `Remove "${r.title}"?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => deleteRepair(r.id) },
                ])}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </Card>
            ))
          )
        )}

        {/* ── Appliances Tab ───────────────────────────────── */}
        {tab === "appliances" && (
          propAppliances.length === 0 ? (
            <EmptyState icon="hardware-chip-outline" title="No appliances added" message="Track every appliance — age, warranty, service history — all in one place." />
          ) : (
            propAppliances.map((a) => (
              <Card key={a.id}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{a.name}</Text>
                    <Text style={styles.muted}>{a.brand} {a.model && `• ${a.model}`}</Text>
                    {a.serial ? <Text style={styles.muted}>S/N: {a.serial}</Text> : null}
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>Installed: {a.installDate}</Text>
                    {a.warrantyExpires ? <Text style={{ color: colors.info, fontSize: 12, marginTop: 2 }}>Warranty: {a.warrantyExpires}</Text> : null}
                    {a.notes ? <Text style={[styles.muted, { marginTop: 6 }]}>{a.notes}</Text> : null}
                  </View>
                  <View>
                    <View style={{ backgroundColor: `${conditionColor(a.condition)}18`, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
                      <Text style={{ color: conditionColor(a.condition), fontWeight: "700", fontSize: 12 }}>{a.condition}</Text>
                    </View>
                    {a.purchasePrice ? <Text style={[styles.price, { textAlign: "right", marginTop: 6 }]}>${a.purchasePrice}</Text> : null}
                  </View>
                </View>
                <Pressable onPress={() => Alert.alert("Delete", `Remove "${a.name}"?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => deleteAppliance(a.id) },
                ])}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </Card>
            ))
          )
        )}

        {/* ── Paint Tab ───────────────────────────────────── */}
        {tab === "paint" && (
          propPaints.length === 0 ? (
            <EmptyState icon="color-palette-outline" title="No paint colors saved" message="Save every room's color so you can touch up easily years later." />
          ) : (
            propPaints.map((p) => (
              <Card key={p.id}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{p.room}</Text>
                    <Text style={styles.muted}>{p.brand} • {p.colorName} {p.colorCode && `(${p.colorCode})`}</Text>
                    <Text style={styles.muted}>Finish: {p.finish}</Text>
                    {p.purchaseDate ? <Text style={styles.muted}>Purchased: {p.purchaseDate}</Text> : null}
                    {p.notes ? <Text style={[styles.muted, { marginTop: 4 }]}>{p.notes}</Text> : null}
                  </View>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: p.hex || "#ccc", borderWidth: 3, borderColor: colors.border }} />
                </View>
                <Pressable onPress={() => deletePaintColor(p.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </Card>
            ))
          )
        )}

        {/* ── Contractors Tab ──────────────────────────────── */}
        {tab === "contractors" && (
          contractors.length === 0 ? (
            <EmptyState icon="people-outline" title="No contractors saved" message="Keep your best contractors here so you never lose their number." />
          ) : (
            contractors.map((c) => (
              <Card key={c.id}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{c.name}</Text>
                    <View style={{ backgroundColor: colors.bgSection, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start", marginBottom: 6 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "700" }}>{c.trade.toUpperCase()}</Text>
                    </View>
                    {c.phone ? <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>{c.phone}</Text> : null}
                    {c.email ? <Text style={styles.muted}>{c.email}</Text> : null}
                    {c.notes ? <Text style={[styles.muted, { marginTop: 6 }]}>{c.notes}</Text> : null}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {Array.from({ length: c.rating }).map((_, i) => (
                      <Ionicons key={i} name="star" size={14} color={colors.gold} style={{ marginLeft: 2 }} />
                    ))}
                  </View>
                </View>
                <Pressable onPress={() => Alert.alert("Delete", `Remove "${c.name}"?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => deleteContractor(c.id) },
                ])}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </Card>
            ))
          )
        )}
      </ScrollView>

      {/* ── Add Modal ─────────────────────────────────────────── */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalSheet} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHandle} />
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>{addLabel[tab]}</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* ── Maintenance form ── */}
            {tab === "schedule" && <>
              <Text style={styles.label}>Task Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. HVAC filter change" placeholderTextColor={colors.textMuted} value={mTitle} onChangeText={setMTitle} />
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {CATEGORIES.map((c) => (
                  <Pressable key={c} style={mCategory === c ? styles.chipActive : styles.chip} onPress={() => setMCategory(c)}>
                    <Text style={mCategory === c ? styles.chipTextActive : styles.chipText}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.label}>Priority</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["low","medium","high"] as const).map((p) => (
                  <Pressable key={p} style={[styles.chip, mPriority === p && styles.chipActive, { flex: 1 }]} onPress={() => setMPriority(p)}>
                    <Text style={[{ textAlign: "center" }, mPriority === p ? styles.chipTextActive : styles.chipText]}>{p.charAt(0).toUpperCase()+p.slice(1)}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Next Due Date</Text>
              <TextInput style={styles.input} placeholder="e.g. Jun 2026" placeholderTextColor={colors.textMuted} value={mNextDue} onChangeText={setMNextDue} />
              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Additional notes..." placeholderTextColor={colors.textMuted} value={mNotes} onChangeText={setMNotes} multiline />
            </>}

            {/* ── Repair form ── */}
            {tab === "repairs" && <>
              <Text style={styles.label}>Repair / Upgrade *</Text>
              <TextInput style={styles.input} placeholder="e.g. Replaced roof shingles" placeholderTextColor={colors.textMuted} value={rTitle} onChangeText={setRTitle} />
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {REPAIR_CATEGORIES.map((c) => (
                  <Pressable key={c} style={rCategory === c ? styles.chipActive : styles.chip} onPress={() => setRCategory(c)}>
                    <Text style={rCategory === c ? styles.chipTextActive : styles.chipText}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Date</Text>
                  <TextInput style={styles.input} placeholder="May 2024" placeholderTextColor={colors.textMuted} value={rDate} onChangeText={setRDate} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Cost ($)</Text>
                  <TextInput style={styles.input} placeholder="1,200" placeholderTextColor={colors.textMuted} value={rCost} onChangeText={setRCost} keyboardType="numeric" />
                </View>
              </View>
              <Text style={styles.label}>Contractor</Text>
              <TextInput style={styles.input} placeholder="Company name" placeholderTextColor={colors.textMuted} value={rContractor} onChangeText={setRContractor} />
              <Text style={styles.label}>Warranty Expires (optional)</Text>
              <TextInput style={styles.input} placeholder="May 2026" placeholderTextColor={colors.textMuted} value={rWarranty} onChangeText={setRWarranty} />
              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Details, invoice #, etc." placeholderTextColor={colors.textMuted} value={rNotes} onChangeText={setRNotes} multiline />
            </>}

            {/* ── Appliance form ── */}
            {tab === "appliances" && <>
              <Text style={styles.label}>Appliance Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. HVAC System" placeholderTextColor={colors.textMuted} value={aName} onChangeText={setAName} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Brand</Text>
                  <TextInput style={styles.input} placeholder="Lennox" placeholderTextColor={colors.textMuted} value={aBrand} onChangeText={setABrand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Model #</Text>
                  <TextInput style={styles.input} placeholder="XC21-048" placeholderTextColor={colors.textMuted} value={aModel} onChangeText={setAModel} />
                </View>
              </View>
              <Text style={styles.label}>Serial Number</Text>
              <TextInput style={styles.input} placeholder="Serial number" placeholderTextColor={colors.textMuted} value={aSerial} onChangeText={setASerial} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Install Date</Text>
                  <TextInput style={styles.input} placeholder="Jun 2021" placeholderTextColor={colors.textMuted} value={aInstall} onChangeText={setAInstall} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Purchase Price</Text>
                  <TextInput style={styles.input} placeholder="5,800" placeholderTextColor={colors.textMuted} value={aPrice} onChangeText={setAPrice} keyboardType="numeric" />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Warranty Expires</Text>
                  <TextInput style={styles.input} placeholder="Jun 2031" placeholderTextColor={colors.textMuted} value={aWarranty} onChangeText={setAWarranty} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Exp. Life (yrs)</Text>
                  <TextInput style={styles.input} placeholder="15" placeholderTextColor={colors.textMuted} value={aLife} onChangeText={setALife} keyboardType="numeric" />
                </View>
              </View>
              <Text style={styles.label}>Condition</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["Excellent","Good","Fair","Poor","Replace Soon"] as const).map((c) => (
                  <Pressable key={c} style={[styles.chip, aCondition === c && styles.chipActive]} onPress={() => setACondition(c)}>
                    <Text style={aCondition === c ? styles.chipTextActive : styles.chipText}>{c}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Filter size, service notes, etc." placeholderTextColor={colors.textMuted} value={aNotes} onChangeText={setANotes} multiline />
            </>}

            {/* ── Paint form ── */}
            {tab === "paint" && <>
              <Text style={styles.label}>Room *</Text>
              <TextInput style={styles.input} placeholder="e.g. Living Room" placeholderTextColor={colors.textMuted} value={pRoom} onChangeText={setPRoom} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Brand</Text>
                  <TextInput style={styles.input} placeholder="Sherwin-Williams" placeholderTextColor={colors.textMuted} value={pBrand} onChangeText={setPBrand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Color Code</Text>
                  <TextInput style={styles.input} placeholder="SW 7036" placeholderTextColor={colors.textMuted} value={pCode} onChangeText={setPCode} />
                </View>
              </View>
              <Text style={styles.label}>Color Name</Text>
              <TextInput style={styles.input} placeholder="Accessible Beige" placeholderTextColor={colors.textMuted} value={pName} onChangeText={setPName} />
              <Text style={styles.label}>Hex Color (preview)</Text>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="#F5EFE2" placeholderTextColor={colors.textMuted} value={pHex} onChangeText={setPHex} autoCapitalize="characters" maxLength={7} />
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: pHex.length >= 4 ? pHex : "#ccc", borderWidth: 2, borderColor: colors.border }} />
              </View>
              <Text style={styles.label}>Finish</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {FINISHES.map((f) => (
                  <Pressable key={f} style={pFinish === f ? styles.chipActive : styles.chip} onPress={() => setPFinish(f)}>
                    <Text style={pFinish === f ? styles.chipTextActive : styles.chipText}>{f}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.label}>Date Purchased</Text>
              <TextInput style={styles.input} placeholder="Aug 2021" placeholderTextColor={colors.textMuted} value={pDate} onChangeText={setPDate} />
              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Touch-up notes, coats used, etc." placeholderTextColor={colors.textMuted} value={pNotes} onChangeText={setPNotes} multiline />
            </>}

            {/* ── Contractor form ── */}
            {tab === "contractors" && <>
              <Text style={styles.label}>Name *</Text>
              <TextInput style={styles.input} placeholder="Company or person name" placeholderTextColor={colors.textMuted} value={cName} onChangeText={setCName} />
              <Text style={styles.label}>Trade</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {TRADES.map((t) => (
                  <Pressable key={t} style={cTrade === t ? styles.chipActive : styles.chip} onPress={() => setCTrade(t)}>
                    <Text style={cTrade === t ? styles.chipTextActive : styles.chipText}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.label}>Phone</Text>
              <TextInput style={styles.input} placeholder="555-555-5555" placeholderTextColor={colors.textMuted} value={cPhone} onChangeText={setCPhone} keyboardType="phone-pad" />
              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} placeholder="contact@company.com" placeholderTextColor={colors.textMuted} value={cEmail} onChangeText={setCEmail} keyboardType="email-address" autoCapitalize="none" />
              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Quality, price notes, ask for..." placeholderTextColor={colors.textMuted} value={cNotes} onChangeText={setCNotes} multiline />
            </>}

            <Pressable style={styles.primaryButton} onPress={handleSave}>
              <Text style={styles.primaryButtonText}>{addLabel[tab]}</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => setShowModal(false)}>
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </Pressable>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}
