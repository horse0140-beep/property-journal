import { Pressable, Text } from "react-native";
import { Card } from "@/components/Card";
import { styles } from "@/constants/theme";
import type { Contractor } from "@/data/demoData";
import { contractorEmail, contractorPhone, logContractorCardTap } from "@/lib/contractorUtils";

type ContractorCardProps = {
  contractor: Contractor;
  onPress: (contractor: Contractor) => void;
};

export function ContractorCard({ contractor, onPress }: ContractorCardProps) {
  const phone = contractorPhone(contractor);
  const email = contractorEmail(contractor);

  function handlePress() {
    logContractorCardTap(contractor);
    onPress(contractor);
  }

  return (
    <Pressable onPress={handlePress} accessibilityRole="button">
      <Card style={{ marginBottom: 10 }}>
        <Text style={styles.cardTitle}>{contractor.name}</Text>
        <Text style={styles.muted}>{contractor.trade || "General"}</Text>
        {phone ? <Text style={[styles.muted, { marginTop: 2 }]}>{phone}</Text> : null}
        {email ? <Text style={[styles.muted, { marginTop: 2 }]}>{email}</Text> : null}
      </Card>
    </Pressable>
  );
}
