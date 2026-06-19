import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  TextInput,
  Alert,
  Linking,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { colors, styles } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { isRevenueCatConfigured } from "@/services/revenueCatService";
import { OWNER_ADMIN_EMAIL } from "@/lib/admin";

const STORAGE_KEY = "homewise_launch_readiness_v1";

export type LaunchStatus = "pending" | "in_progress" | "passed" | "failed" | "blocked";

type ChecklistItemConfig = {
  id: string;
  label: string;
  defaultNotes: string;
  actionLabel: string;
  route?: string;
  externalUrl?: string;
};

type ChecklistItemState = {
  status: LaunchStatus;
  notes: string;
};

type SectionConfig = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: ChecklistItemConfig[];
};

const STATUS_ORDER: LaunchStatus[] = ["pending", "in_progress", "passed", "failed", "blocked"];

const STATUS_VARIANT: Record<LaunchStatus, "muted" | "info" | "success" | "danger" | "warning"> = {
  pending: "muted",
  in_progress: "info",
  passed: "success",
  failed: "danger",
  blocked: "warning",
};

const SECTIONS: SectionConfig[] = [
  {
    title: "Core App",
    icon: "phone-portrait-outline",
    items: [
      {
        id: "auth_works",
        label: "Auth works",
        defaultNotes: "Sign in, sign up, sign out, and session restore.",
        actionLabel: "Test Sign In",
        route: "/auth/sign-in",
      },
      {
        id: "profile_saves",
        label: "Profile saves",
        defaultNotes: "Update name, phone, and notification preferences.",
        actionLabel: "Open Profile",
        route: "/(tabs)/profile",
      },
      {
        id: "property_crud",
        label: "Property CRUD works",
        defaultNotes: "Add, edit, select, and delete properties.",
        actionLabel: "Open Properties",
        route: "/(tabs)/properties",
      },
      {
        id: "maintenance_crud",
        label: "Maintenance CRUD works",
        defaultNotes: "Create, complete, and delete maintenance tasks.",
        actionLabel: "Open Maintenance",
        route: "/(tabs)/maintenance",
      },
      {
        id: "appliances_crud",
        label: "Appliances CRUD works",
        defaultNotes: "Add, edit, and remove appliance records.",
        actionLabel: "Open Appliances",
        route: "/(tabs)/maintenance",
      },
      {
        id: "vault_uploads",
        label: "Vault uploads work",
        defaultNotes: "Upload documents, receipts, warranties, and photos.",
        actionLabel: "Open Vault",
        route: "/(tabs)/vault",
      },
      {
        id: "reports_generate",
        label: "Reports generate",
        defaultNotes: "Generate, preview, share, and save PDF Home History Report.",
        actionLabel: "Open Reports",
        route: "/(tabs)/reports",
      },
    ],
  },
  {
    title: "Supabase",
    icon: "server-outline",
    items: [
      {
        id: "rls_enabled",
        label: "RLS enabled",
        defaultNotes: "Run migrations 000–009. Verify row-level security on all tables.",
        actionLabel: "View Users",
        route: "/admin/users",
      },
      {
        id: "storage_policies",
        label: "Storage policies enabled",
        defaultNotes: "Confirm buckets: receipts, warranties, documents, property-photos, reports.",
        actionLabel: "Open Vault",
        route: "/(tabs)/vault",
      },
      {
        id: "owner_access",
        label: "Owner access working",
        defaultNotes: `Owner email ${OWNER_ADMIN_EMAIL} must have full access.`,
        actionLabel: "Owner Dashboard",
        route: "/admin",
      },
      {
        id: "admin_access",
        label: "Admin access working",
        defaultNotes: "super_admin role in user_roles grants admin screens.",
        actionLabel: "Admin Dashboard",
        route: "/admin",
      },
    ],
  },
  {
    title: "Payments",
    icon: "card-outline",
    items: [
      {
        id: "revenuecat_configured",
        label: "RevenueCat configured",
        defaultNotes: "Set EXPO_PUBLIC_REVENUECAT_IOS_KEY and ANDROID_KEY in .env for native builds.",
        actionLabel: "Subscription Center",
        route: "/subscriptions",
      },
      {
        id: "premium_tested",
        label: "Premium plan tested",
        defaultNotes: "Purchase or grant premium and verify feature unlock.",
        actionLabel: "Test Upgrade",
        route: "/features/upgrade",
      },
      {
        id: "landlord_tested",
        label: "Landlord plan tested",
        defaultNotes: "Verify landlord features and plan badge.",
        actionLabel: "Landlord Dashboard",
        route: "/features/landlord-dashboard",
      },
      {
        id: "realtor_tested",
        label: "Realtor plan tested",
        defaultNotes: "Verify realtor tools and buyer reports.",
        actionLabel: "Buyer Reports",
        route: "/features/buyer-reports",
      },
      {
        id: "promo_redemption",
        label: "Promo code redemption tested",
        defaultNotes: "Create a code in admin, redeem on Subscription Center.",
        actionLabel: "Promo Codes",
        route: "/admin/promo-codes",
      },
    ],
  },
  {
    title: "Store Assets",
    icon: "images-outline",
    items: [
      {
        id: "app_icon",
        label: "App icon",
        defaultNotes: "assets/icon.png and assets/adaptive-icon.png configured in app.json.",
        actionLabel: "View app.json",
      },
      {
        id: "splash_screen",
        label: "Splash screen",
        defaultNotes: "assets/splash.png with #0F2460 background in app.json.",
        actionLabel: "View app.json",
      },
      {
        id: "screenshots_67",
        label: "6.7\" screenshots",
        defaultNotes: "iPhone 15 Pro Max — 1290×2796. Add to store-assets/ios-6.7/",
        actionLabel: "App Store Connect",
        externalUrl: "https://appstoreconnect.apple.com",
      },
      {
        id: "screenshots_55",
        label: "5.5\" screenshots",
        defaultNotes: "iPhone 8 Plus — 1242×2208. Add to store-assets/ios-5.5/",
        actionLabel: "App Store Connect",
        externalUrl: "https://appstoreconnect.apple.com",
      },
      {
        id: "play_feature_graphic",
        label: "Google Play feature graphic",
        defaultNotes: "1024×500 PNG. Add to store-assets/android-feature-graphic.png",
        actionLabel: "Play Console",
        externalUrl: "https://play.google.com/console",
      },
    ],
  },
  {
    title: "Legal",
    icon: "document-text-outline",
    items: [
      {
        id: "privacy_policy",
        label: "Privacy Policy",
        defaultNotes: "In-app privacy screen accessible from sign-up and profile.",
        actionLabel: "Open Privacy",
        route: "/legal/privacy",
      },
      {
        id: "terms_of_service",
        label: "Terms of Service",
        defaultNotes: "In-app terms screen linked from sign-up.",
        actionLabel: "Open Terms",
        route: "/legal/terms",
      },
      {
        id: "support_url",
        label: "Support URL",
        defaultNotes: "support@homewise.app — listed in profile help section.",
        actionLabel: "Email Support",
        externalUrl: "mailto:support@homewise.app",
      },
      {
        id: "delete_account",
        label: "Delete Account",
        defaultNotes: "TYPE DELETE confirmation flow at /account/delete.",
        actionLabel: "Test Delete Flow",
        route: "/account/delete",
      },
      {
        id: "forgot_password",
        label: "Forgot Password",
        defaultNotes: "Reset email + deep link to /auth/reset-password.",
        actionLabel: "Test Forgot PW",
        route: "/auth/forgot-password",
      },
    ],
  },
  {
    title: "EAS Builds",
    icon: "build-outline",
    items: [
      {
        id: "android_preview",
        label: "Android preview build works",
        defaultNotes: "eas build --platform android --profile preview",
        actionLabel: "EAS Dashboard",
        externalUrl: "https://expo.dev/accounts/horse536/projects/homewise/builds",
      },
      {
        id: "android_production",
        label: "Android production build works",
        defaultNotes: "eas build --platform android --profile production",
        actionLabel: "EAS Dashboard",
        externalUrl: "https://expo.dev/accounts/horse536/projects/homewise/builds",
      },
      {
        id: "ios_production",
        label: "iOS production build works",
        defaultNotes: "eas build --platform ios --profile production",
        actionLabel: "EAS Dashboard",
        externalUrl: "https://expo.dev/accounts/horse536/projects/homewise/builds",
      },
    ],
  },
];

