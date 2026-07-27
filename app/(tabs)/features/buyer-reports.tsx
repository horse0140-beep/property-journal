import { useCallback, useState } from "react";
import {
  ScrollView, Text, View, Pressable, Alert, ActivityIndicator, Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { ScoreBar } from "@/components/ScoreRing";
import { PremiumGate } from "@/components/PremiumGate";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useHomeWise } from "@/context/HomeWiseContext";
import { generateHomeHistoryPDF, sharePDF } from "@/lib/pdfGenerator";
import { parseCostNumber } from "@/lib/dbSanitize";
import {
  buildShareMessage,
  createPropertyShare,
  fetchPropertyShares,
  isShareConfigured,
  SHARE_NOT_CONFIGURED_MESSAGE,
} from "@/services/sharingService";
import { buildPropertyShareSnapshot } from "@/lib/shareSnapshot";
import { applySharePreset } from "@/lib/sharePermissions";
import type { PropertyShare } from "@/types/premium";

export default function BuyerReportsScreen() {
  const { user } = useAuth();
  const {
    selectedProperty,
    maintenanceItems,
    repairs,
    appliances,
    documents,
    photos,
    contractors,
    getPropertyScore,
  } = useHomeWise();

  const [buyerShares, setBuyerShares] = useState<PropertyShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const all = await fetchPropertyShares(user.id);
      setBuyerShares(all.filter((s) => s.label.toLowerCase().includes("buyer") || !s.include_personal_info));
    } catch {
      setBuyerShares([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!selectedProperty) {
    return (
      <Screen>
        <PremiumGate feature="buyer_share_links" featureName="Home Buyer Reports" description="">
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No property selected</Text>
          </View>
        </PremiumGate>
      </Screen>
    );
  }

  const property = selectedProperty;
  const pid = property.id;
  const score = getPropertyScore(pid);
  const propMaint = maintenanceItems.filter((m) => m.propertyId === pid);
  const propRepairs = repairs.filter((r) => r.propertyId === pid);
  const propApps = appliances.filter((a) => a.propertyId === pid);
  const propDocs = documents.filter((d) => d.propertyId === pid);
  const totalInvested = propRepairs.reduce((s, r) => s + parseCostNumber(r.cost), 0);

  async function handleGeneratePDF() {
    setGeneratingPDF(true);
    try {
      const result = await generateHomeHistoryPDF({
        property,
        score,
        maintenanceItems: propMaint,
        repairs: propRepairs,
        appliances: propApps,
        documents: propDocs,
        contractors,
        ownerName: user?.name ?? "Property Journal User",
      });
      if ("error" in result) {
        Alert.alert("Error", result.error);
        return;
      }
      const safeName = property.address.replace(/[^a-zA-Z0-9]/g, "_");
      await sharePDF(result.uri, `PropertyJournal_BuyerReport_${safeName}`);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGeneratingPDF(false);
    }
  }

  async function handleCreateBuyerLink() {
    if (!user?.id) return;
    if (!isShareConfigured()) {
      Alert.alert("Sharing unavailable", SHARE_NOT_CONFIGURED_MESSAGE);
      return;
    }
    setCreatingLink(true);
    try {
      const share = await createPropertyShare(user.id, {
        property_id: pid,
        property_label: property.nickname || property.address,
        label: `Buyer Report — ${property.address}`,
        include_personal_info: false,
        expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
        snapshot_json: (() => {
          const permissions = applySharePreset("buyer", {
            maintenance: maintenanceItems.filter((m) => m.propertyId === pid).map((m) => m.id),
            repairs: repairs.filter((r) => r.propertyId === pid).map((r) => r.id),
            appliances: appliances.filter((a) => a.propertyId === pid).map((a) => a.id),
            documents: documents.filter((d) => d.propertyId === pid).map((d) => d.id),
            photos: photos
              .filter((p) => p.propertyId === pid && Boolean(p.uri?.trim()))
              .map((p) => p.id),
          });
          permissions.sections.ownerMessage = true;
          return buildPropertyShareSnapshot({
            property,
            maintenanceItems,
            repairs,
            appliances,
            documents,
            photos,
            permissions,
            ownerMessage: "Buyer preview — read-only property history from Property Journal.",
          }) as unknown as Record<string, unknown>;
        })(),
      });

      const message = buildShareMessage(
        share.share_token,
        `Property Journal Buyer Report for ${property.address}\n\nView the complete home history (no personal info):`
      );
      if (!message) {
        Alert.alert("Sharing unavailable", SHARE_NOT_CONFIGURED_MESSAGE);
        return;
      }
      await Share.share({ message, title: "Property Journal Buyer Report" });
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreatingLink(false);
    }
  }

  return (
    <Screen noPad>
      <PremiumGate
        feature="buyer_share_links"
        featureName="Home Buyer Reports"
        description="Generate professional CarFax-style reports and secure buyer links that build trust during a sale."
      >
        <AdminHeader title="Home Buyer Reports" subtitle={property.address} backTo="/features" />

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Card elevated>
            <View style={{ alignItems: "center", paddingVertical: 8 }}>
              <Ionicons name="document-text" size={44} color={colors.primary} />
              <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "900", marginTop: 10 }}>
                Home History Report™
              </Text>
              <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 6, lineHeight: 20 }}>
                The CarFax for your house — share verified maintenance, repairs, and health score with buyers.
              </Text>
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionHeader}>Buyer Report Preview</Text>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: colors.primary, fontSize: 42, fontWeight: "900" }}>{score.overall}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Home Health Score™</Text>
            </View>
            <ScoreBar score={score.maintenance} label="Maintenance" />
            <ScoreBar score={score.appliances} label="Appliances" />
            <ScoreBar score={score.repairs} label="Repairs" />
            <View style={styles.divider} />
            {[
              { label: "Maintenance Records", value: propMaint.length },
              { label: "Repairs Documented", value: propRepairs.length },
              { label: "Total Investment", value: `$${totalInvested.toLocaleString()}` },
              { label: "Appliances Tracked", value: propApps.length },
              { label: "Documents Stored", value: propDocs.length },
            ].map((row) => (
              <View key={row.label} style={[styles.rowBetween, { paddingVertical: 8 }]}>
                <Text style={styles.bodyText}>{row.label}</Text>
                <Text style={{ color: colors.primary, fontWeight: "800" }}>{row.value}</Text>
              </View>
            ))}
            {score.overall >= 85 && (
              <View style={{ backgroundColor: colors.successBg, borderRadius: 12, padding: 12, marginTop: 10, flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Ionicons name="shield-checkmark" size={22} color={colors.success} />
                <Text style={{ color: colors.success, fontWeight: "800", flex: 1 }}>Property Journal Certified™ — qualifies for buyer badge</Text>
              </View>
            )}
          </Card>

          <Pressable
            style={[styles.primaryButton, generatingPDF && { opacity: 0.7 }]}
            onPress={handleGeneratePDF}
            disabled={generatingPDF}
          >
            {generatingPDF ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="document-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Generate & Share PDF Report</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, creatingLink && { opacity: 0.7 }]}
            onPress={handleCreateBuyerLink}
            disabled={creatingLink}
          >
            {creatingLink ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="link-outline" size={18} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Create Buyer Share Link™</Text>
              </>
            )}
          </Pressable>

          {!loading && buyerShares.length > 0 && (
            <Card style={{ marginTop: 16 }}>
              <Text style={styles.sectionHeader}>Active Buyer Links</Text>
              {buyerShares.map((share) => (
                <View key={share.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={styles.cardTitle}>{share.label}</Text>
                  <Text style={styles.muted}>{share.share_token}</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                    <AdminBadge label={`${share.views_count} views`} variant="muted" />
                    {share.expires_at && (
                      <AdminBadge label={`Expires ${new Date(share.expires_at).toLocaleDateString()}`} variant="info" />
                    )}
                  </View>
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      </PremiumGate>
    </Screen>
  );
}
