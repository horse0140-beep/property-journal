import { Stack } from "expo-router";

/**
 * Properties tab stack: list + property detail.
 * Keeps the bottom tab bar visible on Property Detail.
 */
export default function PropertiesTabStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
