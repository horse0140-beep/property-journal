import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { colors } from "@/constants/theme";
import { tabBarHeight, TAB_BAR_MIN_BOTTOM_INSET } from "@/constants/layout";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const barHeight = tabBarHeight(insets.bottom);
  const showLabels = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: showLabels,
        tabBarLabelStyle: showLabels
          ? {
              fontSize: 10,
              fontWeight: "700",
              marginTop: 2,
              marginBottom: 2,
            }
          : undefined,
        tabBarIconStyle: {
          marginTop: showLabels ? 4 : 8,
        },
        tabBarItemStyle: Platform.OS === "android"
          ? { paddingVertical: 6, minWidth: 0 }
          : undefined,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: barHeight,
          paddingTop: Platform.OS === "android" ? 8 : 6,
          paddingBottom: Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM_INSET),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="properties"
        options={{
          title: "Properties",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="maintenance"
        options={{
          title: "Maintain",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="appliances"
        options={{
          title: "Appliances",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="hardware-chip-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="vault"
        options={{
          title: "Vault",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-open-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
