/**
 * Mock a successful get_share_by_token and confirm read-only property UI paints
 * with non-zero #root / first-child height (Pixel viewport).
 */
import { chromium, devices } from "playwright";

const base =
  process.env.SHARE_BASE || "https://property-journal.vercel.app";
const token = "HW-MOCKVALIDTOKEN01";
const url = `${base.replace(/\/$/, "")}/share/${token}`;
const uaName = process.env.SHARE_DEVICE || "Pixel 7";

const mockRow = {
  id: "00000000-0000-4000-8000-000000000001",
  user_id: "00000000-0000-4000-8000-000000000002",
  property_id: "00000000-0000-4000-8000-000000000003",
  property_label: "Mock Share Property",
  share_token: token,
  label: "Mock read-only link",
  expires_at: null,
  is_active: true,
  views_count: 0,
  include_personal_info: false,
  snapshot_json: {
    address: "123 Test St",
    city: "Austin",
    state: "TX",
    score: { overall: 88, label: "Good" },
    maintenanceCount: 2,
    repairCount: 1,
    applianceCount: 3,
  },
  created_at: new Date().toISOString(),
};

const browser = await chromium.launch({ headless: true });
const device = devices[uaName] || devices["Pixel 7"];
const context = await browser.newContext({
  ...device,
  viewport: { width: 412, height: 915 },
});
const page = await context.newPage();

await page.route("**/rest/v1/rpc/get_share_by_token**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(mockRow),
  });
});

await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(5000);

const report = await page.evaluate(() => {
  const root = document.getElementById("root");
  const first = root?.firstElementChild;
  const text = (document.body.innerText || "").replace(/\s+/g, " ");
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { h: Math.round(b.height), w: Math.round(b.width) };
  };
  return {
    unlock: document.getElementById("pj-share-unlock")?.textContent || null,
    root: r(root),
    firstChild: r(first),
    text: text.slice(0, 400),
    hasPropertyUi: /Property Overview|Mock Share Property|Home Health Score|Read-only Share/i.test(
      text
    ),
    hasRedSmoke: /PUBLIC SHARE WORKS/.test(text),
    hasForensicsHud: /SHARE FORENSICS|Copy forensic report/i.test(text),
    hasInvalid: /invalid, expired, or no longer active/i.test(text),
  };
});

console.log(JSON.stringify({ url, uaName, report }, null, 2));

const ok =
  /display:flex!important/.test(report.unlock || "") &&
  (report.root?.h ?? 0) > 100 &&
  (report.firstChild?.h ?? 0) > 100 &&
  report.hasPropertyUi &&
  !report.hasRedSmoke &&
  !report.hasForensicsHud &&
  !report.hasInvalid;

console.log(ok ? "VERIFY_VALID_OK" : "VERIFY_VALID_FAIL");
process.exitCode = ok ? 0 : 1;
await browser.close();
