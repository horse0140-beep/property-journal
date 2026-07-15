import { Pressable, Text } from "react-native";
import { Card } from "@/components/Card";
import { styles } from "@/constants/theme";
import type { Document } from "@/data/demoData";
import { documentUrlStatus, logDocumentCardTap, resolveDocumentUrl } from "@/lib/documentUtils";
import { formatDateForDisplay } from "@/lib/dateForDatabase";

type DocumentCardProps = {
  document: Document;
  onPress: (document: Document) => void;
};

export function DocumentCard({ document: doc, onPress }: DocumentCardProps) {
  const fileStatus = documentUrlStatus(resolveDocumentUrl(doc));

  function handlePress() {
    logDocumentCardTap(doc);
    onPress(doc);
  }

  return (
    <Pressable onPress={handlePress} accessibilityRole="button">
      <Card style={{ marginBottom: 10 }}>
        <Text style={styles.cardTitle}>{doc.title}</Text>
        <Text style={styles.muted}>
          {doc.category} · {doc.fileType.toUpperCase()} · {formatDateForDisplay(doc.uploadDate)}
        </Text>
        {doc.fileSize ? <Text style={[styles.muted, { marginTop: 2 }]}>{doc.fileSize}</Text> : null}
        <Text style={[styles.muted, { marginTop: 4, fontSize: 12 }]}>{fileStatus}</Text>
      </Card>
    </Pressable>
  );
}
