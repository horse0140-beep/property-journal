import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { BackLink } from "@/components/EmptyState";
import { colors, styles } from "@/constants/theme";
import { FAQ_ITEMS, HOW_TO_TOPICS } from "@/lib/helpContent";
import { goBackOrHome } from "@/components/WebHomeButton";

type HelpTab = "howto" | "faq";

export default function HelpScreen() {
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const initialTab: HelpTab =
    (Array.isArray(params.tab) ? params.tab[0] : params.tab) === "faq" ? "faq" : "howto";
  const [tab, setTab] = useState<HelpTab>(initialTab);
  const [openId, setOpenId] = useState<string | null>(
    initialTab === "faq" ? FAQ_ITEMS[0]?.id ?? null : HOW_TO_TOPICS[0]?.id ?? null
  );

  const items = useMemo(() => (tab === "howto" ? HOW_TO_TOPICS : FAQ_ITEMS), [tab]);

  return (
    <Screen>
      <BackLink label="Back" onPress={() => goBackOrHome()} />
      <Text style={[styles.screenTitle, { marginTop: 8 }]}>Help</Text>
      <Text style={{ color: colors.textMuted, marginBottom: 14 }}>
        How to use Property Journal and answers to common questions.
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        <Pressable
          onPress={() => {
            setTab("howto");
            setOpenId(HOW_TO_TOPICS[0]?.id ?? null);
          }}
          style={[styles.chip, tab === "howto" && styles.chipActive, { flex: 1 }]}
        >
          <Text style={[{ textAlign: "center" }, tab === "howto" ? styles.chipTextActive : styles.chipText]}>
            How to Use
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setTab("faq");
            setOpenId(FAQ_ITEMS[0]?.id ?? null);
          }}
          style={[styles.chip, tab === "faq" && styles.chipActive, { flex: 1 }]}
        >
          <Text style={[{ textAlign: "center" }, tab === "faq" ? styles.chipTextActive : styles.chipText]}>
            FAQ
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {items.map((item) => {
          const id = item.id;
          const title = "title" in item ? item.title : item.question;
          const body = "body" in item ? item.body : item.answer;
          const open = openId === id;
          return (
            <Pressable
              key={id}
              onPress={() => setOpenId(open ? null : id)}
              style={{
                backgroundColor: colors.bgCard,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
              }}
            >
              <View style={styles.rowBetween}>
                <Text style={{ color: colors.textPrimary, fontWeight: "800", flex: 1, marginRight: 8 }}>
                  {title}
                </Text>
                <Ionicons
                  name={open ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textMuted}
                />
              </View>
              {open ? (
                <Text style={{ color: colors.textSecondary, marginTop: 10, lineHeight: 20 }}>{body}</Text>
              ) : null}
            </Pressable>
          );
        })}

        <Pressable
          style={[styles.secondaryButton, { marginTop: 8 }]}
          onPress={() => router.push("/(tabs)/profile")}
        >
          <Text style={styles.secondaryButtonText}>Contact support from Profile</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
