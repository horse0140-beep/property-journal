import { Stack } from "expo-router";
import { forensicModuleLoad } from "@/lib/publicShareForensics";

/**
 * Forensic: if MODULE LOAD from [token].tsx never appears but ShareLayout does,
 * the share group mounted while the token screen did not.
 */
forensicModuleLoad("app/share/_layout.tsx ShareLayout");

export default function ShareLayout() {
  console.info("[SHARE FORENSICS] ShareLayout render · app/share/_layout.tsx");

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[token]" options={{ animation: "fade" }} />
    </Stack>
  );
}
