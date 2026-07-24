/**
 * FORENSIC INSTRUMENTATION — temporary.
 * Module-load marker runs immediately after imports to prove the route file evaluated.
 */
import {
  forensicFail,
  forensicModuleLoad,
  forensicStep,
  formatForensicReport,
  getForensicEntries,
  getLastForensicException,
  installShareForensicErrorHandlers,
  diagnoseMissingStep,
  maskShareToken,
  safeShareHref,
  startShareErudaConsole,
  subscribeForensics,
  type ForensicEntry,
} from "@/lib/publicShareForensics";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Component } from "react";
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

forensicModuleLoad("app/share/[token].tsx");

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
    } catch (e) {
      forensicFail("asSnapshot JSON.parse", e, "app/share/[token].tsx asSnapshot");
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
  } catch (e) {
    forensicFail("formatCreatedAt", e, "app/share/[token].tsx formatCreatedAt");
    return "—";
  }
}

export default function SharedPropertyScreen() {
  // STEP 1 once — if this never logs, route never mounted / never rendered.
  const loggedMount = useRef(false);
  if (!loggedMount.current) {
    loggedMount.current = true;
    forensicStep(1, "SharedPropertyScreen function invoked (first render)", {
      platform: Platform.OS,
      href: safeShareHref(),
    });
  }

  return (
    <ShareErrorBoundary>
      <SharedPropertyScreenInner />
    </ShareErrorBoundary>
  );
}

class ShareErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string; stack?: string }
> {
  state = { hasError: false, message: "", stack: undefined as string | undefined };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || "Unknown render error",
      stack: error?.stack,
    };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    forensicFail(
      "ShareErrorBoundary",
      error,
      `app/share/[token].tsx ShareErrorBoundary${info.componentStack ? info.componentStack.split("\n")[1] ?? "" : ""}`
    );
    console.error("[SHARE FORENSICS] componentDidCatch stack", error.stack);
    console.error("[SHARE FORENSICS] componentStack", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView
          style={{ flex: 1, backgroundColor: colors.bg }}
          edges={["top", "left", "right", "bottom"]}
        >
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={[styles.emptyStateTitle, { textAlign: "left" }]}>
              Something went wrong while displaying this property.
            </Text>
            <Text style={{ color: colors.danger, marginTop: 8, fontWeight: "700" }}>
              {this.state.message}
            </Text>
            {this.state.stack ? (
              <Text
                selectable
                style={{
                  color: colors.textPrimary,
                  fontSize: 11,
                  marginTop: 12,
                  fontFamily: Platform.OS === "web" ? "monospace" : undefined,
                }}
              >
                {this.state.stack}
              </Text>
            ) : null}
            <ForensicsHud forceVisible />
            <Pressable
              style={[styles.primaryButton, { marginTop: 20 }]}
              onPress={() => this.setState({ hasError: false, message: "", stack: undefined })}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

function ForensicsHud({ forceVisible }: { forceVisible?: boolean }) {
  const [trail, setTrail] = useState<ForensicEntry[]>(() => getForensicEntries());
  const [expanded, setExpanded] = useState(true);
  const lastEx = getLastForensicException();

  useEffect(() => subscribeForensics(setTrail), []);

  if (!forceVisible && !expanded && trail.length === 0) return null;

  const reached = new Set(
    trail.filter((t) => typeof t.step === "number").map((t) => t.step as number)
  );
  const lastStep = [...reached].sort((a, b) => a - b).pop() ?? 0;
  const nextMissing = lastStep < 10 ? lastStep + 1 : null;
  const diag = diagnoseMissingStep(reached);

  return (
    <View
      style={{
        marginBottom: 12,
        padding: 10,
        borderRadius: 8,
        backgroundColor: "#111827",
        borderWidth: 1,
        borderColor: "#F59E0B",
      }}
    >
      <Pressable onPress={() => setExpanded((v) => !v)}>
        <Text style={{ color: "#FBBF24", fontWeight: "800", fontSize: 13 }}>
          SHARE FORENSICS {expanded ? "▼" : "▶"} · last STEP {lastStep || "none"}
          {nextMissing ? ` · waiting STEP ${nextMissing}` : " · complete"}
        </Text>
      </Pressable>
      {expanded ? (
        <>
          <Text
            selectable
            style={{
              color: "#FDE68A",
              fontSize: 11,
              marginTop: 6,
              fontFamily: Platform.OS === "web" ? "monospace" : undefined,
            }}
          >
            DIAGNOSIS: missing={String(diag.missingStep)}
            {"\n"}
            {diag.file} · {diag.component}
            {"\n"}
            {diag.lineHint}
            {"\n"}
            {diag.hypothesis}
          </Text>
          <Text style={{ color: "#E5E7EB", fontSize: 11, marginTop: 6 }}>
            If a STEP never appears, that is the failure point. Tap Eruda gear for full console + stack.
          </Text>
          {trail.slice(-12).map((e, i) => (
            <Text
              key={`${e.at}-${i}`}
              selectable
              style={{
                color: e.step === "FAIL" ? "#FCA5A5" : "#D1FAE5",
                fontSize: 11,
                marginTop: 4,
                fontFamily: Platform.OS === "web" ? "monospace" : undefined,
              }}
            >
              {e.label}
              {e.detail ? ` — ${e.detail}` : ""}
            </Text>
          ))}
          {lastEx ? (
            <Text
              selectable
              style={{
                color: "#FCA5A5",
                fontSize: 10,
                marginTop: 8,
                fontFamily: Platform.OS === "web" ? "monospace" : undefined,
              }}
            >
              EXCEPTION: {lastEx.message}
              {"\n"}
              {lastEx.stack}
            </Text>
          ) : null}
          {Platform.OS === "web" ? (
            <Pressable
              onPress={async () => {
                const report = formatForensicReport();
                try {
                  await navigator.clipboard?.writeText(report);
                } catch {
                  // ignore
                }
              }}
              style={{ marginTop: 8 }}
            >
              <Text style={{ color: "#93C5FD", fontWeight: "700", fontSize: 12 }}>
                Copy forensic report
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
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
  const [paintedHeader, setPaintedHeader] = useState(false);
  const [paintedProperty, setPaintedProperty] = useState(false);

  const href = safeShareHref();

  useLayoutEffect(() => {
    installShareForensicErrorHandlers();
    if (Platform.OS === "web") {
      startShareErudaConsole();
      document.documentElement.classList.add("pj-share-route");
      // Do NOT override html/body height or #root display here — that collapses
      // RN Web flex:1 children to height:0 (blank page). Unlock lives in _layout.
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.title = "Property Journal · Shared Property";
    }
    // Confirm effects run after first paint (provider/Suspense can block this).
    forensicStep(2, `effect after mount · tokenParamType=${typeof tokenParam}`, {
      href,
    });
  }, [href, tokenParam]);

  useEffect(() => {
    let cancelled = false;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function run() {
      try {
        // Re-log STEP 2 with parsed token for the load pipeline (masked).
        const parsed = typeof token === "string" ? token.trim() : "";
        forensicStep(
          2,
          parsed
            ? `token=${maskShareToken(parsed)} tokenLength=${parsed.length}`
            : "EMPTY/MISSING token",
          {
            hasToken: Boolean(parsed),
            token: parsed ? maskShareToken(parsed) : "(empty)",
          }
        );

        if (!parsed) {
          setErrorKind("invalid");
          setErrorDetail("Missing share token.");
          setLoading(false);
          return;
        }

        // STEP 3
        const urlOk = isSupabaseConfigured;
        let authProbe: string = "skip";
        try {
          // Touch client without requiring a session.
          const { error } = await supabase.auth.getSession();
          authProbe = error ? `session_error:${error.message}` : "session_ok_or_null";
        } catch (e) {
          authProbe = e instanceof Error ? e.message : String(e);
          forensicFail("supabase.auth.getSession", e, "app/share/[token].tsx STEP 3");
        }
        forensicStep(3, `configured=${urlOk} authProbe=${authProbe}`);

        setLoading(true);
        setErrorKind(null);
        setErrorDetail(null);
        setShare(null);
        setSnapshot({});
        setPaintedHeader(false);
        setPaintedProperty(false);

        // STEP 4
        forensicStep(4, "get_share_by_token starting");
        timer = setTimeout(() => {
          if (cancelled) return;
          timedOut = true;
          setLoading(false);
          setErrorKind("timeout");
          setErrorDetail("This property is taking too long to load.");
          forensicFail(
            "RPC timeout",
            new Error(`RPC timed out after ${LOAD_TIMEOUT_MS}ms`),
            "app/share/[token].tsx STEP 4/5"
          );
        }, LOAD_TIMEOUT_MS);

        const result = await fetchPropertyShareByToken(parsed);
        if (cancelled || timedOut) return;
        if (timer) clearTimeout(timer);

        // STEP 5
        forensicStep(5, result ? `row id present=${Boolean(result.id)}` : "RPC returned null", {
          hasSnapshot: Boolean(result?.snapshot_json),
          isActive: result?.is_active ?? null,
        });

        if (!result) {
          setErrorKind("invalid");
          setErrorDetail(null);
          setLoading(false);
          return;
        }

        // STEP 6 — log key names only (never snapshot values / addresses / URLs).
        let normalized: PropertyShare;
        let snap: Snapshot;
        try {
          snap = asSnapshot(result.snapshot_json);
          normalized = {
            ...result,
            property_label: String(result.property_label ?? "Shared property"),
            label: String(result.label ?? "Shared link"),
            snapshot_json: snap,
            created_at: result.created_at ?? new Date().toISOString(),
          };
          const keyNames = Object.keys(snap)
            .filter((k) => !/url|email|address|phone|document/i.test(k))
            .join(",");
          forensicStep(6, `snapshotKeyCount=${Object.keys(snap).length} safeKeys=${keyNames || "(none)"}`);
        } catch (e) {
          forensicFail("normalization", e, "app/share/[token].tsx STEP 6");
          setErrorKind("error");
          setErrorDetail(e instanceof Error ? e.message : String(e));
          setLoading(false);
          return;
        }

        setShare(normalized);
        setSnapshot(snap);
        setLoading(false);
      } catch (e) {
        if (cancelled || timedOut) return;
        if (timer) clearTimeout(timer);
        forensicFail("load pipeline", e, "app/share/[token].tsx SharedPropertyScreenInner.run");
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
  }, [token, tokenParam, retryKey]);

  useEffect(() => {
    if (!share || loading) return;
    // STEP 7 after header commit
    const id = requestAnimationFrame(() => {
      if (!paintedHeader) {
        setPaintedHeader(true);
        forensicStep(7, "header paint committed");
      }
    });
    return () => cancelAnimationFrame(id);
  }, [share, loading, paintedHeader]);

  useEffect(() => {
    if (!share || loading || !paintedHeader) return;
    const id = requestAnimationFrame(() => {
      if (!paintedProperty) {
        setPaintedProperty(true);
        forensicStep(8, "property overview paint committed");
        // STEP 9 — public page has no photo gallery; prove photos are not the blocker.
        forensicStep(9, "skipped — public share UI has no photo/signed-URL section");
        forensicStep(10, "page complete");
      }
    });
    return () => cancelAnimationFrame(id);
  }, [share, loading, paintedHeader, paintedProperty]);

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
          <ForensicsHud forceVisible />
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
        <View style={{ flex: 1, padding: 16 }}>
          <ForensicsHud forceVisible />
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 240 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textPrimary, marginTop: 12, fontWeight: "700" }}>
              Loading shared property…
            </Text>
          </View>
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
          <ForensicsHud forceVisible />

          {/* STEP 7 header */}
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

          {/* STEP 8 property */}
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

          {/* STEP 9 placeholder — no images */}
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
