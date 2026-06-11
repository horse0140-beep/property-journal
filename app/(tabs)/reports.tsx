import {
  ScrollView, Text, View, Pressable,
  Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { ScoreBar } from "@/components/ScoreRing";
import { LoadingView } from "@/components/LoadingView";
import { ErrorCard } from "@/components/ErrorCard";
import { EmptyState } from "@/components/EmptyState";
import { colors, styles } from "@/constants/theme";
import { useHomeWise } from "@/context/HomeWiseContext";
import { useAuth } from "@/context/AuthContext";
import { useUpgrade } from "@/context/UpgradeContext";
import { generateHomeHistoryPDF, sharePDF } from "@/lib/pdfGenerator";

type Tab = "score" | "report";

function ScoreGauge({ score }: { score: number }) {
  function color(v: number) {
    if (v >= 90) return colors.scoreExcellent;
    if (v >= 80) return colors.scoreGood;
    if (v >= 65) return colors.scoreFair;
    return colors.scorePoor;
  }
  function label(v: number) {
    if (v >= 90) return "Excellent";
    if (v >= 80) return "Very Good";
    if (v >= 65) return "Good";
    return "Fair";
  }
  const c = color(score);
  return (
    <View style={{ alignItems: "center", paddingVertical: 20 }}>
      <View style={{ width: 160, height: 160, borderRadius: 80, borderWidth: 12, borderColor: c, backgroundColor: `${c}14`, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: c, fontSize: 52, fontWeight: "900", lineHeight: 56 }}>{score}</Text>
        <Text style={{ color: c, fontSize: 14, fontWeight: "800" }}>{label(score)}</Text>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 10 }}>Home Health Score™</Text>
    </View>
  );
}

