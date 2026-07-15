import AsyncStorage from "@react-native-async-storage/async-storage";

export type ScoreSnapshot = {
  date: string;
  overall: number;
  categories: Record<string, number>;
};

export type ScoreHistoryPeriod = "30d" | "6m" | "1y" | "lifetime";

const STORAGE_PREFIX = "homewise_score_history_";
const CELEBRATION_PREFIX = "homewise_score_last_seen_";

function storageKey(propertyId: string) {
  return `${STORAGE_PREFIX}${propertyId}`;
}

function celebrationKey(propertyId: string) {
  return `${CELEBRATION_PREFIX}${propertyId}`;
}

export async function recordScoreSnapshot(
  propertyId: string,
  overall: number,
  categories: Record<string, number>
): Promise<void> {
  const key = storageKey(propertyId);
  const raw = await AsyncStorage.getItem(key);
  const history: ScoreSnapshot[] = raw ? JSON.parse(raw) : [];
  const today = new Date().toISOString().slice(0, 10);
  const last = history[history.length - 1];

  if (last && last.date === today && last.overall === overall) return;

  history.push({ date: new Date().toISOString(), overall, categories });
  const trimmed = history.slice(-400);
  await AsyncStorage.setItem(key, JSON.stringify(trimmed));
}

export async function getScoreHistory(
  propertyId: string,
  period: ScoreHistoryPeriod = "lifetime"
): Promise<ScoreSnapshot[]> {
  const raw = await AsyncStorage.getItem(storageKey(propertyId));
  if (!raw) return [];
  const history: ScoreSnapshot[] = JSON.parse(raw);
  const now = Date.now();
  const cutoffs: Record<ScoreHistoryPeriod, number> = {
    "30d": now - 30 * 86400000,
    "6m": now - 183 * 86400000,
    "1y": now - 365 * 86400000,
    lifetime: 0,
  };
  const min = cutoffs[period];
  return history.filter((s) => new Date(s.date).getTime() >= min);
}

export function scoreTrend(history: ScoreSnapshot[]): "up" | "down" | "flat" {
  if (history.length < 2) return "flat";
  const first = history[0].overall;
  const last = history[history.length - 1].overall;
  if (last > first + 1) return "up";
  if (last < first - 1) return "down";
  return "flat";
}

export type ScoreCelebration = {
  previous: number;
  current: number;
  delta: number;
  message: string;
};

export async function checkScoreCelebration(
  propertyId: string,
  currentOverall: number
): Promise<ScoreCelebration | null> {
  const key = celebrationKey(propertyId);
  const raw = await AsyncStorage.getItem(key);
  const previous = raw ? parseInt(raw, 10) : null;

  await AsyncStorage.setItem(key, String(currentOverall));

  if (previous == null || currentOverall <= previous) return null;

  const delta = currentOverall - previous;
  return {
    previous,
    current: currentOverall,
    delta,
    message: `Great job! Your Home Health Score increased from ${previous} to ${currentOverall} (+${delta} points). Keep adding records to maintain momentum.`,
  };
}

export async function dismissCelebration(propertyId: string, overall: number): Promise<void> {
  await AsyncStorage.setItem(celebrationKey(propertyId), String(overall));
}
