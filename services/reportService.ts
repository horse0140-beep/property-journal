import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { loadAllUserData } from "@/services/dataService";
import { uploadReportPdf } from "@/services/storageService";
import type { PropertyScore } from "@/context/HomeWiseContext";
import type {
  Appliance,
  Contractor,
  Document,
  MaintenanceItem,
  PhotoItem,
  Property,
  Repair,
} from "@/data/demoData";

export type HomeHistoryReportData = {
  property: Property;
  score: PropertyScore;
  maintenanceItems: MaintenanceItem[];
  repairs: Repair[];
  appliances: Appliance[];
  documents: Document[];
  receipts: Document[];
  warranties: Document[];
  photos: PhotoItem[];
  contractors: Contractor[];
  ownerName: string;
};

export type SavedReport = {
  id: string;
  user_id: string;
  property_id: string;
  property_address: string;
  title: string;
  file_url: string | null;
  health_score: number;
  maintenance_count: number;
  repair_count: number;
  appliance_count: number;
  document_count: number;
  photo_count: number;
  generated_at: string;
  created_at: string;
};

export type ReportPdfResult =
  | { uri: string; html: string }
  | { error: string };

function isMissingTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("does not exist") || lower.includes("relation") || lower.includes("42p01");
}

function scoreColor(v: number) {
  if (v >= 90) return "#16A34A";
  if (v >= 80) return "#2563EB";
  if (v >= 65) return "#D97706";
  return "#DC2626";
}

function scoreLabel(v: number) {
  if (v >= 90) return "Excellent";
  if (v >= 80) return "Very Good";
  if (v >= 65) return "Good";
  return "Fair";
}

function statusColor(s: string) {
  if (s === "Overdue") return "#DC2626";
  if (s === "Due Soon") return "#D97706";
  if (s === "Completed") return "#16A34A";
  return "#2563EB";
}

function computeScoreFromData(
  propertyId: string,
  maintenanceItems: MaintenanceItem[],
  appliances: Appliance[],
  repairs: Repair[],
  documents: Document[]
): PropertyScore {
  const maintenance = maintenanceItems.filter((m) => m.propertyId === propertyId);
  const apps = appliances.filter((a) => a.propertyId === propertyId);
  const reps = repairs.filter((r) => r.propertyId === propertyId);
  const docs = documents.filter((d) => d.propertyId === propertyId);

  const overdue = maintenance.filter((m) => m.status === "Overdue").length;
  const dueSoon = maintenance.filter((m) => m.status === "Due Soon").length;
  const maintScore = Math.max(40, 100 - overdue * 12 - dueSoon * 5);

  const condMap: Record<string, number> = {
    Excellent: 100,
    Good: 85,
    Fair: 70,
    Poor: 45,
    "Replace Soon": 30,
  };
  const appScore =
    apps.length === 0
      ? 80
      : Math.round(
          apps.reduce((acc, a) => acc + (condMap[a.condition] ?? 70), 0) / apps.length
        );

  const repScore = Math.min(100, 70 + reps.length * 5);
  const warranties = docs.filter((d) => d.category === "warranty");
  const warScore = Math.min(100, 65 + warranties.length * 10);
  const inspections = docs.filter((d) => d.category === "inspection");
  const inspScore = inspections.length > 0 ? 89 : 60;

  const overall = Math.round(
    maintScore * 0.3 + appScore * 0.25 + repScore * 0.2 + warScore * 0.15 + inspScore * 0.1
  );

  const label: PropertyScore["label"] =
    overall >= 90 ? "Excellent" : overall >= 80 ? "Very Good" : overall >= 65 ? "Good" : overall >= 50 ? "Fair" : "Poor";

  return {
    overall,
    maintenance: maintScore,
    appliances: appScore,
    repairs: repScore,
    warranty: warScore,
    inspections: inspScore,
    label,
  };
}

