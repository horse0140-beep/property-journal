import { useState, useRef, useEffect } from "react";
import {
  KeyboardAvoidingView, Platform, ScrollView, Text, View,
  TextInput, Pressable, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { colors, styles } from "@/constants/theme";
import { useHomeWise } from "@/context/HomeWiseContext";

// ── AI Configuration ──────────────────────────────────────────────────────────
// For local development: create a .env file at the project root with:
//   EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
//
// For production: set this as an EAS Secret:
//   eas secret:create --scope project --name EXPO_PUBLIC_ANTHROPIC_API_KEY --value sk-ant-...
//
// IMPORTANT: In production, proxy through your own backend so the key is never
// shipped in the app binary. See README for backend proxy setup.
const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? "";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What maintenance is due soon?",
  "How old are my appliances?",
  "Which warranties expire soon?",
  "Estimate my annual maintenance budget",
  "Show all plumbing repairs",
  "What's my Home Health Score?",
  "Which appliances need replacing?",
  "Generate a maintenance summary",
];

export default function AIScreen() {
  const ctx = useHomeWise();
  const { prompt: initialPrompt } = useLocalSearchParams<{ prompt?: string }>();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hi! I'm your Property Journal AI Assistant. I have full access to your home data and can answer questions about maintenance, repairs, appliances, warranties, and more.\n\nWhat would you like to know about ${ctx.selectedProperty?.address ?? "your home"}?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (initialPrompt && typeof initialPrompt === "string") {
      setInput(initialPrompt);
    }
  }, [initialPrompt]);

  function buildContext() {
    const pid = ctx.selectedProperty?.id;
    if (!pid) return "No property selected.";

    const prop  = ctx.selectedProperty!;
    const maint = ctx.maintenanceItems.filter((m) => m.propertyId === pid);
    const reps  = ctx.repairs.filter((r) => r.propertyId === pid);
    const apps  = ctx.appliances.filter((a) => a.propertyId === pid);
    const docs  = ctx.documents.filter((d) => d.propertyId === pid);
    const score = ctx.getPropertyScore(pid);

    return `PROPERTY JOURNAL PROPERTY DATA:

Property: ${prop.address}, ${prop.city}, ${prop.state}
Type: ${prop.type} | Built: ${prop.yearBuilt} | Sq Ft: ${prop.squareFeet}
Beds: ${prop.bedrooms} | Baths: ${prop.bathrooms}
Est. Value: $${prop.estimatedValue} | Purchased: ${prop.purchaseDate}

HOME HEALTH SCORE: ${score.overall}/100 (${score.label})
- Maintenance: ${score.maintenance} | Appliances: ${score.appliances} | Repairs: ${score.repairs}
- Warranty: ${score.warranty} | Inspections: ${score.inspections}

MAINTENANCE (${maint.length} items):
${maint.map((m) => `- ${m.title}: ${m.status}, Due ${m.nextDue}, Priority: ${m.priority}. Notes: ${m.notes}`).join("\n") || "None"}

REPAIRS (${reps.length}):
${reps.map((r) => `- ${r.title}: ${r.date}, $${r.cost}, Contractor: ${r.contractor}. Warranty: ${r.warrantyExpires ?? "None"}. Notes: ${r.notes}`).join("\n") || "None"}

APPLIANCES (${apps.length}):
${apps.map((a) => `- ${a.name}: ${a.brand} ${a.model}, Installed ${a.installDate}, Condition: ${a.condition}, Warranty: ${a.warrantyExpires || "Expired/None"}, Expected life: ${a.expectedLifeYears} yrs. Notes: ${a.notes}`).join("\n") || "None"}

DOCUMENTS (${docs.length}):
${docs.map((d) => `- ${d.title} (${d.category}), Uploaded ${d.uploadDate}, Expires: ${d.expiresDate ?? "N/A"}`).join("\n") || "None"}

CONTRACTORS (${ctx.contractors.length}):
${ctx.contractors.map((c) => `- ${c.name}: ${c.trade}, ${c.phone}, Rating: ${c.rating}/5`).join("\n") || "None"}`;
  }

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;

    const userMsg: Message = { role: "user", content: q };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    scrollRef.current?.scrollToEnd({ animated: true });

    try {
      if (!ANTHROPIC_API_KEY) {
        setMessages((prev) => [...prev, {
          role: "assistant" as const,
          content: "The AI assistant needs an API key to work.\n\nAdd EXPO_PUBLIC_ANTHROPIC_API_KEY to your .env file. See README for setup instructions.",
        }]);
        setLoading(false);
        return;
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are Property Journal AI, an expert home assistant built into the Property Journal app. You have access to this homeowner's complete property data. Answer questions helpfully, concisely, and accurately using their specific data. Format responses clearly with line breaks. When listing items, use bullet points. Be conversational but informative.\n\n${buildContext()}`,
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const apiMessage = data?.error?.message ?? `Request failed (${res.status}).`;
        console.warn("[AI] Anthropic API error:", res.status, apiMessage);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "The AI assistant is temporarily unavailable. Please try again in a moment.",
          },
        ]);
        return;
      }

      const reply =
        data.content?.map((b: any) => b.text ?? "").join("") ??
        "Sorry, I couldn't process that. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm having trouble connecting right now. Please check your internet connection and try again." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <Screen noPad>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={styles.rowStart}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </View>
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>AI Home Assistant</Text>
            <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}>● Online — knows your home</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 8 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.map((m, i) => (
            <View key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              {m.role === "assistant" && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="sparkles" size={11} color="#fff" />
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700" }}>Property Journal AI</Text>
                </View>
              )}
              <View style={{
                padding: 14,
                borderRadius: m.role === "user" ? 18 : 16,
                borderBottomRightRadius: m.role === "user" ? 4 : 16,
                borderBottomLeftRadius: m.role === "assistant" ? 4 : 16,
                backgroundColor: m.role === "user" ? colors.primary : colors.bgCard,
                borderWidth: m.role === "assistant" ? 1 : 0,
                borderColor: colors.border,
              }}>
                <Text style={{ color: m.role === "user" ? "#fff" : colors.textPrimary, fontSize: 14, lineHeight: 22 }}>
                  {m.content}
                </Text>
              </View>
            </View>
          ))}

          {loading && (
            <View style={{ alignSelf: "flex-start", maxWidth: "85%" }}>
              <View style={{ padding: 14, borderRadius: 16, borderBottomLeftRadius: 4, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            </View>
          )}

          {/* Suggestions shown only after the initial greeting */}
          {messages.length === 1 && (
            <View style={{ marginTop: 4 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 10 }}>Try asking:</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => send(s)}
                    style={{ backgroundColor: colors.bgSection, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}
                  >
                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <View style={{ flexDirection: "row", gap: 10, padding: 12, paddingBottom: 20, backgroundColor: colors.bgCard, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TextInput
            style={[styles.input, { flex: 1, marginTop: 0, maxHeight: 100 }]}
            placeholder="Ask about your home..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => send()}
          />
          <Pressable
            onPress={() => send()}
            disabled={loading || !input.trim()}
            style={{
              width: 46, height: 46, borderRadius: 23,
              backgroundColor: input.trim() && !loading ? colors.primary : colors.bgSection,
              alignItems: "center", justifyContent: "center", alignSelf: "flex-end",
            }}
          >
            <Ionicons name="send" size={18} color={input.trim() && !loading ? "#fff" : colors.textMuted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
