import { Component, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
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
import {
  normalizeShareSnapshot,
  type PropertyShareSnapshot,
  type ShareApplianceItem,
  type ShareDocItem,
  type ShareGalleryItem,
  type ShareMaintenanceItem,
  type ShareRepairItem,
  type ShareTimelineItem,
  type ShareWarrantyItem,
} from "@/lib/shareSnapshot";
import type { PropertyShare } from "@/types/premium";

type LoadErrorKind = "invalid" | "timeout" | "error";

const LOAD_TIMEOUT_MS = 12000;
const HOME_URL = "https://property-journal.vercel.app/";

function dash(value: string | undefined | null): string {
  const s = (value ?? "").trim();
  return s || "—";
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
  const [snapshot, setSnapshot] = useState<PropertyShareSnapshot>(() => normalizeShareSnapshot(null));
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
        setSnapshot(normalizeShareSnapshot(null));

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

        const snap = normalizeShareSnapshot(result.snapshot_json);
        setShare({
          ...result,
          property_label: String(result.property_label ?? snap.nickname ?? "Shared property"),
          label: String(result.label ?? "Shared link"),
          snapshot_json: snap,
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

  const facts: { label: string; value: string }[] = [
    { label: "Full address", value: dash(snapshot.fullAddress) },
    { label: "Property type", value: dash(snapshot.propertyType) },
    { label: "Year built", value: dash(snapshot.yearBuilt) },
    {
      label: "Square footage",
      value: snapshot.squareFootage.trim()
        ? `${snapshot.squareFootage.trim()} sq ft`
        : "—",
    },
    { label: "Bedrooms", value: dash(snapshot.bedrooms) },
    { label: "Bathrooms", value: dash(snapshot.bathrooms) },
    { label: "Lot size", value: dash(snapshot.lotSize) },
  ];

  const summaryCards: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: "Maintenance Tasks", value: snapshot.counts.maintenance, icon: "construct-outline" },
    { label: "Repairs", value: snapshot.counts.repairs, icon: "hammer-outline" },
    { label: "Appliances", value: snapshot.counts.appliances, icon: "hardware-chip-outline" },
    { label: "Documents", value: snapshot.counts.documents, icon: "document-text-outline" },
    { label: "Photos", value: snapshot.counts.photos, icon: "images-outline" },
    { label: "Warranties", value: snapshot.counts.warranties, icon: "shield-checkmark-outline" },
    {
      label: "Upcoming Maintenance",
      value: snapshot.counts.upcomingMaintenance,
      icon: "calendar-outline",
    },
  ];

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
          {snapshot.photoUri ? (
            <Image
              source={{ uri: snapshot.photoUri }}
              style={{
                width: "100%",
                height: Math.min(220, width * 0.55),
                borderRadius: 14,
                backgroundColor: colors.bgSection,
                marginBottom: 16,
              }}
              resizeMode="cover"
              accessibilityLabel="Property photo"
            />
          ) : (
            <View
              style={{
                width: "100%",
                height: 140,
                borderRadius: 14,
                backgroundColor: colors.bgSection,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="home-outline" size={40} color={colors.primary} />
            </View>
          )}

          <Text
            style={{
              fontSize: 24,
              fontWeight: "900",
              color: colors.textPrimary,
              textAlign: "left",
            }}
          >
            {snapshot.nickname || share.property_label || "Shared property"}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 4, fontWeight: "600" }}>
            Read-only Share
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
            Created {formatCreatedAt(share.created_at)}
          </Text>

          <Section title="Property Details">
            {facts.map((row) => (
              <FactRow key={row.label} label={row.label} value={row.value} />
            ))}
          </Section>

          <Section title="Summary">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {summaryCards.map((card) => (
                <SummaryCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  icon={card.icon}
                />
              ))}
            </View>
          </Section>

          {snapshot.ownerMessage ? (
            <Section title="Owner Message">
              <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
                {snapshot.ownerMessage}
              </Text>
            </Section>
          ) : null}

          <TimelineSection items={snapshot.timeline} />
          <RepairsSection items={snapshot.recentRepairs} />
          <MaintenanceListSection
            title="Maintenance History"
            empty="No completed maintenance recorded in this share."
            items={snapshot.maintenanceHistory}
            mode="history"
          />
          <MaintenanceListSection
            title="Upcoming Maintenance"
            empty="No upcoming maintenance in this share."
            items={snapshot.upcomingMaintenance}
            mode="upcoming"
          />
          <AppliancesSection items={snapshot.appliances} />
          <GallerySection items={snapshot.gallery} />
          <DocumentsSection documents={snapshot.documents} warranties={snapshot.warranties} />

          <Text
            style={{
              color: colors.textMuted,
              fontSize: 12,
              textAlign: "center",
              marginTop: 28,
              lineHeight: 18,
            }}
          >
            Shared via Property Journal · This is a read-only preview
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.bgCard,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginTop: 14,
      }}
    >
      <Text style={[styles.cardTitle, { marginBottom: 12 }]}>{title}</Text>
      {children}
    </View>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 13, flex: 1 }}>{label}</Text>
      <Text
        style={{
          color: colors.textPrimary,
          fontWeight: "700",
          fontSize: 13,
          flex: 1.2,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View
      style={{
        width: "47%",
        minWidth: 140,
        flexGrow: 1,
        backgroundColor: colors.bgSection,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={{ fontSize: 22, fontWeight: "900", color: colors.primary, marginTop: 8 }}>
        {value}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 16 }}>
        {label}
      </Text>
    </View>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>{text}</Text>;
}

function TimelineSection({ items }: { items: ShareTimelineItem[] }) {
  return (
    <Section title="Property Timeline">
      {items.length === 0 ? (
        <EmptyLine text="No timeline events in this share." />
      ) : (
        items.map((item, index) => (
          <View
            key={`${item.kind}-${item.date}-${item.title}-${index}`}
            style={{
              flexDirection: "row",
              gap: 10,
              paddingVertical: 10,
              borderBottomWidth: index === items.length - 1 ? 0 : 1,
              borderBottomColor: colors.borderLight,
            }}
          >
            <View
              style={{
                marginTop: 2,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: item.kind === "repair" ? colors.warning : colors.primary,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{item.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {dash(item.date)}
                {item.detail ? ` · ${item.detail}` : ""}
                {` · ${item.kind === "repair" ? "Repair" : "Maintenance"}`}
              </Text>
            </View>
          </View>
        ))
      )}
    </Section>
  );
}

function RepairsSection({ items }: { items: ShareRepairItem[] }) {
  return (
    <Section title="Recent Repairs">
      {items.length === 0 ? (
        <EmptyLine text="No repairs recorded in this share." />
      ) : (
        items.map((item, index) => (
          <View
            key={`${item.title}-${item.date}-${index}`}
            style={{
              paddingVertical: 10,
              borderBottomWidth: index === items.length - 1 ? 0 : 1,
              borderBottomColor: colors.borderLight,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{item.title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>
              {[item.date, item.category, item.cost ? `$${item.cost}` : null]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {item.notes ? (
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                {item.notes}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </Section>
  );
}

function MaintenanceListSection({
  title,
  empty,
  items,
  mode,
}: {
  title: string;
  empty: string;
  items: ShareMaintenanceItem[];
  mode: "history" | "upcoming";
}) {
  return (
    <Section title={title}>
      {items.length === 0 ? (
        <EmptyLine text={empty} />
      ) : (
        items.map((item, index) => (
          <View
            key={`${item.title}-${index}`}
            style={{
              paddingVertical: 10,
              borderBottomWidth: index === items.length - 1 ? 0 : 1,
              borderBottomColor: colors.borderLight,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{item.title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>
              {mode === "history"
                ? `Completed ${dash(item.lastCompleted)}`
                : `Due ${dash(item.nextDue)}`}
              {item.status ? ` · ${item.status}` : ""}
              {item.category ? ` · ${item.category}` : ""}
            </Text>
          </View>
        ))
      )}
    </Section>
  );
}

function AppliancesSection({ items }: { items: ShareApplianceItem[] }) {
  return (
    <Section title="Appliance Inventory">
      {items.length === 0 ? (
        <EmptyLine text="No appliances recorded in this share." />
      ) : (
        items.map((item, index) => (
          <View
            key={`${item.name}-${index}`}
            style={{
              flexDirection: "row",
              gap: 12,
              paddingVertical: 12,
              borderBottomWidth: index === items.length - 1 ? 0 : 1,
              borderBottomColor: colors.borderLight,
            }}
          >
            {item.photoUri ? (
              <Image
                source={{ uri: item.photoUri }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 10,
                  backgroundColor: colors.bgSection,
                }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 10,
                  backgroundColor: colors.bgSection,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="hardware-chip-outline" size={22} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>{item.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                {[
                  item.brand ? `Manufacturer: ${item.brand}` : null,
                  item.model ? `Model: ${item.model}` : null,
                  item.installYear ? `Install year: ${item.installYear}` : null,
                  item.condition ? `Condition: ${item.condition}` : null,
                  item.warrantyExpires ? `Warranty: ${item.warrantyExpires}` : null,
                ]
                  .filter(Boolean)
                  .join("\n")}
              </Text>
            </View>
          </View>
        ))
      )}
    </Section>
  );
}

function GallerySection({ items }: { items: ShareGalleryItem[] }) {
  return (
    <Section title="Property Photo Gallery">
      {items.length === 0 ? (
        <EmptyLine text="No gallery photos in this share." />
      ) : (
        <View style={{ gap: 14 }}>
          {items.map((item, index) => (
            <View key={`${item.uri}-${index}`}>
              <Image
                source={{ uri: item.uri }}
                style={{
                  width: "100%",
                  height: 180,
                  borderRadius: 12,
                  backgroundColor: colors.bgSection,
                }}
                resizeMode="cover"
              />
              <Text style={{ color: colors.textPrimary, fontWeight: "600", marginTop: 8 }}>
                {item.caption || "Photo"}
              </Text>
              {item.date ? (
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {item.date}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}

function DocumentsSection({
  documents,
  warranties,
}: {
  documents: ShareDocItem[];
  warranties: ShareWarrantyItem[];
}) {
  return (
    <Section title="Documents and Warranties">
      {documents.length === 0 && warranties.length === 0 ? (
        <EmptyLine text="No shareable documents or warranties in this share." />
      ) : (
        <>
          {documents.length > 0 ? (
            <View style={{ marginBottom: warranties.length ? 14 : 0 }}>
              <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>
                DOCUMENTS
              </Text>
              {documents.map((doc, index) => (
                <View
                  key={`${doc.title}-${index}`}
                  style={{
                    paddingVertical: 8,
                    borderBottomWidth: index === documents.length - 1 ? 0 : 1,
                    borderBottomColor: colors.borderLight,
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{doc.title}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {[doc.category, doc.uploadDate ? `Uploaded ${doc.uploadDate}` : null, doc.expiresDate ? `Expires ${doc.expiresDate}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {warranties.length > 0 ? (
            <View>
              <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>
                WARRANTIES
              </Text>
              {warranties.map((w, index) => (
                <View
                  key={`${w.title}-${index}`}
                  style={{
                    paddingVertical: 8,
                    borderBottomWidth: index === warranties.length - 1 ? 0 : 1,
                    borderBottomColor: colors.borderLight,
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{w.title}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {[w.source, w.expiresDate ? `Expires ${w.expiresDate}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Section>
  );
}
