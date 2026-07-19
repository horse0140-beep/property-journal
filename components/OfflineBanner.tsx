import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useOffline } from "@/context/OfflineContext";
import { colors } from "@/constants/theme";

export function OfflineBanner() {
  const { isOffline } = useOffline();
  if (!isOffline) return null;

  return (
    <View
      style={{
        backgroundColor: "#FEF3C7",
        borderBottomWidth: 1,
        borderBottomColor: "#F59E0B",
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={18} color="#B45309" style={{ marginTop: 1 }} />
      <Text style={{ color: "#92400E", fontSize: 13, fontWeight: "600", flex: 1, lineHeight: 18 }}>
        {"You're offline. Saved information is available, but changes require an internet connection."}
      </Text>
    </View>
  );
}
