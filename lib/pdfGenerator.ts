import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import type { Property, MaintenanceItem, Repair, Appliance, Document, Contractor } from "@/data/demoData";
import type { PropertyScore } from "@/context/HomeWiseContext";

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

export async function generateHomeHistoryPDF(params: {
  property: Property;
  score: PropertyScore;
  maintenanceItems: MaintenanceItem[];
  repairs: Repair[];
  appliances: Appliance[];
  documents: Document[];
  contractors: Contractor[];
  ownerName: string;
}): Promise<{ uri: string } | { error: string }> {
  const { property, score, maintenanceItems, repairs, appliances, documents, contractors, ownerName } = params;

  const totalRepairCost = repairs.reduce(
    (acc, r) => acc + parseFloat(r.cost.replace(/,/g, "") || "0"), 0
  );

  const reportDate = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const certifiedBadge = score.overall >= 85
    ? `<div style="background:#DCFCE7;border:2px solid #16A34A;border-radius:12px;padding:16px 24px;margin:20px 0;display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;">✓</span>
        <div>
          <div style="color:#16A34A;font-size:18px;font-weight:800;">HomeWise Certified™</div>
          <div style="color:#166534;font-size:13px;">This property maintains a Health Score of ${score.overall}/100 — top tier for buyer confidence.</div>
        </div>
      </div>`
    : "";

  const maintenanceRows = maintenanceItems.length === 0
    ? "<tr><td colspan='4' style='text-align:center;color:#9AA7B8;padding:16px;'>No maintenance items recorded</td></tr>"
    : maintenanceItems.map((m) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;">${m.title}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#4A5568;">${m.category}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#4A5568;">${m.nextDue}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;">
            <span style="color:${statusColor(m.status)};font-weight:700;font-size:12px;">${m.status}</span>
          </td>
        </tr>`).join("");

  const repairRows = repairs.length === 0
    ? "<tr><td colspan='4' style='text-align:center;color:#9AA7B8;padding:16px;'>No repairs recorded</td></tr>"
    : repairs.map((r) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;">${r.title}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#4A5568;">${r.date}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#1A3C8F;font-weight:700;">$${r.cost}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#4A5568;">${r.contractor}</td>
        </tr>`).join("");

  const applianceRows = appliances.length === 0
    ? "<tr><td colspan='4' style='text-align:center;color:#9AA7B8;padding:16px;'>No appliances recorded</td></tr>"
    : appliances.map((a) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;">${a.name}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#4A5568;">${a.brand} ${a.model}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;color:#4A5568;">${a.installDate}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF2FF;">
            <span style="color:${scoreColor(a.condition === "Excellent" ? 95 : a.condition === "Good" ? 85 : a.condition === "Fair" ? 70 : 40)};font-weight:700;font-size:12px;">${a.condition}</span>
          </td>
        </tr>`).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #0F1F3D; background: #fff; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { background: linear-gradient(135deg, #0F2460 0%, #1A3C8F 100%); color: white; padding: 40px; border-radius: 16px; margin-bottom: 32px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .logo { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }
    .logo span { color: #60A5FA; }
    .tagline { color: rgba(255,255,255,0.7); font-size: 12px; margin-top: 4px; }
    .report-date { color: rgba(255,255,255,0.6); font-size: 12px; text-align: right; }
    .property-name { font-size: 32px; font-weight: 900; margin-top: 24px; }
    .property-sub { color: rgba(255,255,255,0.75); font-size: 15px; margin-top: 6px; }
    .prop-details { display: flex; gap: 32px; margin-top: 20px; }
    .prop-detail-item { }
    .prop-detail-label { color: rgba(255,255,255,0.5); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .prop-detail-value { color: white; font-size: 15px; font-weight: 700; margin-top: 2px; }
    .score-section { display: flex; justify-content: center; margin: 32px 0; }
    .score-ring { width: 160px; height: 160px; border-radius: 50%; border: 14px solid ${scoreColor(score.overall)}; background: ${scoreColor(score.overall)}14; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .score-num { font-size: 52px; font-weight: 900; color: ${scoreColor(score.overall)}; line-height: 1; }
    .score-lbl { font-size: 14px; font-weight: 700; color: ${scoreColor(score.overall)}; margin-top: 4px; }
    .score-sub { text-align: center; color: #8A9AB8; font-size: 13px; margin-top: 8px; }
    .breakdown { display: flex; gap: 12px; margin: 24px 0; flex-wrap: wrap; justify-content: center; }
    .breakdown-item { flex: 1; min-width: 120px; background: #F0F4FF; border-radius: 12px; padding: 14px; text-align: center; }
    .breakdown-val { font-size: 24px; font-weight: 900; }
    .breakdown-lbl-sub { font-size: 11px; font-weight: 700; margin-top: 2px; }
    .breakdown-lbl { font-size: 11px; color: #8A9AB8; margin-top: 4px; }
    .section { margin: 32px 0; }
    .section-title { font-size: 18px; font-weight: 800; color: #0F1F3D; padding-bottom: 10px; border-bottom: 2px solid #1A3C8F; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #F0F4FF; color: #4A5568; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 14px; text-align: left; }
    .stats-row { display: flex; gap: 16px; margin: 16px 0; }
    .stat-box { flex: 1; background: #F0F4FF; border-radius: 10px; padding: 16px; text-align: center; }
    .stat-box-val { font-size: 28px; font-weight: 900; color: #1A3C8F; }
    .stat-box-lbl { font-size: 12px; color: #8A9AB8; margin-top: 4px; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #EEF2FF; text-align: center; color: #8A9AB8; font-size: 12px; }
    .footer strong { color: #1A3C8F; }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <div>
        <div class="logo">HOME<span>WISE</span></div>
        <div class="tagline">The CarFax for Your House™</div>
      </div>
      <div class="report-date">
        <div style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Report Date</div>
        <div style="font-weight:700;margin-top:2px;">${reportDate}</div>
        <div style="margin-top:4px;color:rgba(255,255,255,0.5);font-size:11px;">Prepared for ${ownerName}</div>
      </div>
    </div>
    <div class="property-name">${property.address}</div>
    <div class="property-sub">${property.city}, ${property.state} ${property.zip}</div>
    <div class="prop-details">
      <div class="prop-detail-item">
        <div class="prop-detail-label">Year Built</div>
        <div class="prop-detail-value">${property.yearBuilt}</div>
      </div>
      <div class="prop-detail-item">
        <div class="prop-detail-label">Sq Ft</div>
        <div class="prop-detail-value">${property.squareFeet}</div>
      </div>
      <div class="prop-detail-item">
        <div class="prop-detail-label">Bedrooms</div>
        <div class="prop-detail-value">${property.bedrooms}</div>
      </div>
      <div class="prop-detail-item">
        <div class="prop-detail-label">Bathrooms</div>
        <div class="prop-detail-value">${property.bathrooms}</div>
      </div>
      <div class="prop-detail-item">
        <div class="prop-detail-label">Est. Value</div>
        <div class="prop-detail-value">$${property.estimatedValue}</div>
      </div>
      <div class="prop-detail-item">
        <div class="prop-detail-label">Purchased</div>
        <div class="prop-detail-value">${property.purchaseDate}</div>
      </div>
    </div>
  </div>

  <!-- Certified badge -->
  ${certifiedBadge}

  <!-- Health Score -->
  <div class="section">
    <div class="section-title">Home Health Score™</div>
    <div class="score-section">
      <div>
        <div class="score-ring">
          <div class="score-num">${score.overall}</div>
          <div class="score-lbl">${score.label}</div>
        </div>
        <div class="score-sub">Out of 100</div>
      </div>
    </div>
    <div class="breakdown">
      ${[
        { label: "Maintenance", val: score.maintenance },
        { label: "Appliances",  val: score.appliances },
        { label: "Repairs",     val: score.repairs },
        { label: "Warranty",    val: score.warranty },
        { label: "Inspections", val: score.inspections },
      ].map((b) => `
        <div class="breakdown-item">
          <div class="breakdown-val" style="color:${scoreColor(b.val)}">${b.val}</div>
          <div class="breakdown-lbl-sub" style="color:${scoreColor(b.val)}">${scoreLabel(b.val)}</div>
          <div class="breakdown-lbl">${b.label}</div>
        </div>`).join("")}
    </div>
  </div>

  <!-- Summary stats -->
  <div class="stats-row">
    <div class="stat-box">
      <div class="stat-box-val">${maintenanceItems.length}</div>
      <div class="stat-box-lbl">Maintenance Items</div>
    </div>
    <div class="stat-box">
      <div class="stat-box-val">${repairs.length}</div>
      <div class="stat-box-lbl">Repairs Logged</div>
    </div>
    <div class="stat-box">
      <div class="stat-box-val">$${totalRepairCost.toLocaleString()}</div>
      <div class="stat-box-lbl">Total Invested</div>
    </div>
    <div class="stat-box">
      <div class="stat-box-val">${appliances.length}</div>
      <div class="stat-box-lbl">Appliances Tracked</div>
    </div>
    <div class="stat-box">
      <div class="stat-box-val">${documents.length}</div>
      <div class="stat-box-lbl">Documents on File</div>
    </div>
  </div>

  <!-- Maintenance -->
  <div class="section">
    <div class="section-title">Maintenance History</div>
    <table>
      <thead><tr>
        <th>Task</th><th>Category</th><th>Next Due</th><th>Status</th>
      </tr></thead>
      <tbody>${maintenanceRows}</tbody>
    </table>
  </div>

  <!-- Repairs -->
  <div class="section">
    <div class="section-title">Repairs & Upgrades</div>
    <table>
      <thead><tr>
        <th>Description</th><th>Date</th><th>Cost</th><th>Contractor</th>
      </tr></thead>
      <tbody>${repairRows}</tbody>
    </table>
  </div>

  <!-- Appliances -->
  <div class="section">
    <div class="section-title">Appliance Inventory</div>
    <table>
      <thead><tr>
        <th>Appliance</th><th>Brand / Model</th><th>Installed</th><th>Condition</th>
      </tr></thead>
      <tbody>${applianceRows}</tbody>
    </table>
  </div>

  <!-- Documents on file -->
  <div class="section">
    <div class="section-title">Documents on File (${documents.length})</div>
    ${documents.length === 0
      ? '<p style="color:#8A9AB8;font-size:14px;">No documents recorded.</p>'
      : documents.map((d) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #EEF2FF;">
            <div>
              <div style="font-weight:700;font-size:14px;">${d.title}</div>
              <div style="color:#8A9AB8;font-size:12px;">${d.uploadDate}${d.expiresDate ? ` · Expires: ${d.expiresDate}` : ""}</div>
            </div>
            <span style="background:#EEF4FF;color:#1A3C8F;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;">${d.category}</span>
          </div>`).join("")}
  </div>

  <!-- Contractors -->
  ${contractors.length > 0 ? `
  <div class="section">
    <div class="section-title">Contractors Used</div>
    ${contractors.map((c) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #EEF2FF;">
        <div>
          <div style="font-weight:700;font-size:14px;">${c.name}</div>
          <div style="color:#8A9AB8;font-size:12px;">${c.trade} · ${c.phone}</div>
        </div>
        <div style="color:#F59E0B;font-size:14px;">${"★".repeat(c.rating)}</div>
      </div>`).join("")}
  </div>` : ""}

  <!-- Footer -->
  <div class="footer">
    <p><strong>HomeWise™</strong> — The CarFax for Your House</p>
    <p style="margin-top:6px;">This report was generated on ${reportDate} and reflects data entered by the homeowner.</p>
    <p style="margin-top:4px;">© 2026 HomeWise Inc. · homewise.app</p>
  </div>

</div>
</body>
</html>`;

  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return { uri };
  } catch (e: any) {
    return { error: e.message ?? "PDF generation failed" };
  }
}

export async function sharePDF(uri: string, filename: string) {
  const available = await Sharing.isAvailableAsync();
  if (!available) return;

  // Copy to a nicely-named file
  const dest = `${FileSystem.cacheDirectory}${filename}.pdf`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  await Sharing.shareAsync(dest, {
    mimeType: "application/pdf",
    dialogTitle: "Share HomeWise Report",
    UTI: "com.adobe.pdf",
  });
}