/** Fetch all report data for a property from Supabase. */
export async function fetchPropertyReportData(
  userId: string,
  propertyId: string,
  ownerName: string
): Promise<HomeHistoryReportData | null> {
  const data = await loadAllUserData(userId);
  const property = data.properties.find((p) => p.id === propertyId);
  if (!property) return null;

  const maintenanceItems = data.maintenanceItems.filter((m) => m.propertyId === propertyId);
  const repairs = data.repairs.filter((r) => r.propertyId === propertyId);
  const appliances = data.appliances.filter((a) => a.propertyId === propertyId);
  const allDocs = data.documents.filter((d) => d.propertyId === propertyId);
  const photos = data.photos.filter((p) => p.propertyId === propertyId);
  const contractors = data.contractors.filter(
    (c) => !c.propertyId || c.propertyId === propertyId
  );

  const receipts = allDocs.filter((d) => d.category === "receipt");
  const warranties = allDocs.filter((d) => d.category === "warranty");
  const documents = allDocs.filter(
    (d) => d.category !== "receipt" && d.category !== "warranty"
  );

  const score =
    data.scoreMap[propertyId] ??
    computeScoreFromData(propertyId, maintenanceItems, appliances, repairs, allDocs);

  return {
    property,
    score,
    maintenanceItems,
    repairs,
    appliances,
    documents,
    receipts,
    warranties,
    photos,
    contractors,
    ownerName,
  };
}

/** Build report data from in-memory HomeWise context state. */
export function assembleReportData(params: {
  property: Property;
  score: PropertyScore;
  maintenanceItems: MaintenanceItem[];
  repairs: Repair[];
  appliances: Appliance[];
  documents: Document[];
  photos: PhotoItem[];
  contractors: Contractor[];
  ownerName: string;
}): HomeHistoryReportData {
  const receipts = params.documents.filter((d) => d.category === "receipt");
  const warranties = params.documents.filter((d) => d.category === "warranty");
  const documents = params.documents.filter(
    (d) => d.category !== "receipt" && d.category !== "warranty"
  );

  return {
    ...params,
    receipts,
    warranties,
    documents,
  };
}

