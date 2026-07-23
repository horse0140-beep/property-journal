import { useEffect, useLayoutEffect, useMemo, useState } from "react";
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
import { shareAudit, shareAuditFailure } from "@/lib/shareAudit";
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

function publicShareLog(step: string, fields?: Record<string, unknown>) {
  console.info(`[PUBLIC SHARE ${step}]`, fields ?? {});
}

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

/**
 * Public read-only share page.
 * Avoids Screen/tab layout and authenticated context hooks.
 */
export default function SharedPropertyScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token: string | string[] }>();
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const { width, height } = useWindowDimensions();
  const contentWidth = Math.min(Math.max(width - 32, 280), 480);

  const [share, setShare] = useState<PropertyShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<LoadErrorKind | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const href =
    Platform.OS === "web" && typeof window !== "undefined" ? window.location.href : null;

  // Mobile web: Expo SPA sets body { overflow: hidden } which can trap content.
  // useLayoutEffect runs before paint so Android does not show a blank frame.
  useLayoutEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.documentElement.classList.add("pj-share-route");
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    const prevBodyHeight = document.body.style.height;
    const prevHtmlHeight = document.documentElement.style.height;
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    document.documentElement.style.height = "auto";
    return () => {
      document.documentElement.classList.remove("pj-share-route");
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
      document.body.style.height = prevBodyHeight;
      document.documentElement.style.height = prevHtmlHeight;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.title = "Property Journal · Shared Property";
    }
    publicShareLog("01", { action: "route mounted", href, route: "app/share/[token].tsx" });
    shareAudit("13", { action: "public route mounted", token: token ?? null, href });
  }, [token, href]);

  useEffect(() => {
    let cancelled = false;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function run() {
      publicShareLog("02", {
        tokenPresent: Boolean(token?.trim()),
        tokenLength: token?.trim().length ?? 0,
      });

      if (!token?.trim()) {
        setShare(null);
        setErrorKind("invalid");
        setErrorDetail("Missing share token.");
        setLoading(false);
        publicShareLog("07", { branch: "invalid_missing_token" });
        return;
      }

      setLoading(true);
      setErrorKind(null);
      setErrorDetail(null);
      setShare(null);
      publicShareLog("03", { action: "loading started" });

      timer = setTimeout(() => {
        if (cancelled) return;
        timedOut = true;
        setLoading(false);
        setErrorKind("timeout");
        setErrorDetail("This shared property could not be loaded.");
        publicShareLog("FAIL", { reason: "timeout", ms: LOAD_TIMEOUT_MS });
        shareAuditFailure("timeout", new Error(`share load timed out after ${LOAD_TIMEOUT_MS}ms`), {
          token,
        });
        publicShareLog("07", { branch: "timeout" });
      }, LOAD_TIMEOUT_MS);

      try {
        publicShareLog("04", { action: "RPC requested", rpc: "get_share_by_token" });
        const result = await fetchPropertyShareByToken(token);
        if (cancelled || timedOut) return;
        if (timer) clearTimeout(timer);

        publicShareLog("05", {
          action: "RPC returned",
          hasRow: Boolean(result),
          hasSnapshot: Boolean(result?.snapshot_json),
          isActive: result?.is_active ?? null,
        });

        if (!result) {
          setErrorKind("invalid");
          setErrorDetail(null);
          setLoading(false);
          publicShareLog("07", { branch: "invalid_or_expired" });
          return;
        }

        const normalized: PropertyShare = {
          ...result,
          property_label: String(result.property_label ?? "Shared property"),
          label: String(result.label ?? "Shared link"),
          snapshot_json: asSnapshot(result.snapshot_json),
          created_at: result.created_at ?? new Date().toISOString(),
        };
        publicShareLog("06", {
          action: "data normalized",
          propertyLabelPresent: Boolean(normalized.property_label),
          snapshotKeys: Object.keys(asSnapshot(normalized.snapshot_json)),
        });
        setShare(normalized);
        setLoading(false);
        publicShareLog("07", { branch: "content" });
        publicShareLog("08", { action: "content rendered" });
      } catch (e) {
        if (cancelled || timedOut) return;
        if (timer) clearTimeout(timer);
        const message = e instanceof Error ? e.message : String(e);
        const stack = e instanceof Error ? e.stack : undefined;
        publicShareLog("FAIL", {
          name: e instanceof Error ? e.name : "Error",
          message,
          stack,
        });
        shareAuditFailure("16 property data render", e);
        setErrorKind("error");
        setErrorDetail(message || "Unable to load shared property");
        setLoading(false);
        publicShareLog("07", { branch: "error" });
      }
    }

    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, retryKey]);

  const snapshot = useMemo(() => asSnapshot(share?.snapshot_json), [share]);
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
            ) : (
              <Text style={[styles.emptyStateText, { textAlign: "left", marginTop: 8 }]}>
                This link may have been revoked, expired, or entered incorrectly.
              </Text>
            )}
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
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 320,
            padding: 24,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textPrimary, marginTop: 12, fontWeight: "700" }}>
            Loading shared property…
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 8, textAlign: "center" }}>
            Please wait — this usually takes a few seconds.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorKind === "timeout") {
    return (
      <Failure
        title="This shared property could not be loaded."
        detail="The request timed out. Check your connection and try again."
      />
    );
  }

  if (errorKind === "error") {
    return <Failure title="Unable to load shared property" detail={errorDetail} />;
  }

  if (errorKind === "invalid" || !share) {
    return (
      <Failure
        title="Share not found or expired"
        detail="This link may have been revoked, expired, or entered incorrectly. Ask the property owner for a new link."
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
              {share.label || "Shared link"}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>
              Read-only · Created {formatCreatedAt(share.created_at)}
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
