import {
  ScrollView,
  Text,
  View,
  Pressable,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { ScoreBar } from "@/components/ScoreRing";
import { LoadingView } from "@/components/LoadingView";
import { ErrorCard } from "@/components/ErrorCard";
import { EmptyState } from "@/components/EmptyState";
import { ReportPreviewCard } from "@/components/ReportPreviewCard";
import { ScoreInsightPanel } from "@/components/ScoreInsightPanel";
import { colors, styles } from "@/constants/theme";
import { buildAllScoreCategoryInsights, computeOverallFromCategories, type ScoreCategoryKey } from "@/lib/scoreCategories";
import { recordScoreSnapshot, checkScoreCelebration, getScoreHistory, type ScoreCelebration, type ScoreSnapshot } from "@/lib/scoreHistory";
import { flattenPrioritizedRecommendations, computeCompletionPercent } from "@/lib/scoreMeta";
import { recordScoreActivity, getEngagementStats, type EngagementStats } from "@/lib/scoreEngagement";
import { buildMonthlyReportData } from "@/lib/scoreMonthlyReport";
import { getLastCheckupYear, shouldPromptAnnualCheckup } from "@/lib/scoreAnnualCheckup";
import { ScoreCelebrationBanner } from "@/components/ScoreCelebrationBanner";
import { ScoreHistoryPanel } from "@/components/ScoreHistoryPanel";
import { ScoreCompletionHeader } from "@/components/ScoreCompletionHeader";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ScoreStreaksPanel } from "@/components/ScoreStreaksPanel";
import { ScoreMilestonesPanel } from "@/components/ScoreMilestonesPanel";
import { ScoreSeasonalPanel } from "@/components/ScoreSeasonalPanel";
import { MonthlyHealthReportPanel } from "@/components/MonthlyHealthReportPanel";
import { useTabScrollContentStyle } from "@/constants/layout";
import { TabScreenHeader } from "@/components/TabScreenHeader";
import { useHomeWise } from "@/context/HomeWiseContext";
import { useAuth } from "@/context/AuthContext";
import { useUpgrade } from "@/context/UpgradeContext";
import { isOwnerAdminEmail } from "@/lib/admin";
import { parseCostNumber } from "@/lib/dbSanitize";
import {
  assembleReportData,
  buildHomeHistoryReportHtml,
  fetchPropertyReportData,
  fetchSavedReports,
  generateReportPdf,
  previewReportPdf,
  saveReport,
  shareReportPdf,
  type HomeHistoryReportData,
  type SavedReport,
} from "@/services/reportService";

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
      <View
        style={{
          width: 160,
          height: 160,
          borderRadius: 80,
          borderWidth: 12,
          borderColor: c,
          backgroundColor: `${c}14`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
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
    properties,
    maintenanceItems,
    repairs,
    appliances,
    documents,
    photos,
    contractors,
    paintColors,
    getPropertyScore,
    isLoading,
    loadError,
    refreshData,
  } = useHomeWise();
  const { user, isAdmin, isOwner } = useAuth();
  const { canAccess, requireFeature } = useUpgrade();
  const tabScrollStyle = useTabScrollContentStyle();

  const [tab, setTab] = useState<Tab>("score");
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportData, setReportData] = useState<HomeHistoryReportData | null>(null);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<SavedReport | null>(null);
  const [expandedInsight, setExpandedInsight] = useState<ScoreCategoryKey | null>(null);
  const [celebration, setCelebration] = useState<ScoreCelebration | null>(null);
  const [engagement, setEngagement] = useState<EngagementStats | null>(null);
  const [monthlyHistory, setMonthlyHistory] = useState<ScoreSnapshot[]>([]);
  const [showCheckupPrompt, setShowCheckupPrompt] = useState(false);

  const hasReportAccess =
    isOwner ||
    isOwnerAdminEmail(user?.email) ||
    canAccess("pdf_reports");

  const loadSaved = useCallback(async () => {
    if (!user?.id || !selectedProperty?.id) return;
    try {
      const saved = await fetchSavedReports(user.id, selectedProperty.id);
      setLastSaved(saved[0] ?? null);
    } catch {
      setLastSaved(null);
    }
  }, [user?.id, selectedProperty?.id]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const pid = selectedProperty?.id ?? "";

  const scoreInsights = useMemo(() => {
    if (!selectedProperty) return [];
    const p = selectedProperty;
    return buildAllScoreCategoryInsights({
      property: p,
      maintenance: maintenanceItems.filter((m) => m.propertyId === p.id),
      repairs: repairs.filter((r) => r.propertyId === p.id),
      appliances: appliances.filter((a) => a.propertyId === p.id),
      documents: documents.filter((d) => d.propertyId === p.id),
      contractors: contractors.filter((c) => !c.propertyId || c.propertyId === p.id),
      paintColors: paintColors.filter((x) => x.propertyId === p.id),
      photos: photos.filter((x) => x.propertyId === p.id),
    });
  }, [selectedProperty, maintenanceItems, repairs, appliances, documents, contractors, paintColors, photos]);

  const displayScore = useMemo(() => {
    if (!selectedProperty || scoreInsights.length === 0) return 0;
    const base = getPropertyScore(selectedProperty.id).overall;
    const enhanced = computeOverallFromCategories(scoreInsights);
    return Math.round((base + enhanced) / 2);
  }, [selectedProperty, scoreInsights, getPropertyScore]);

  const completionPercent = useMemo(() => computeCompletionPercent(displayScore), [displayScore]);

  const prioritizedRecs = useMemo(
    () => flattenPrioritizedRecommendations(scoreInsights),
    [scoreInsights]
  );

  const monthlyReportData = useMemo(() => {
    if (!selectedProperty) return null;
    const pid = selectedProperty.id;
    return buildMonthlyReportData({
      propertyAddress: selectedProperty.address,
      overallScore: displayScore,
      completionPercent,
      maintenance: maintenanceItems.filter((m) => m.propertyId === pid),
      documents: documents.filter((d) => d.propertyId === pid),
      recommendations: prioritizedRecs,
      history: monthlyHistory,
    });
  }, [
    selectedProperty,
    displayScore,
    completionPercent,
    maintenanceItems,
    documents,
    prioritizedRecs,
    monthlyHistory,
  ]);

  useEffect(() => {
    if (!pid || displayScore === 0) return;
    const categories = Object.fromEntries(scoreInsights.map((i) => [i.key, i.score]));
    recordScoreSnapshot(pid, displayScore, categories).catch(() => {});
    checkScoreCelebration(pid, displayScore).then(setCelebration).catch(() => {});
    recordScoreActivity(pid).catch(() => {});
    getEngagementStats({
      propertyId: pid,
      properties,
      maintenance: maintenanceItems.filter((m) => m.propertyId === pid),
      documents: documents.filter((d) => d.propertyId === pid),
      appliances: appliances.filter((a) => a.propertyId === pid),
      overallScore: displayScore,
    })
      .then(setEngagement)
      .catch(() => {});
    getScoreHistory(pid, "30d").then(setMonthlyHistory).catch(() => {});
    getLastCheckupYear(pid)
      .then((y) => setShowCheckupPrompt(shouldPromptAnnualCheckup(y)))
      .catch(() => {});
  }, [pid, displayScore, scoreInsights, properties, maintenanceItems, documents, appliances]);

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

  const property = selectedProperty;
  const score = getPropertyScore(pid);
  const propMaint = maintenanceItems.filter((m) => m.propertyId === pid);
  const propRepairs = repairs.filter((r) => r.propertyId === pid);
  const propApps = appliances.filter((a) => a.propertyId === pid);
  const propDocs = documents.filter((d) => d.propertyId === pid);
  const propPhotos = photos.filter((p) => p.propertyId === pid);
  const propPaint = paintColors.filter((p) => p.propertyId === pid);
  const propReceipts = propDocs.filter((d) => d.category === "receipt");
  const propWarranties = propDocs.filter((d) => d.category === "warranty");
  const generalDocs = propDocs.filter(
    (d) => d.category !== "receipt" && d.category !== "warranty"
  );

  const totalRepairCost = propRepairs.reduce((acc, r) => acc + parseCostNumber(r.cost), 0);

  function openCategoryDetail(key: ScoreCategoryKey) {
    router.push({ pathname: "/score/[category]", params: { category: key } });
  }

  function toggleInsight(key: ScoreCategoryKey) {
    setExpandedInsight((prev) => (prev === key ? null : key));
  }

  async function loadReportData(): Promise<HomeHistoryReportData | null> {
    if (!user?.id) return null;

    try {
      const fromDb = await fetchPropertyReportData(
        user.id,
        pid,
        user.name ?? "Property Journal User"
      );
      if (fromDb) {
        setReportData(fromDb);
        return fromDb;
      }
    } catch {
      // fall through to context assembly
    }

    const assembled = assembleReportData({
      property,
      score,
      maintenanceItems: propMaint,
      repairs: propRepairs,
      appliances: propApps,
      documents: propDocs,
      photos: propPhotos,
      contractors,
      ownerName: user?.name ?? "Property Journal User",
    });
    setReportData(assembled);
    return assembled;
  }

  async function ensurePdf(): Promise<{ uri: string; html: string } | null> {
    if (pdfUri && reportHtml) return { uri: pdfUri, html: reportHtml };

    const data = reportData ?? (await loadReportData());
    if (!data) {
      Alert.alert("Error", "Could not load report data.");
      return null;
    }

    const result = await generateReportPdf(data);
    if ("error" in result) {
      Alert.alert("Error", result.error);
      return null;
    }

    setPdfUri(result.uri);
    setReportHtml(result.html);
    return result;
  }

  function runWithAccess(action: () => void) {
    requireFeature("pdf_reports", action);
  }

  async function handleGenerate() {
    runWithAccess(async () => {
      setGenerating(true);
      try {
        const data = await loadReportData();
        if (!data) return;

        const result = await generateReportPdf(data);
        if ("error" in result) {
          Alert.alert("Error", result.error);
          return;
        }

        setPdfUri(result.uri);
        setReportHtml(result.html);
        Alert.alert("Report Ready", "Your Home History Report PDF has been generated.");
      } finally {
        setGenerating(false);
      }
    });
  }

  async function handlePreview() {
    runWithAccess(async () => {
      setPreviewing(true);
      try {
        let html = reportHtml;
        if (!html) {
          const data = reportData ?? (await loadReportData());
          if (!data) return;
          html = buildHomeHistoryReportHtml(data);
          setReportHtml(html);
        }

        const result = await previewReportPdf(html);
        if (result.error) Alert.alert("Preview Failed", result.error);
      } finally {
        setPreviewing(false);
      }
    });
  }

  async function handleShare() {
    runWithAccess(async () => {
      setSharing(true);
      try {
        const pdf = await ensurePdf();
        if (!pdf) return;

        const safeName = property.address.replace(/[^a-zA-Z0-9]/g, "_");
        const result = await shareReportPdf(pdf.uri, `PropertyJournal_Report_${safeName}`);
        if (result.error) Alert.alert("Share Failed", result.error);
      } finally {
        setSharing(false);
      }
    });
  }

  async function handleSave() {
    runWithAccess(async () => {
      if (!user?.id) return;
      setSaving(true);
      try {
        const pdf = await ensurePdf();
        if (!pdf) return;

        const data = reportData ?? (await loadReportData());
        if (!data) return;

        const result = await saveReport(user.id, data, pdf.uri);
        if (result.error) {
          Alert.alert("Save Warning", result.error);
        } else if (result.saved) {
          setLastSaved(result.saved);
          Alert.alert("Saved", "Report saved to your Property Journal account.");
        } else {
          Alert.alert("Saved Locally", "PDF generated. Run migration 009_reports.sql to enable cloud metadata.");
        }
        await loadSaved();
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <Screen noPad tabScreen>
      <TabScreenHeader>
        <Text style={styles.tabHeaderTitle}>Reports</Text>
        <Text style={styles.tabHeaderSubtitle} numberOfLines={2}>
          {property.address}
        </Text>
        <View style={[styles.tabBar, { marginTop: 12, marginBottom: 0 }]}>
          <Pressable
            style={tab === "score" ? styles.tabItemActive : styles.tabItem}
            onPress={() => setTab("score")}
          >
            <Text style={tab === "score" ? styles.tabItemTextActive : styles.tabItemText}>
              Health Score
            </Text>
          </Pressable>
          <Pressable
            style={tab === "report" ? styles.tabItemActive : styles.tabItem}
            onPress={() => setTab("report")}
          >
            <Text style={tab === "report" ? styles.tabItemTextActive : styles.tabItemText}>
              History Report
            </Text>
          </Pressable>
        </View>
      </TabScreenHeader>

      <ScrollView contentContainerStyle={tabScrollStyle}>
        {loadError ? <ErrorCard message={loadError} onRetry={refreshData} /> : null}
        <View style={{ height: 12 }} />

        {(isOwner || isOwnerAdminEmail(user?.email)) && tab === "report" && (
          <Card
            style={{
              backgroundColor: colors.gold,
              borderColor: colors.gold,
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Ionicons name="shield-checkmark" size={24} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontWeight: "900" }}>OWNER ACCESS</Text>
                <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 2 }}>
                  ALL FEATURES UNLOCKED
                </Text>
              </View>
            </View>
          </Card>
        )}

        {tab === "score" && (
          <>
            {celebration ? (
              <ScoreCelebrationBanner
                propertyId={pid}
                celebration={celebration}
                onDismiss={() => setCelebration(null)}
              />
            ) : null}

            <Card elevated>
              <ScoreCompletionHeader score={displayScore} />
              <ScoreGauge score={displayScore} />
              <Pressable
                onPress={() => router.push("/score/explain")}
                style={{ alignItems: "center", marginBottom: 10 }}
                accessibilityRole="link"
              >
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                  How is this score calculated?
                </Text>
              </Pressable>
              <Text
                style={{
                  color: colors.textMuted,
                  textAlign: "center",
                  fontSize: 13,
                  marginBottom: 10,
                }}
              >
                Based on 12 home health categories including roof, HVAC, plumbing,
                safety, maintenance, warranties, and documents.
              </Text>
              {displayScore >= 85 && (
                <View
                  style={{
                    backgroundColor: colors.successBg,
                    borderRadius: 12,
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Ionicons name="shield-checkmark" size={24} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.success, fontWeight: "800", fontSize: 14 }}>
                      Property Journal Certified™
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Score 85+ — your home qualifies for the certified badge.
                    </Text>
                  </View>
                </View>
              )}
            </Card>

            {showCheckupPrompt ? (
              <Card>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <Ionicons name="calendar-outline" size={28} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", color: colors.textPrimary, fontSize: 15 }}>
                      Annual Home Checkup
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                      Review appliances, warranties, insurance, and emergency info for the year.
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={[styles.primaryButton, { marginTop: 12 }]}
                  onPress={() =>
                    router.push({
                      pathname: "/score/checkup",
                      params: { propertyId: pid },
                    })
                  }
                >
                  <Text style={styles.primaryButtonText}>Start Annual Checkup</Text>
                </Pressable>
              </Card>
            ) : null}

            {prioritizedRecs.length > 0 ? (
              <Card>
                <Text style={styles.sectionHeader}>Priority Recommendations</Text>
                <Text style={[styles.muted, { marginBottom: 12 }]}>
                  Sorted by impact — tap any action to fix it now.
                </Text>
                {prioritizedRecs.slice(0, 6).map((rec) => (
                  <RecommendationCard key={`${rec.categoryKey}-${rec.label}`} recommendation={rec} />
                ))}
              </Card>
            ) : null}

            <Card>
              <ScoreSeasonalPanel />
            </Card>

            {engagement ? (
              <Card>
                <ScoreStreaksPanel stats={engagement} />
                <ScoreMilestonesPanel milestones={engagement.milestones} />
              </Card>
            ) : null}

            {monthlyReportData ? (
              <Card>
                <MonthlyHealthReportPanel reportData={monthlyReportData} />
              </Card>
            ) : null}

            <Card>
              <Text style={styles.sectionHeader}>Score Breakdown</Text>
              <Text style={[styles.muted, { marginBottom: 12 }]}>
                Tap any category for details and recommended actions.
              </Text>
              {scoreInsights.map((insight) => (
                <ScoreBar
                  key={insight.key}
                  score={insight.score}
                  label={insight.label}
                  onPress={() => openCategoryDetail(insight.key)}
                />
              ))}
            </Card>

            <Card>
              <ScoreHistoryPanel propertyId={pid} currentOverall={displayScore} />
            </Card>

            <Card>
              <Text style={styles.sectionHeader}>How to Improve Your Score</Text>
              {scoreInsights.map((insight) => (
                <ScoreInsightPanel
                  key={insight.key}
                  insight={insight}
                  expanded={expandedInsight === insight.key}
                  onToggle={() => toggleInsight(insight.key)}
                />
              ))}
            </Card>

            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              {[
                {
                  label: "Maintenance Tasks",
                  value: propMaint.length.toString(),
                  icon: "construct-outline",
                  color: colors.primary,
                },
                {
                  label: "Repairs Logged",
                  value: propRepairs.length.toString(),
                  icon: "hammer-outline",
                  color: colors.success,
                },
                {
                  label: "Appliances",
                  value: propApps.length.toString(),
                  icon: "hardware-chip-outline",
                  color: colors.warning,
                },
                {
                  label: "Documents",
                  value: propDocs.length.toString(),
                  icon: "folder-outline",
                  color: colors.info,
                },
              ].map((s) => (
                <View key={s.label} style={[styles.statCard, { width: "48%" }]}>
                  <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={20} color={s.color} />
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {tab === "report" && (
          <>
            <ReportPreviewCard
              propertyAddress={property.address}
              ownerName={user?.name ?? "Property Journal User"}
              score={score}
              maintenanceCount={propMaint.length}
              repairCount={propRepairs.length}
              applianceCount={propApps.length}
              warrantyCount={propWarranties.length}
              receiptCount={propReceipts.length}
              documentCount={generalDocs.length}
              photoCount={propPhotos.length}
              lastSaved={lastSaved}
              hasPdf={!!pdfUri}
              locked={!hasReportAccess}
              generating={generating}
              previewing={previewing}
              sharing={sharing}
              saving={saving}
              onGenerate={handleGenerate}
              onPreview={handlePreview}
              onShare={handleShare}
              onSave={handleSave}
              onUpgrade={() => router.push("/features/upgrade")}
            />

            <Card>
              <Text style={styles.sectionHeader}>Report Contents</Text>
              {[
                { label: "Property Profile", done: true },
                { label: "Home Health Score™", done: true },
                { label: `Maintenance History (${propMaint.length})`, done: propMaint.length > 0 },
                { label: `Repairs (${propRepairs.length})`, done: propRepairs.length > 0 },
                { label: `Appliances (${propApps.length})`, done: propApps.length > 0 },
                { label: `Warranties (${propWarranties.length})`, done: propWarranties.length > 0 },
                { label: `Receipts (${propReceipts.length})`, done: propReceipts.length > 0 },
                { label: `Documents (${generalDocs.length})`, done: generalDocs.length > 0 },
                { label: `Photos (${propPhotos.length})`, done: propPhotos.length > 0 },
                { label: "Legal Disclaimer", done: true },
              ].map((item) => (
                <View
                  key={item.label}
                  style={[
                    styles.rowBetween,
                    {
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: item.done ? colors.textPrimary : colors.textMuted,
                      fontSize: 14,
                    }}
                  >
                    {item.label}
                  </Text>
                  <Ionicons
                    name={item.done ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={item.done ? colors.success : colors.textMuted}
                  />
                </View>
              ))}
            </Card>

            <Card>
              <Text style={styles.sectionHeader}>Report Summary</Text>
              {[
                { label: "Total Repairs Documented", value: propRepairs.length.toString() },
                { label: "Total Repair Investment", value: `$${totalRepairCost.toLocaleString()}` },
                { label: "Maintenance Items", value: propMaint.length.toString() },
                { label: "Files on Record", value: propDocs.length.toString() },
                { label: "Home Health Score", value: `${score.overall}/100` },
              ].map((row, i, arr) => (
                <View key={row.label}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.bodyText}>{row.label}</Text>
                    <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 15 }}>
                      {row.value}
                    </Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </Card>

            <Card>
              <View style={styles.rowStart}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="link" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Buyer Share Link™</Text>
                  <Text style={styles.muted}>
                    Generate a secure link for buyers and realtors.
                  </Text>
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