function defaultState(): Record<string, ChecklistItemState> {
  const map: Record<string, ChecklistItemState> = {};
  for (const section of SECTIONS) {
    for (const item of section.items) {
      map[item.id] = { status: "pending", notes: item.defaultNotes };
    }
  }
  return map;
}

function nextStatus(current: LaunchStatus): LaunchStatus {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function applyAutoChecks(
  state: Record<string, ChecklistItemState>,
  opts: {
    isOwner: boolean;
    isAdmin: boolean;
    revenueCat: boolean;
    supabaseConfigured: boolean;
  }
): Record<string, ChecklistItemState> {
  const next = { ...state };

  if (opts.isOwner && next.owner_access) {
    next.owner_access = {
      ...next.owner_access,
      status: "passed",
      notes: `${OWNER_ADMIN_EMAIL} detected — owner access active.`,
    };
  }

  if (opts.isAdmin && next.admin_access) {
    next.admin_access = {
      ...next.admin_access,
      status: "passed",
      notes: "Admin access confirmed for this session.",
    };
  }

  if (next.revenuecat_configured) {
    next.revenuecat_configured = {
      ...next.revenuecat_configured,
      status: opts.revenueCat ? "passed" : "pending",
      notes: opts.revenueCat
        ? "RevenueCat API keys detected in environment."
        : "Add EXPO_PUBLIC_REVENUECAT_IOS_KEY / ANDROID_KEY for native IAP.",
    };
  }

  if (opts.supabaseConfigured && next.rls_enabled) {
    if (next.rls_enabled.status === "pending") {
      next.rls_enabled = {
        ...next.rls_enabled,
        status: "in_progress",
        notes: "Supabase URL configured. Run all SQL migrations in Supabase dashboard.",
      };
    }
  }

  if (next.app_icon?.status === "pending") {
    next.app_icon = {
      ...next.app_icon,
      status: "in_progress",
      notes: "icon.png configured in app.json — verify 1024×1024 asset quality.",
    };
  }

  if (next.splash_screen?.status === "pending") {
    next.splash_screen = {
      ...next.splash_screen,
      status: "in_progress",
      notes: "splash.png configured in app.json — verify on device cold start.",
    };
  }

  return next;
}

async function loadState(): Promise<Record<string, ChecklistItemState>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Record<string, ChecklistItemState>;
    const base = defaultState();
    for (const id of Object.keys(base)) {
      if (parsed[id]) {
        base[id] = {
          status: parsed[id].status ?? "pending",
          notes: parsed[id].notes ?? base[id].notes,
        };
      }
    }
    return base;
  } catch {
    return defaultState();
  }
}