export function buildHomeHistoryReportHtml(data: HomeHistoryReportData): string {
  const {
    property,
    score,
    maintenanceItems,
    repairs,
    appliances,
    documents,
    receipts,
    warranties,
    photos,
    contractors,
    ownerName,
  } = data;

  const totalRepairCost = repairs.reduce(
    (acc, r) => acc + parseFloat(r.cost.replace(/,/g, "") || "0"),
    0
  );

  const reportDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const certifiedBadge =
    score.overall >= 85
      ? `<div style="background:#DCFCE7;border:2px solid #16A34A;border-radius:12px;padding:16px 24px;margin:20px 0;">
          <div style="color:#16A34A;font-size:18px;font-weight:800;">HomeWise Certified™</div>
          <div style="color:#166534;font-size:13px;margin-top:4px;">Health Score ${score.overall}/100 — top tier for buyer confidence.</div>
        </div>`
      : "";

  const maintenanceRows =
    maintenanceItems.length === 0
      ? "<tr><td colspan='4' style='padding:16px;text-align:center;color:#8A9AB8;'>No maintenance records</td></tr>"
      : maintenanceItems
          .map(
            (m) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;">${escapeHtml(m.title)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#4A5568;">${escapeHtml(m.category)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#4A5568;">${escapeHtml(m.nextDue)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:${statusColor(m.status)};font-weight:700;">${escapeHtml(m.status)}</td>
        </tr>`
          )
          .join("");

  const repairRows =
    repairs.length === 0
      ? "<tr><td colspan='4' style='padding:16px;text-align:center;color:#8A9AB8;'>No repairs recorded</td></tr>"
      : repairs
          .map(
            (r) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;">${escapeHtml(r.title)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#4A5568;">${escapeHtml(r.date)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#1A3C8F;font-weight:700;">$${escapeHtml(r.cost)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#4A5568;">${escapeHtml(r.contractor)}</td>
        </tr>`
          )
          .join("");

  const applianceRows =
    appliances.length === 0
      ? "<tr><td colspan='4' style='padding:16px;text-align:center;color:#8A9AB8;'>No appliances recorded</td></tr>"
      : appliances
          .map(
            (a) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;">${escapeHtml(a.name)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#4A5568;">${escapeHtml(a.brand)} ${escapeHtml(a.model)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#4A5568;">${escapeHtml(a.installDate)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;font-weight:700;">${escapeHtml(a.condition)}</td>
        </tr>`
          )
          .join("");

  const warrantyList =
    warranties.length === 0
      ? "<p style='color:#8A9AB8;font-size:14px;'>No warranties on file.</p>"
      : warranties
          .map(
            (w) => `
        <div style="padding:10px 0;border-bottom:1px solid #EEF2FF;">
          <div style="font-weight:700;">${escapeHtml(w.title)}</div>
          <div style="color:#8A9AB8;font-size:12px;">Uploaded ${escapeHtml(w.uploadDate)}${w.expiresDate ? ` · Expires ${escapeHtml(w.expiresDate)}` : ""}</div>
        </div>`
          )
          .join("");

  const receiptList =
    receipts.length === 0
      ? "<p style='color:#8A9AB8;font-size:14px;'>No receipts on file.</p>"
      : receipts
          .map(
            (r) => `
        <div style="padding:10px 0;border-bottom:1px solid #EEF2FF;">
          <div style="font-weight:700;">${escapeHtml(r.title)}</div>
          <div style="color:#8A9AB8;font-size:12px;">${escapeHtml(r.uploadDate)} · ${escapeHtml(r.fileSize)}</div>
        </div>`
          )
          .join("");

  const documentList =
    documents.length === 0
      ? "<p style='color:#8A9AB8;font-size:14px;'>No documents on file.</p>"
      : documents
          .map(
            (d) => `
        <div style="padding:10px 0;border-bottom:1px solid #EEF2FF;display:flex;justify-content:space-between;">
          <div>
            <div style="font-weight:700;">${escapeHtml(d.title)}</div>
            <div style="color:#8A9AB8;font-size:12px;">${escapeHtml(d.uploadDate)}</div>
          </div>
          <span style="background:#EEF4FF;color:#1A3C8F;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;height:fit-content;">${escapeHtml(d.category)}</span>
        </div>`
          )
          .join("");

  const photoList =
    photos.length === 0
      ? "<p style='color:#8A9AB8;font-size:14px;'>No photos on file.</p>"
      : photos
          .map(
            (p) => `
        <div style="padding:10px 0;border-bottom:1px solid #EEF2FF;">
          <div style="font-weight:700;">${escapeHtml(p.caption || "Property photo")}</div>
          <div style="color:#8A9AB8;font-size:12px;">${escapeHtml(p.date)} · ${escapeHtml(p.category)}</div>
        </div>`
          )
          .join("");

  const maintSummary = {
    total: maintenanceItems.length,
    completed: maintenanceItems.filter((m) => m.status === "Completed").length,
    overdue: maintenanceItems.filter((m) => m.status === "Overdue").length,
    dueSoon: maintenanceItems.filter((m) => m.status === "Due Soon").length,
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,'Helvetica Neue',Arial,sans-serif; color:#0F1F3D; background:#fff; }
    .page { max-width:800px; margin:0 auto; padding:40px; }
    .header { background:linear-gradient(135deg,#0F2460,#1A3C8F); color:#fff; padding:40px; border-radius:16px; margin-bottom:32px; }
    .logo { font-size:28px; font-weight:900; }
    .logo span { color:#60A5FA; }
    .tagline { color:rgba(255,255,255,0.7); font-size:12px; margin-top:4px; }
    .property-name { font-size:30px; font-weight:900; margin-top:20px; }
    .property-sub { color:rgba(255,255,255,0.75); font-size:15px; margin-top:6px; }
    .section { margin:28px 0; }
    .section-title { font-size:18px; font-weight:800; border-bottom:2px solid #1A3C8F; padding-bottom:8px; margin-bottom:14px; }
    table { width:100%; border-collapse:collapse; }
    th { background:#F0F4FF; color:#4A5568; font-size:11px; font-weight:700; text-transform:uppercase; padding:10px 14px; text-align:left; }
    .score-ring { width:150px; height:150px; border-radius:50%; border:12px solid ${scoreColor(score.overall)}; display:flex; flex-direction:column; align-items:center; justify-content:center; margin:0 auto; }
    .score-num { font-size:48px; font-weight:900; color:${scoreColor(score.overall)}; }
    .disclaimer { background:#FEF3C7; border:1px solid #F59E0B; border-radius:12px; padding:16px; margin-top:32px; font-size:12px; color:#92400E; line-height:1.6; }
    .footer { margin-top:40px; padding-top:20px; border-top:1px solid #EEF2FF; text-align:center; color:#8A9AB8; font-size:12px; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div class="logo">HOME<span>WISE</span></div>
        <div class="tagline">The CarFax for Your House™</div>
      </div>
      <div style="text-align:right;font-size:12px;color:rgba(255,255,255,0.7);">
        <div>Generated ${reportDate}</div>
        <div style="margin-top:4px;">Prepared for ${escapeHtml(ownerName)}</div>
      </div>
    </div>
    <div class="property-name">${escapeHtml(property.address)}</div>
    <div class="property-sub">${escapeHtml(property.city)}, ${escapeHtml(property.state)} ${escapeHtml(property.zip)}</div>
    <div style="display:flex;gap:24px;margin-top:16px;flex-wrap:wrap;font-size:14px;">
      <div><span style="opacity:0.6;">Built</span> ${escapeHtml(property.yearBuilt)}</div>
      <div><span style="opacity:0.6;">Sq Ft</span> ${escapeHtml(property.squareFeet)}</div>
      <div><span style="opacity:0.6;">Beds</span> ${escapeHtml(property.bedrooms)}</div>
      <div><span style="opacity:0.6;">Baths</span> ${escapeHtml(property.bathrooms)}</div>
    </div>
  </div>

  ${certifiedBadge}

  <div class="section">
    <div class="section-title">Home Health Score™</div>
    <div class="score-ring">
      <div class="score-num">${score.overall}</div>
      <div style="color:${scoreColor(score.overall)};font-weight:800;">${score.label}</div>
    </div>
    <p style="text-align:center;color:#8A9AB8;margin-top:10px;font-size:13px;">Maintenance ${score.maintenance} · Appliances ${score.appliances} · Repairs ${score.repairs} · Warranty ${score.warranty} · Inspections ${score.inspections}</p>
  </div>

  <div class="section">
    <div class="section-title">Maintenance Summary</div>
    <p style="font-size:14px;line-height:1.7;color:#4A5568;">
      ${maintSummary.total} total tasks · ${maintSummary.completed} completed · ${maintSummary.overdue} overdue · ${maintSummary.dueSoon} due soon
    </p>
    <table style="margin-top:12px;">
      <thead><tr><th>Task</th><th>Category</th><th>Next Due</th><th>Status</th></tr></thead>
      <tbody>${maintenanceRows}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Appliance Inventory (${appliances.length})</div>
    <table>
      <thead><tr><th>Appliance</th><th>Brand / Model</th><th>Installed</th><th>Condition</th></tr></thead>
      <tbody>${applianceRows}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Repair History (${repairs.length}) — $${totalRepairCost.toLocaleString()} invested</div>
    <table>
      <thead><tr><th>Description</th><th>Date</th><th>Cost</th><th>Contractor</th></tr></thead>
      <tbody>${repairRows}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Warranty List (${warranties.length})</div>
    ${warrantyList}
  </div>

  <div class="section">
    <div class="section-title">Receipts (${receipts.length})</div>
    ${receiptList}
  </div>

  <div class="section">
    <div class="section-title">Documents (${documents.length})</div>
    ${documentList}
  </div>

  <div class="section">
    <div class="section-title">Photos (${photos.length})</div>
    ${photoList}
  </div>

  ${
    contractors.length > 0
      ? `<div class="section"><div class="section-title">Contractors Used</div>${contractors
          .map(
            (c) => `
        <div style="padding:10px 0;border-bottom:1px solid #EEF2FF;">
          <div style="font-weight:700;">${escapeHtml(c.name)}</div>
          <div style="color:#8A9AB8;font-size:12px;">${escapeHtml(c.trade)} · ${escapeHtml(c.phone)}</div>
        </div>`
          )
          .join("")}</div>`
      : ""
  }

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This Home History Report™ is for informational purposes only. All data is self-reported by the property owner through HomeWise. HomeWise does not verify the accuracy or completeness of this information. This report is not a substitute for a professional home inspection, appraisal, or title search. Buyers, lenders, and insurers should conduct their own due diligence.
  </div>

  <div class="footer">
    <p><strong>HomeWise™</strong> — The CarFax for Your House</p>
    <p style="margin-top:6px;">Generated ${reportDate} · homewise.app</p>
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function generateReportPdf(data: HomeHistoryReportData): Promise<ReportPdfResult> {
  try {
    const html = buildHomeHistoryReportHtml(data);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return { uri, html };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "PDF generation failed" };
  }
}

export async function previewReportPdf(html: string): Promise<{ error?: string }> {
  try {
    await Print.printAsync({ html });
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Preview failed" };
  }
}

export async function shareReportPdf(uri: string, filename: string): Promise<{ error?: string }> {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) return { error: "Sharing is not available on this device." };

    const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dest = `${FileSystem.cacheDirectory}${safeName}.pdf`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    await Sharing.shareAsync(dest, {
      mimeType: "application/pdf",
      dialogTitle: "Share HomeWise Report",
      UTI: "com.adobe.pdf",
    });
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Share failed" };
  }
}

export async function saveReportMetadata(
  userId: string,
  data: HomeHistoryReportData,
  fileUrl: string | null
): Promise<SavedReport | null> {
  const title = `Home History Report — ${data.property.address}`;
  const payload = {
    user_id: userId,
    property_id: data.property.id,
    property_address: data.property.address,
    title,
    file_url: fileUrl,
    health_score: data.score.overall,
    maintenance_count: data.maintenanceItems.length,
    repair_count: data.repairs.length,
    appliance_count: data.appliances.length,
    document_count: data.documents.length + data.receipts.length + data.warranties.length,
    photo_count: data.photos.length,
    generated_at: new Date().toISOString(),
  };

  const { data: row, error } = await supabase.from("reports").insert(payload).select().single();

  if (error) {
    if (isMissingTableError(error.message)) {
      console.warn("reports table missing — run migration 009_reports.sql");
      return null;
    }
    throw new Error(error.message);
  }

  return row as SavedReport;
}

export async function saveReport(
  userId: string,
  data: HomeHistoryReportData,
  localPdfUri: string
): Promise<{ saved: SavedReport | null; fileUrl: string | null; error?: string }> {
  let fileUrl: string | null = null;

  try {
    const uploaded = await uploadReportPdf(
      userId,
      localPdfUri,
      `HomeWise_Report_${data.property.address.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.pdf`
    );
    fileUrl = uploaded.url;
  } catch (e: unknown) {
    console.warn("Report PDF upload failed:", e);
  }

  try {
    const saved = await saveReportMetadata(userId, data, fileUrl);
    return { saved, fileUrl };
  } catch (e: unknown) {
    return {
      saved: null,
      fileUrl,
      error: e instanceof Error ? e.message : "Failed to save report metadata",
    };
  }
}

export async function fetchSavedReports(
  userId: string,
  propertyId?: string
): Promise<SavedReport[]> {
  let query = supabase
    .from("reports")
    .select("*")
    .eq("user_id", userId)
    .order("generated_at", { ascending: false });

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingTableError(error.message)) return [];
    throw new Error(error.message);
  }

  return (data ?? []) as SavedReport[];
}
