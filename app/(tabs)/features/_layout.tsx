import { Stack } from "expo-router";

export default function FeaturesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="sharing" />
      <Stack.Screen name="contractor-portal" />
      <Stack.Screen name="buyer-reports" />
      <Stack.Screen name="forecast" />
      <Stack.Screen name="billing" />
      <Stack.Screen name="upgrade" />
      <Stack.Screen name="landlord-dashboard" />
      <Stack.Screen name="realtor-tools" />
    </Stack>
  );
}