async function saveState(state: Record<string, ChecklistItemState>) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ChecklistRow({
  item,
  state,
  onStatusPress,
  onNotesChange,
  onAction,
}: {
  item: ChecklistItemConfig;
  state: ChecklistItemState;
  onStatusPress: () => void;
  onNotesChange: (text: string) => void;
  onAction: () => void;
}) {
  return (
    <View
      style={{
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={styles.rowBetween}>
        <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 15, flex: 1 }}>
          {item.label}
        </Text>
        <Pressable onPress={onStatusPress}>
          <AdminBadge label={state.status} variant={STATUS_VARIANT[state.status]} />
        </Pressable>
      </View>

      <TextInput
        style={[
          styles.input,
          {
            marginTop: 10,
            marginBottom: 0,
            minHeight: 56,
            fontSize: 13,
            color: colors.textSecondary,
            textAlignVertical: "top",
          },
        ]}
        value={state.notes}
        onChangeText={onNotesChange}
        multiline
        placeholder="Add launch notes…"
        placeholderTextColor={colors.textMuted}
      />

      <Pressable
        onPress={onAction}
        style={[styles.secondaryButton, { marginTop: 10, alignSelf: "flex-start" }]}
      >
        <Ionicons name="open-outline" size={16} color={colors.primary} />
        <Text style={styles.secondaryButtonText}>{item.actionLabel}</Text>
      </Pressable>
    </View>
  );
}

