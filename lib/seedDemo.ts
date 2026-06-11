import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_STORE_KEY = "HOMEWISE_USERS_V1";
const DEMO_SEEDED_KEY = "HOMEWISE_DEMO_SEEDED_V1";

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) - hash) + password.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

export async function seedDemoAccount() {
  const seeded = await AsyncStorage.getItem(DEMO_SEEDED_KEY);
  if (seeded) return;

  const raw = await AsyncStorage.getItem(USER_STORE_KEY);
  const store: Record<string, any> = raw ? JSON.parse(raw) : {};

  if (!store["demo@homewise.app"]) {
    store["demo@homewise.app"] = {
      hash: hashPassword("demo1234"),
      profile: {
        id: "demo_user",
        email: "demo@homewise.app",
        name: "Demo User",
        phone: "",
        plan: "premium",
        createdAt: new Date().toISOString(),
        notificationsEnabled: true,
        maintenanceReminders: true,
        warrantyAlerts: true,
        emailDigest: false,
      },
    };
    await AsyncStorage.setItem(USER_STORE_KEY, JSON.stringify(store));
  }

  // Mark the demo account as already onboarded
  await AsyncStorage.setItem("HOMEWISE_ONBOARDED_V1", "1");
  await AsyncStorage.setItem(DEMO_SEEDED_KEY, "1");
}
