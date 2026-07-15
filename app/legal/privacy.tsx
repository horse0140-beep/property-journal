import { ScrollView, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { colors, styles } from "@/constants/theme";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800", marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

function Para({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text style={[{ color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 8 }, style]}>
      {children}
    </Text>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>•</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22, flex: 1 }}>{text}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  return (
    <Screen noPad>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSection, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </Pressable>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>Privacy Policy</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 24 }}>Last updated: June 1, 2026</Text>

        <Section title="Introduction">
          <Para>HomeWise Inc. (&quot;HomeWise,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the HomeWise mobile application. This Privacy Policy explains how we collect, use, disclose, and protect information about you when you use our Services.</Para>
          <Para>By using HomeWise, you agree to the collection and use of information in accordance with this policy.</Para>
        </Section>

        <Section title="Information We Collect">
          <Para>We collect the following types of information:</Para>
          <Bullet text="Account Information: Your name, email address, and password when you register." />
          <Bullet text="Property Data: Addresses, property details, maintenance records, repairs, appliances, and documents you enter." />
          <Bullet text="Photos and Files: Images and documents you upload to the app, stored locally on your device." />
          <Bullet text="Usage Data: How you interact with the app, features used, and session duration." />
          <Bullet text="Device Information: Device type, operating system, and unique device identifiers." />
        </Section>

        <Section title="How We Use Your Information">
          <Bullet text="To provide, maintain, and improve the HomeWise app and its features." />
          <Bullet text="To send maintenance reminders and warranty expiration alerts you've opted into." />
          <Bullet text="To generate your Home History Report™ and other reports you request." />
          <Bullet text="To power the AI Home Assistant with your property context." />
          <Bullet text="To communicate with you about your account, updates, and support." />
          <Bullet text="To detect and prevent fraud, abuse, and security incidents." />
        </Section>

        <Section title="Data Storage">
          <Para>HomeWise stores your data locally on your device using secure device storage. Photos and documents you upload are saved to your device&apos;s local file system within the HomeWise app container.</Para>
          <Para>In the premium version, data may be optionally backed up to encrypted cloud storage. Cloud storage uses industry-standard AES-256 encryption at rest and TLS in transit.</Para>
        </Section>

        <Section title="AI Assistant">
          <Para>When you use the AI Home Assistant feature, your property data (addresses, maintenance records, appliance details) is sent to Anthropic&apos;s API to generate responses. This data is used solely to answer your questions and is not used to train AI models.</Para>
          <Para>Please review Anthropic&apos;s Privacy Policy at anthropic.com/privacy for details on their data handling practices.</Para>
        </Section>

        <Section title="Data Sharing">
          <Para>We do not sell your personal information. We may share information with:</Para>
          <Bullet text="Service Providers: Third-party vendors who help us provide the app (e.g., cloud hosting, analytics), bound by confidentiality obligations." />
          <Bullet text="Legal Requirements: When required by law, court order, or governmental authority." />
          <Bullet text="Business Transfers: In connection with a merger, acquisition, or sale of assets, with prior notice to you." />
          <Para>When you use the Buyer Share Link™ feature, you explicitly choose to share selected property history with third parties. You control exactly what is shared.</Para>
        </Section>

        <Section title="Your Rights">
          <Bullet text="Access: You can request a copy of your data at any time." />
          <Bullet text="Correction: You can update or correct your information within the app." />
          <Bullet text="Deletion: You can delete your account and all associated data from Profile > Delete Account." />
          <Bullet text="Portability: You can export your Home History Report as a PDF." />
          <Bullet text="Opt-Out: You can disable notifications at any time in Profile > Notifications." />
        </Section>

        <Section title="Children's Privacy">
          <Para>HomeWise is not directed to children under 13 years of age. We do not knowingly collect personal information from children under 13. If we learn we have collected such information, we will delete it promptly.</Para>
        </Section>

        <Section title="Security">
          <Para>We implement appropriate technical and organizational measures to protect your information against unauthorized access, alteration, disclosure, or destruction. However, no internet transmission or electronic storage is 100% secure.</Para>
        </Section>

        <Section title="Changes to This Policy">
          <Para>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy in the app and updating the &quot;Last updated&quot; date above.</Para>
        </Section>

        <Section title="Contact Us">
          <Para>If you have questions about this Privacy Policy or our data practices, please contact us:</Para>
          <Para style={{ fontWeight: "600" }}>HomeWise Inc.</Para>
          <Para>Email: privacy@homewise.app</Para>
          <Para>Website: homewise.app/privacy</Para>
        </Section>
      </ScrollView>
    </Screen>
  );
}