export default function LaunchReadinessScreen() {
  const { isOwner, isAdmin } = useAuth();
  const [checklist, setChecklist] = useState<Record<string, ChecklistItemState>>(defaultState());
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const loaded = await loadState();
    const merged = applyAutoChecks(loaded, {
      isOwner,
      isAdmin,
      revenueCat: isRevenueCatConfigured(),
      supabaseConfigured: Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL),
    });
    setChecklist(merged);
    await saveState(merged);
    setRefreshing(false);
  }, [isOwner, isAdmin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const items = Object.values(checklist);
    const passed = items.filter((i) => i.status === "passed").length;
    const failed = items.filter((i) => i.status === "failed" || i.status === "blocked").length;
    const total = items.length;
    const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { passed, failed, total, pct };
  }, [checklist]);

  function updateItem(id: string, patch: Partial<ChecklistItemState>) {
    setChecklist((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } };
      saveState(next).catch(() => {});
      return next;
    });
  }

  function handleAction(item: ChecklistItemConfig) {
    if (item.route) {
      router.push(item.route as any);
      return;
    }
    if (item.externalUrl) {
      Linking.openURL(item.externalUrl).catch(() => {
        Alert.alert("Error", "Could not open link.");
      });
      return;
    }
    Alert.alert(
      "app.json",
      "Icon: ./assets/icon.png\nSplash: ./assets/splash.png\nAdaptive: ./assets/adaptive-icon.png"
    );
  }

  function confirmReset() {
    Alert.alert("Reset Checklist", "Reset all items to pending with default notes?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          const fresh = defaultState();
          setChecklist(fresh);
          await saveState(fresh);
          await refresh();
        },
      },
    ]);
  }

  const readyToLaunch = stats.pct >= 90 && stats.failed === 0;

  return (
    <AdminGate>
      <Screen noPad>
        <AdminHeader
          title="Launch Readiness"
          subtitle={`${stats.passed}/${stats.total} passed · ${stats.pct}% complete`}
          rightAction={{ label: "Reset", onPress: confirmReset }}
        />

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                refresh();
              }}
              tintColor={colors.primary}
            />
          }
        >
          <View
            style={{
              backgroundColor: readyToLaunch ? colors.successBg : colors.primary,
              borderRadius: 20,
              padding: 22,
              marginBottom: 18,
            }}
          >
            <Text
              style={{
                color: readyToLaunch ? colors.success : "rgba(255,255,255,0.75)",
                fontSize: 11,
                fontWeight: "900",
                letterSpacing: 1.2,
              }}
            >
              LAUNCH STATUS
            </Text>
            <Text
              style={{
                color: readyToLaunch ? colors.textPrimary : "#fff",
                fontSize: 32,
                fontWeight: "900",
                marginTop: 6,
              }}
            >
              {stats.pct}%
            </Text>
            <Text
              style={{
                color: readyToLaunch ? colors.textSecondary : "rgba(255,255,255,0.85)",
                marginTop: 8,
                fontSize: 14,
                lineHeight: 20,
              }}
            >
              {readyToLaunch
                ? "Checklist looks launch-ready. Run final EAS production builds before submit."
                : `${stats.total - stats.passed} items remaining. Tap badges to update status.`}
            </Text>

            <View style={{ flexDirection: "row", gap: 16, marginTop: 16 }}>
              <View>
                <Text
                  style={{
                    color: readyToLaunch ? colors.success : "#fff",
                    fontSize: 22,
                    fontWeight: "900",
                  }}
                >
                  {stats.passed}
                </Text>
                <Text
                  style={{
                    color: readyToLaunch ? colors.textMuted : "rgba(255,255,255,0.7)",
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  PASSED
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    color: readyToLaunch ? colors.danger : colors.warningBg,
                    fontSize: 22,
                    fontWeight: "900",
                  }}
                >
                  {stats.failed}
                </Text>
                <Text
                  style={{
                    color: readyToLaunch ? colors.textMuted : "rgba(255,255,255,0.7)",
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  FAILED / BLOCKED
                </Text>
              </View>
            </View>
          </View>

          <Card style={{ marginBottom: 14 }}>
            <Text style={[styles.muted, { lineHeight: 20 }]}>
              Tap a status badge to cycle: pending → in progress → passed → failed → blocked.
              Notes are saved automatically on this device.
            </Text>
          </Card>

          {SECTIONS.map((section) => (
            <Card key={section.title} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Ionicons name={section.icon} size={22} color={colors.primary} />
                <Text style={styles.sectionHeader}>{section.title}</Text>
              </View>

              {section.items.map((item) => {
                const state = checklist[item.id] ?? {
                  status: "pending" as LaunchStatus,
                  notes: item.defaultNotes,
                };
                return (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    state={state}
                    onStatusPress={() =>
                      updateItem(item.id, { status: nextStatus(state.status) })
                    }
                    onNotesChange={(text) => updateItem(item.id, { notes: text })}
                    onAction={() => handleAction(item)}
                  />
                );
              })}
            </Card>
          ))}
        </ScrollView>
      </Screen>
    </AdminGate>
  );
}
