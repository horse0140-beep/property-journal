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
import { ShareReportView } from "@/components/ShareReportView";
import { fetchPropertyShareByToken } from "@/services/sharingService";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { sanitizeShareSnapshot, type PropertyShareSnapshot } from "@/lib/shareSnapshot";
import type { PropertyShare } from "@/types/premium";

type LoadErrorKind = "invalid" | "timeout" | "error";

const LOAD_TIMEOUT_MS = 12000;
const HOME_URL = "https://property-journal.vercel.app/";

export default function SharedPropertyScreen() {
  return (
    <ShareErrorBoundary>
      <SharedPropertyScreenInner />
    </ShareErrorBoundary>
  );
}

class ShareErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) console.error("[share] render error", error);
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
              onPress={() => this.setState({ hasError: false })}
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
  const contentWidth = Math.min(Math.max(width - 32, 280), 560);

  const [share, setShare] = useState<PropertyShare | null>(null);
  const [snapshot, setSnapshot] = useState<PropertyShareSnapshot>(() =>
    sanitizeShareSnapshot(null)
  );
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
        setSnapshot(sanitizeShareSnapshot(null));

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

        const snap = sanitizeShareSnapshot(result.snapshot_json);
        setShare({
          ...result,
          property_label: String(result.property_label ?? snap.nickname ?? "Shared property"),
          label: String(result.label ?? "Shared link"),
          snapshot_json: snap as unknown as Record<string, unknown>,
          created_at: result.created_at ?? new Date().toISOString(),
        });
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
          <ShareReportView
            snapshot={snapshot}
            propertyLabel={share.property_label}
            createdAt={share.created_at}
            heroHeight={Math.min(220, width * 0.55)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
