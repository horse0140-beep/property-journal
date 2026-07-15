import { SafeAreaView, ScrollView, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800", marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}
function Para({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 8 }}>{children}</Text>;
}
function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>•</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22, flex: 1 }}>{text}</Text>
    </View>
  );
}

export default function TermsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSection, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </Pressable>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>Terms of Service</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 24 }}>Last updated: June 1, 2026</Text>

        <Section title="Agreement to Terms">
          <Para>By accessing or using HomeWise (&quot;the App&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the App.</Para>
        </Section>

        <Section title="Description of Service">
          <Para>HomeWise provides a home management platform to track property maintenance, repairs, appliances, documents, and generate home history reports. The App includes an AI-powered assistant that uses your property data to answer home-related questions.</Para>
        </Section>

        <Section title="User Accounts">
          <Bullet text="You must be at least 18 years old to create an account." />
          <Bullet text="You are responsible for maintaining the confidentiality of your account credentials." />
          <Bullet text="You are responsible for all activity under your account." />
          <Bullet text="You must provide accurate and complete information when registering." />
        </Section>

        <Section title="Acceptable Use">
          <Para>You agree not to:</Para>
          <Bullet text="Violate any applicable laws or regulations." />
          <Bullet text="Upload malicious code or harmful files." />
          <Bullet text="Attempt to gain unauthorized access to other users' accounts or data." />
          <Bullet text="Misrepresent property information in reports shared with buyers or third parties." />
          <Bullet text="Use the AI assistant in violation of Anthropic's usage policies." />
        </Section>

        <Section title="User Content">
          <Para>You retain ownership of all content you upload to HomeWise. By using the App, you grant HomeWise a limited, non-exclusive license to store, process, and display your content solely to provide the App&apos;s services.</Para>
        </Section>

        <Section title="AI Assistant">
          <Para>The AI Home Assistant is powered by Anthropic&apos;s Claude API. Responses are for informational purposes only and do not constitute professional advice. Always consult qualified professionals for significant home decisions.</Para>
        </Section>

        <Section title="Home History Reports">
          <Para>Reports reflect data entered by you. HomeWise does not verify the accuracy of property information or repair history. Consult a licensed real estate professional for transaction advice.</Para>
        </Section>

        <Section title="Subscriptions and Billing">
          <Bullet text="Subscriptions renew automatically unless cancelled 24 hours before renewal." />
          <Bullet text="Manage or cancel your subscription through App Store or Google Play settings." />
          <Bullet text="Refunds follow App Store or Google Play refund policies." />
          <Bullet text="Prices may change with 30 days' notice to active subscribers." />
        </Section>

        <Section title="Disclaimers">
          <Para>THE APP IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND. HOMEWISE DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.</Para>
        </Section>

        <Section title="Limitation of Liability">
          <Para>HOMEWISE&apos;S TOTAL LIABILITY FOR ANY CLAIMS SHALL NOT EXCEED THE AMOUNT YOU PAID IN THE 12 MONTHS PRECEDING THE CLAIM. HOMEWISE IS NOT LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES.</Para>
        </Section>

        <Section title="Termination">
          <Para>You may delete your account at any time from Profile settings. We may suspend access if you violate these Terms.</Para>
        </Section>

        <Section title="Governing Law">
          <Para>These Terms are governed by the laws of the State of Texas, United States.</Para>
        </Section>

        <Section title="Contact">
          <Para>Questions? Contact us at: legal@homewise.app</Para>
          <Para>Website: homewise.app/terms</Para>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
