import { Stack } from "expo-router";

export default function ShareLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[token]" options={{ animation: "fade" }} />
    </Stack>
  );
}
