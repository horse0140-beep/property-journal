import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MaintenanceItem, Document, Appliance, Property } from "@/context/HomeWiseContext";

export type MilestoneId =
  | "first_property"
  | "maintenance_pro"
  | "document_master"
  | "appliance_expert"
  | "score_90"
  | "score_100";

export type Milestone = {
  id: MilestoneId;
  emoji: string;
  title: string;
  description: string;
  earned: boolean;
};

export type EngagementStats = {
  activeStreakDays: number;
  maintenanceStreakDays: number;
  completedTasksCount: number;
  milestones: Milestone[];
  earnedCount: number;
};

const ACTIVITY_KEY = "homewise_score_activity_";

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / 86400000);
}

function consecutiveDayStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;
  const unique = [...new Set(dates.map((d) => d.toISOString().slice(0, 10)))].sort();
  let streak = 1;
  let max = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1]);
    const curr = new Date(unique[i]);
    if (daysBetween(prev, curr) === 1) {
      streak++;
      max = Math.max(max, streak);
    } else {
      streak = 1;
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const last = unique[unique.length - 1];
  const daysSinceLast = daysBetween(new Date(last), new Date(today));
  if (daysSinceLast > 1) return 0;
  return max;
}

export async function recordScoreActivity(propertyId: string): Promise<void> {
  const key = `${ACTIVITY_KEY}${propertyId}`;
  const raw = await AsyncStorage.getItem(key);
  const dates: string[] = raw ? JSON.parse(raw) : [];
  const today = new Date().toISOString().slice(0, 10);
  if (dates[dates.length - 1] !== today) {
    dates.push(today);
    await AsyncStorage.setItem(key, JSON.stringify(dates.slice(-90)));
  }
}

async function getActivityStreak(propertyId: string): Promise<number> {
  const raw = await AsyncStorage.getItem(`${ACTIVITY_KEY}${propertyId}`);
  if (!raw) return 0;
  const dates = (JSON.parse(raw) as string[]).map((d) => new Date(d));
  return consecutiveDayStreak(dates);
}

function maintenanceActivityDates(items: MaintenanceItem[]): Date[] {
  return items
    .filter((m) => m.status === "Completed" && m.lastCompleted)
    .map((m) => parseDate(m.lastCompleted))
    .filter((d): d is Date => d !== null);
}

export function computeMilestones(params: {
  properties: Property[];
  maintenance: MaintenanceItem[];
  documents: Document[];
  appliances: Appliance[];
  overallScore: number;
}): Milestone[] {
  const completed = params.maintenance.filter((m) => m.status === "Completed").length;

  const defs: Omit<Milestone, "earned">[] = [
    { id: "first_property", emoji: "🏡", title: "First Property", description: "Added your first home to Property Journal." },
    { id: "maintenance_pro", emoji: "🛠", title: "Maintenance Pro", description: "Completed 10+ maintenance tasks." },
    { id: "document_master", emoji: "📄", title: "Document Master", description: "Uploaded 10+ documents to Vault." },
    { id: "appliance_expert", emoji: "🔧", title: "Appliance Expert", description: "Logged 5+ property appliances." },
    { id: "score_90", emoji: "⭐", title: "Home Health 90+", description: "Reached a Home Health Score of 90 or higher." },
    { id: "score_100", emoji: "💯", title: "Perfect Home Health", description: "Achieved a perfect Home Health Score." },
  ];

  const earnedMap: Record<MilestoneId, boolean> = {
    first_property: params.properties.length >= 1,
    maintenance_pro: completed >= 10,
    document_master: params.documents.length >= 10,
    appliance_expert: params.appliances.length >= 5,
    score_90: params.overallScore >= 90,
    score_100: params.overallScore >= 100,
  };

  return defs.map((d) => ({ ...d, earned: earnedMap[d.id] }));
}

export async function getEngagementStats(params: {
  propertyId: string;
  properties: Property[];
  maintenance: MaintenanceItem[];
  documents: Document[];
  appliances: Appliance[];
  overallScore: number;
}): Promise<EngagementStats> {
  const [activeStreakDays, maintenanceStreakDays] = await Promise.all([
    getActivityStreak(params.propertyId),
    Promise.resolve(consecutiveDayStreak(maintenanceActivityDates(params.maintenance))),
  ]);

  const completedTasksCount = params.maintenance.filter((m) => m.status === "Completed").length;
  const milestones = computeMilestones(params);

  return {
    activeStreakDays,
    maintenanceStreakDays,
    completedTasksCount,
    milestones,
    earnedCount: milestones.filter((m) => m.earned).length,
  };
}