export default function ReportsScreen() {
  const {
    selectedProperty,
    maintenanceItems, repairs, appliances, documents, contractors,
    getPropertyScore,
    isLoading,
    loadError,
    refreshData,
  } = useHomeWise();
  const { user } = useAuth();
  const { requireFeature } = useUpgrade();

  const [tab, setTab] = useState<Tab>("score");
  const [generatingPDF, setGeneratingPDF] = useState(false);

  if (isLoading) {
    return (
      <Screen noPad tabScreen>
        <LoadingView message="Loading reports…" />
      </Screen>
    );
  }

  if (!selectedProperty) {
    return (
      <Screen noPad tabScreen>
        <EmptyState
          icon="document-text-outline"
          title="No property selected"
          message="Add a property to view health scores and generate PDF reports."
        />
      </Screen>
    );
  }

  const pid = selectedProperty.id;
  const score = getPropertyScore(pid);
  const propMaint   = maintenanceItems.filter((m) => m.propertyId === pid);
  const propRepairs = repairs.filter((r) => r.propertyId === pid);
  const propApps    = appliances.filter((a) => a.propertyId === pid);
  const propDocs    = documents.filter((d) => d.propertyId === pid);

  const totalRepairCost = propRepairs.reduce(
    (acc, r) => acc + parseFloat(r.cost.replace(/,/g, "") || "0"), 0
  );

  function scoreColor(v: number) {
    if (v >= 90) return colors.scoreExcellent;
    if (v >= 80) return colors.scoreGood;
    if (v >= 65) return colors.scoreFair;
    return colors.scorePoor;
  }

  async function generatePDF() {
    if (!selectedProperty) return;

    setGeneratingPDF(true);
    try {
      const result = await generateHomeHistoryPDF({
        property: selectedProperty,
        score,
        maintenanceItems: propMaint,
        repairs: propRepairs,
        appliances: propApps,
        documents: propDocs,
        contractors,
        ownerName: user?.name ?? "HomeWise User",
      });
      if ("error" in result) {
        Alert.alert("Error", result.error);
        return;
      }
      const safeName = selectedProperty.address.replace(/[^a-zA-Z0-9]/g, "_");
      await sharePDF(result.uri, `HomeWise_Report_${safeName}`);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not generate PDF.");
    } finally {
      setGeneratingPDF(false);
    }
  }

  function handleGeneratePDF() {
    requireFeature("pdf_reports", () => {
      generatePDF();
    });
  }

  return (
    <Screen noPad tabScreen>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={styles.screenTitle}>Reports</Text>
        <Text style={styles.screenSubtitle}>{selectedProperty.address}</Text>
        <View style={[styles.tabBar, { marginTop: 12, marginBottom: 0 }]}>
          <Pressable style={tab === "score" ? styles.tabItemActive : styles.tabItem} onPress={() => setTab("score")}>
            <Text style={tab === "score" ? styles.tabItemTextActive : styles.tabItemText}>Health Score</Text>
          </Pressable>
          <Pressable style={tab === "report" ? styles.tabItemActive : styles.tabItem} onPress={() => setTab("report")}>
            <Text style={tab === "report" ? styles.tabItemTextActive : styles.tabItemText}>History Report</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loadError ? <ErrorCard message={loadError} onRetry={refreshData} /> : null}
        <View style={{ height: 12 }} />

        {/* ── Health Score Tab ─────────────────────────────────── */}
        {tab === "score" && (
          <>
            <Card elevated>
              <ScoreGauge score={score.overall} />
              <Text style={{ color: colors.textMuted, textAlign: "center", fontSize: 13, marginBottom: 10 }}>
                Based on maintenance compliance, appliance condition, repair history, warranty coverage, and inspections.
              </Text>
              {score.overall >= 85 && (
                <View style={{ backgroundColor: colors.successBg, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name="shield-checkmark" size={24} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.success, fontWeight: "800", fontSize: 14 }}>HomeWise Certified™</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Score 85+ — your home qualifies for the certified badge.</Text>
                  </View>
                </View>
              )}
            </Card>

            <Card>
              <Text style={styles.sectionHeader}>Score Breakdown</Text>
              <ScoreBar score={score.maintenance} label="Maintenance Compliance" />
              <ScoreBar score={score.appliances}  label="Appliance Condition" />
              <ScoreBar score={score.repairs}     label="Repair History" />
              <ScoreBar score={score.warranty}    label="Warranty Coverage" />
              <ScoreBar score={score.inspections} label="Inspection Records" />
            </Card>

            <Card>
              <Text style={styles.sectionHeader}>How to Improve Your Score</Text>
              {propMaint.filter((m) => m.status === "Overdue").length > 0 && (
                <View style={[styles.rowStart, { marginBottom: 14 }]}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.dangerBg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 14 }}>Complete overdue maintenance</Text>
                    <Text style={styles.muted}>{propMaint.filter(m => m.status === "Overdue").length} task(s) overdue.</Text>
                  </View>
                </View>
              )}
              {propApps.filter((a) => a.condition === "Poor" || a.condition === "Replace Soon").length > 0 && (
                <View style={[styles.rowStart, { marginBottom: 14 }]}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.warningBg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="warning" size={18} color={colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 14 }}>Replace failing appliances</Text>
                    <Text style={styles.muted}>{propApps.filter(a => a.condition === "Poor" || a.condition === "Replace Soon").length} appliance(s) in poor condition.</Text>
                  </View>
                </View>
              )}
              {propDocs.filter(d => d.category === "inspection").length === 0 && (
                <View style={[styles.rowStart, { marginBottom: 14 }]}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.infoBg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="clipboard" size={18} color={colors.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 14 }}>Upload an inspection report</Text>
                    <Text style={styles.muted}>Annual inspections boost your score and buyer confidence.</Text>
                  </View>
                </View>
              )}
              {propDocs.filter(d => d.category === "warranty").length === 0 && (
                <View style={styles.rowStart}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSection, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 14 }}>Add warranty documents</Text>
                    <Text style={styles.muted}>Storing warranties in the Vault improves your score.</Text>
                  </View>
                </View>
              )}
              {propMaint.filter((m) => m.status === "Overdue").length === 0 &&
               propApps.filter((a) => a.condition === "Poor" || a.condition === "Replace Soon").length === 0 &&
               propDocs.filter(d => d.category === "inspection").length > 0 &&
               propDocs.filter(d => d.category === "warranty").length > 0 && (
                <View style={[styles.rowStart]}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                  <Text style={{ color: colors.success, fontWeight: "700", fontSize: 14, flex: 1 }}>Your home is in great shape!</Text>
                </View>
              )}
            </Card>

            {/* Stats */}
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              {[
                { label: "Maintenance Tasks", value: propMaint.length.toString(), icon: "construct-outline", color: colors.primary },
                { label: "Repairs Logged",    value: propRepairs.length.toString(), icon: "hammer-outline",   color: colors.success },
                { label: "Appliances",        value: propApps.length.toString(),    icon: "hardware-chip-outline", color: colors.warning },
                { label: "Documents",         value: propDocs.length.toString(),    icon: "folder-outline",   color: colors.info },
              ].map((s) => (
                <View key={s.label} style={[styles.statCard, { width: "48%" }]}>
                  <Ionicons name={s.icon as any} size={20} color={s.color} />
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── History Report Tab ──────────────────────────────── */}
        {tab === "report" && (
          <>
            <Card elevated>
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <Ionicons name="document-text" size={48} color={colors.primary} />
                <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "900", marginTop: 10 }}>Home History Report™</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 20 }}>
                  A professional PDF record of your home's complete history — ready to share with buyers, realtors, and insurers.
                </Text>
              </View>
            </Card>

            <Card>
              <Text style={styles.sectionHeader}>Report Contents</Text>
              {[
                { label: "Property Summary",                                        done: true },
                { label: "Home Health Score™",                                      done: true },
                { label: `Maintenance History (${propMaint.length} items)`,         done: propMaint.length > 0 },
                { label: `Repairs & Upgrades (${propRepairs.length} items)`,        done: propRepairs.length > 0 },
                { label: `Appliance Inventory (${propApps.length} appliances)`,     done: propApps.length > 0 },
                { label: `Documents & Warranties (${propDocs.length} files)`,       done: propDocs.length > 0 },
                { label: `Contractors Used (${contractors.length})`,                done: contractors.length > 0 },
                { label: "HomeWise Certified Badge",                                done: score.overall >= 85 },
              ].map((item) => (
                <View key={item.label} style={[styles.rowBetween, { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={{ color: item.done ? colors.textPrimary : colors.textMuted, fontSize: 14 }}>{item.label}</Text>
                  <Ionicons name={item.done ? "checkmark-circle" : "ellipse-outline"} size={20} color={item.done ? colors.success : colors.textMuted} />
                </View>
              ))}
            </Card>

            <Card>
              <Text style={styles.sectionHeader}>Report Summary</Text>
              {[
                { label: "Total Repairs Documented", value: propRepairs.length.toString() },
                { label: "Total Repair Investment",  value: `$${totalRepairCost.toLocaleString()}` },
                { label: "Maintenance Items",        value: propMaint.length.toString() },
                { label: "Documents Stored",         value: propDocs.length.toString() },
                { label: "Home Health Score",        value: `${score.overall}/100` },
              ].map((row, i) => (
                <View key={row.label}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.bodyText}>{row.label}</Text>
                    <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 15 }}>{row.value}</Text>
                  </View>
                  {i < 4 && <View style={styles.divider} />}
                </View>
              ))}
            </Card>

            {/* Generate PDF */}
            <Pressable
              style={[styles.primaryButton, generatingPDF && { opacity: 0.7 }]}
              onPress={handleGeneratePDF}
              disabled={generatingPDF}
            >
              {generatingPDF ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.primaryButtonText}>Generating PDF...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>Generate & Share PDF Report</Text>
                </>
              )}
            </Pressable>

            {/* Buyer share link */}
            <Card>
              <View style={styles.rowStart}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="link" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Buyer Share Link™</Text>
                  <Text style={styles.muted}>Generate a secure link for buyers and realtors — they see history without your personal info.</Text>
                </View>
              </View>
              <Pressable
                style={[styles.secondaryButton, { marginTop: 14 }]}
                onPress={() =>
                  requireFeature("buyer_share_links", () =>
                    router.push("/features/buyer-reports")
                  )
                }
              >
                <Ionicons name="link-outline" size={16} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Open Home Buyer Reports</Text>
              </Pressable>
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
