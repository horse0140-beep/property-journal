import { Component, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, styles } from "@/constants/theme";
import { fetchPropertyShareByToken } from "@/services/sharingService";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { PropertyShare } from "@/types/premium";

type Snapshot = {
  address?: string;
  city?: string;
  state?: string;
  score?: { overall?: number | string; label?: string };
  maintenanceCount?: number | string;
  repairCount?: number | string;
  applianceCount?: number | string;
};

type LoadErrorKind = "invalid" | "timeout" | "error";

const LOAD_TIMEOUT_MS = 12000;
const HOME_URL = "https://property-journal.vercel.app/";

function asSnapshot(raw: unknown): Snapshot {
  if (raw == null) return {};
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (typeof value !== "object" || Array.isArray(value)) return {};
  return value as Snapshot;
}

function asCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatCreatedAt(value: unknown): string {
  if (value == null || value === "") return "—";
  try {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  } catch {
    return "—";
  }
}

export default function SharedPropertyScreen() {
  return (
    <ShareErrorBoundary>
      <SharedPropertyScreenInner />
    </ShareErrorBoundary>
  );
}

class ShareErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || "Unknown render error",
    };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) {
      console.error("[share] render error", error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView
          style={{ flex: 1, backgroundColor: colors.bg }}
          edges={["top", "left", "right", "bottom"]}
        >
          <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
            <Text style={[styles.emptyStateTitle, { textAlign: "left" }]}>
              Something went wrong while displaying this property.
            </Text>
            <Pressable
              style={[styles.primaryButton, { marginTop: 20 }]}
              onPress={() => this.setState({ hasError: false, message: "" })}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

function SharedPropertyScreenInner() {
  const { token: tokenParam } = useLocalSearchParams<{ token: string | string[] }>();
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const { width, height } = useWindowDimensions();
  const contentWidth = Math.min(Math.max(width - 32, 280), 480);

  const [share, setShare] = useState<PropertyShare | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({});
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<LoadErrorKind | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useLayoutEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.classList.add("pj-share-route");
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.title = "Property Journal · Shared Property";
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function run() {
      try {
        const parsed = typeof token === "string" ? token.trim() : "";
        if (!parsed) {
          setErrorKind("invalid");
          setErrorDetail("Missing share token.");
          setLoading(false);
          return;
        }

        if (isSupabaseConfigured) {
          try {
            await supabase.auth.getSession();
          } catch {
            // Public share does not require a session.
          }
        }

        setLoading(true);
        setErrorKind(null);
        setErrorDetail(null);
        setShare(null);
        setSnapshot({});

        timer = setTimeout(() => {
          if (cancelled) return;
          timedOut = true;
          setLoading(false);
          setErrorKind("timeout");
          setErrorDetail("This property is taking too long to load.");
        }, LOAD_TIMEOUT_MS);

        const result = await fetchPropertyShareByToken(parsed);
        if (cancelled || timedOut) return;
        if (timer) clearTimeout(timer);

        if (!result) {
          setErrorKind("invalid");
          setErrorDetail(null);
          setLoading(false);
          return;
        }

        const snap = asSnapshot(result.snapshot_json);
        const normalized: PropertyShare = {
          ...result,
          property_label: String(result.property_label ?? "Shared property"),
          label: String(result.label ?? "Shared link"),
          snapshot_json: snap,
          created_at: result.created_at ?? new Date().toISOString(),
        };

        setShare(normalized);
        setSnapshot(snap);
        setLoading(false);
      } catch (e) {
        if (cancelled || timedOut) return;
        if (timer) clearTimeout(timer);
        setErrorKind("error");
        setErrorDetail(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, retryKey]);

  const score = snapshot.score;

  function goHome() {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.assign(HOME_URL);
      return;
    }
    void Linking.openURL(HOME_URL);
  }

  function Failure({ title, detail }: { title: string; detail?: string | null }) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bg }}
        edges={["top", "left", "right", "bottom"]}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 20,
            minHeight: Math.max(height * 0.7, 320),
          }}
        >
          <View style={{ alignSelf: "center", width: contentWidth, maxWidth: "100%" }}>
            <Ionicons name="link-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyStateTitle, { marginTop: 12, textAlign: "left" }]}>{title}</Text>
            {detail ? (
              <Text style={[styles.emptyStateText, { textAlign: "left", marginTop: 8 }]}>{detail}</Text>
            ) : null}
            <Pressable
              style={[styles.primaryButton, { marginTop: 20 }]}
              onPress={() => setRetryKey((k) => k + 1)}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, { marginTop: 10 }]} onPress={goHome}>
              <Text style={styles.secondaryButtonText}>Return to Property Journal</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bg }}
        edges={["top", "left", "right", "bottom"]}
      >
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 240 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textPrimary, marginTop: 12, fontWeight: "700" }}>
            Loading shared property…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorKind === "timeout") {
    return (
      <Failure
        title="This property is taking too long to load."
        detail="Check your connection and try again."
      />
    );
  }

  if (errorKind === "error") {
    return <Failure title="Unable to load this shared property." detail={errorDetail} />;
  }

  if (errorKind === "invalid" || !share) {
    return (
      <Failure
        title="This share link is invalid, expired, or no longer active."
        detail="Ask the property owner for a new link."
      />
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 48,
          alignItems: "center",
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
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
              {share.property_label || "Shared property"}
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 4, textAlign: "center" }}>
              Read-only Share
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>
              Created {formatCreatedAt(share.created_at)}
            </Text>
          </View>

          <View
            style={{
              backgroundColor: colors.bgCard,
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={styles.cardTitle}>Property Overview</Text>
            {snapshot.address ? (
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                {[snapshot.address, snapshot.city, snapshot.state].filter(Boolean).join(", ")}
              </Text>
            ) : (
              <Text style={{ color: colors.textMuted, marginTop: 8 }}>No address in this share.</Text>
            )}
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
          </View>

          <View
            style={{
              backgroundColor: colors.bgCard,
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              marginTop: 12,
            }}
          >
            <Text style={styles.cardTitle}>Summary</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
              <Stat label="Maintenance Items" value={asCount(snapshot.maintenanceCount)} />
              <Stat label="Repairs" value={asCount(snapshot.repairCount)} />
              <Stat label="Appliances" value={asCount(snapshot.applianceCount)} />
            </View>
          </View>

          <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 24 }}>
            Shared via Property Journal · This is a read-only preview
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
