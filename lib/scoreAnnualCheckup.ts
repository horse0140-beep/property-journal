import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import type { EnrichedRecommendation } from "@/lib/scoreMeta";

export type CheckupItem = {
  id: string;
  label: string;
  description: string;
  route: string;
  params?: Record<string, string>;
};

export const ANNUAL_CHECKUP_ITEMS: CheckupItem[] = [
  { id: "appliances", label: "Verify appliances", description: "Confirm serial numbers, warranties, and condition.", route: "/(tabs)/maintenance", params: { tab: "appliances" } },
  { id: "insurance", label: "Update insurance documents", description: "Upload current homeowners policy to Vault.", route: "/(tabs)/vault", params: { tab: "insurance" } },
  { id: "warranties", label: "Review warranties", description: "Check expiration dates on major systems.", route: "/(tabs)/vault", params: { tab: "warranty" } },
  { id: "contractors", label: "Update contractor contacts", description: "Verify phone numbers and preferred trades.", route: "/(tabs)/maintenance", params: { tab: "contractors" } },
  { id: "emergency", label: "Check emergency info", description: "Confirm shut-off locations and emergency numbers.", route: "/(tabs)/vault" },
  { id: "schedule", label: "Review maintenance schedule", description: "Update recurring tasks for the year ahead.", route: "/(tabs)/maintenance", params: { tab: "schedule" } },
];

const CHECKUP_KEY = "homewise_annual_checkup_";

export async function getCheckupProgress(propertyId: string): Promise<Record<string, boolean>> {
  const raw = await AsyncStorage.getItem(`${CHECKUP_KEY}${propertyId}`);
  return raw ? JSON.parse(raw) : {};
}

export async function setCheckupItemDone(propertyId: string, itemId: string, done: boolean): Promise<void> {
  const progress = await getCheckupProgress(propertyId);
  progress[itemId] = done;
  await AsyncStorage.setItem(`${CHECKUP_KEY}${propertyId}`, JSON.stringify(progress));
}

export async function getLastCheckupYear(propertyId: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(`${CHECKUP_KEY}${propertyId}_year`);
  return raw ? parseInt(raw, 10) : null;
}

export async function markCheckupComplete(propertyId: string): Promise<void> {
  await AsyncStorage.setItem(`${CHECKUP_KEY}${propertyId}_year`, String(new Date().getFullYear()));
}

export function shouldPromptAnnualCheckup(lastYear: number | null): boolean {
  const currentYear = new Date().getFullYear();
  if (lastYear == null) return true;
  return lastYear < currentYear;
}

export function checkupCompletionPercent(progress: Record<string, boolean>): number {
  const total = ANNUAL_CHECKUP_ITEMS.length;
  const done = ANNUAL_CHECKUP_ITEMS.filter((i) => progress[i.id]).length;
  return Math.round((done / total) * 100);
}

export function buildAnnualReportSummary(params: {
  address: string;
  overallScore: number;
  completionPercent: number;
  checkupPercent: number;
  topRecommendations: EnrichedRecommendation[];
}): string {
  const recs = params.topRecommendations
    .slice(0, 5)
    .map((r) => `• ${r.label} (+${r.points} pts)`)
    .join("\n");

  return `Property Journal Annual Home Health Report
${params.address}

Overall Score: ${params.overallScore}/100
Home Health Completion: ${params.completionPercent}%
Annual Checkup: ${params.checkupPercent}% complete

Priority recommendations:
${recs || "None — great work!"}

Generated ${new Date().toLocaleDateString()}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildAnnualReportHtml(params: {
  address: string;
  overallScore: number;
  completionPercent: number;
  checkupPercent: number;
  recommendations: EnrichedRecommendation[];
}): string {
  const recRows = params.recommendations
    .slice(0, 8)
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}</td><td>+${r.points}</td><td>${escapeHtml(r.priority)}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
body{font-family:-apple-system,sans-serif;padding:32px;color:#0F1F3D}
h1{color:#1A3C8F;font-size:22px}
.stat{display:inline-block;margin:8px 16px 8px 0}
.stat b{font-size:28px;color:#1A3C8F}
table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{border:1px solid #DDE3F0;padding:8px;font-size:13px;text-align:left}
th{background:#EEF2FF}
</style></head><body>
<h1>Property Journal Annual Home Health Report</h1>
<p><strong>${escapeHtml(params.address)}</strong></p>
<div class="stat"><b>${params.overallScore}</b><br/>Health Score</div>
<div class="stat"><b>${params.completionPercent}%</b><br/>Completion</div>
<div class="stat"><b>${params.checkupPercent}%</b><br/>Annual Checkup</div>
<h2>Priority Recommendations</h2>
<table><tr><th>Action</th><th>Points</th><th>Priority</th></tr>
${recRows || "<tr><td colspan='3'>All caught up.</td></tr>"}
</table>
<p style="color:#8A9AB8;font-size:11px;margin-top:32px">Generated by Property Journal · ${new Date().toLocaleDateString()}</p>
</body></html>`;
}

export async function generateAnnualReportPdf(params: {
  address: string;
  overallScore: number;
  completionPercent: number;
  checkupPercent: number;
  recommendations: EnrichedRecommendation[];
}): Promise<{ uri?: string; error?: string }> {
  try {
    const html = buildAnnualReportHtml(params);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return { uri };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "PDF generation failed" };
  }
}

export async function shareAnnualReportPdf(uri: string, address: string): Promise<{ error?: string }> {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) return { error: "Sharing is not available on this device." };
    const safe = address.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    const dest = `${FileSystem.cacheDirectory}PropertyJournal_Annual_${safe}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    await Sharing.shareAsync(dest, {
      mimeType: "application/pdf",
      dialogTitle: "Share Annual Home Health Report",
    });
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Share failed" };
  }
}
