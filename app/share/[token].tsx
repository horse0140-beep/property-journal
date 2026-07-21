import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { colors, styles } from "@/constants/theme";
import { fetchPropertyShareByToken } from "@/services/sharingService";
import type { PropertyShare } from "@/types/premium";

type Snapshot = {
  address?: string;
  city?: string;
  state?: string;
  score?: { overall?: number; label?: string };
  maintenanceCount?: number;
  repairCount?: number;
  applianceCount?: number;
};

export default function SharedPropertyScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token: string | string[] }>();
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const { width } = useWindowDimensions();
  const [share, setShare] = useState<PropertyShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const contentWidth = Math.min(width, 480);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.title = "Property Journal · Shared Property";
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPropertyShareByToken(token)
      .then((result) => {
        if (cancelled) return;
        if (!result) setInvalid(true);
        else setShare(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 320 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textMuted, marginTop: 12 }}>Loading shared property…</Text>
        </View>
      </Screen>
    );
  }

  if (invalid || !share) {
    return (
      <Screen>
        <View
          style={[
            styles.emptyState,
            {
              alignSelf: "center",
              width: contentWidth,
              maxWidth: "100%",
              paddingHorizontal: 20,
              minHeight: 320,
            },
          ]}
        >
          <Ionicons name="link-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyStateTitle}>Share not found or expired</Text>
          <Text style={styles.emptyStateText}>
            This link may have been revoked, expired, or entered incorrectly. Ask the property owner
            for a new link.
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 24, textAlign: "center" }}>
            Property Journal
          </Text>
        </View>
      </Screen>
    );
  }

  const snapshot = (share.snapshot_json ?? {}) as Snapshot;
  const score = snapshot.score;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40,
          alignItems: "center",
          flexGrow: 1,
        }}
      >
        <View style={{ width: contentWidth, maxWidth: "100%" }}>
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <Ionicons name="home" size={40} color={colors.primary} />
            <Text
              style={{
                fontSize: 22,
                fontWeight: "900",
                color: colors.textPrimary,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              {share.property_label}
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 4, textAlign: "center" }}>
              {share.label}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>
              Read-only · Created {new Date(share.created_at).toLocaleDateString()}
            </Text>
          </View>

          <Card>
            <Text style={styles.cardTitle}>Property Overview</Text>
            {snapshot.address ? (
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                {[snapshot.address, snapshot.city, snapshot.state].filter(Boolean).join(", ")}
              </Text>
            ) : null}
            {score ? (
              <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    borderWidth: 4,
                    borderColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 22, fontWeight: "900", color: colors.primary }}>
                    {score.overall ?? "—"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", color: colors.textPrimary }}>
                    Home Health Score
                  </Text>
                  <Text style={{ color: colors.textMuted }}>{score.label ?? "—"}</Text>
                </View>
              </View>
            ) : null}
          </Card>

          <Card style={{ marginTop: 12 }}>
            <Text style={styles.cardTitle}>Summary</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
              <Stat label="Maintenance Items" value={snapshot.maintenanceCount ?? 0} />
              <Stat label="Repairs" value={snapshot.repairCount ?? 0} />
              <Stat label="Appliances" value={snapshot.applianceCount ?? 0} />
            </View>
          </Card>

          <Text
            style={{
              color: colors.textMuted,
              fontSize: 12,
              textAlign: "center",
              marginTop: 24,
            }}
          >
            Shared via Property Journal · This is a read-only preview
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: "28%",
        backgroundColor: colors.bgSection,
        borderRadius: 10,
        padding: 12,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "900", color: colors.primary }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: 4 }}>
        {label}
      </Text>
    </View>
  );
}
