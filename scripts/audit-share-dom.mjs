/**
 * Visual verification for public share pages (Pixel viewport).
 * Usage:
 *   SHARE_URL=https://…/share/<token> node scripts/audit-share-dom.mjs
 *   SHARE_EXPECT=invalid|valid|any node scripts/audit-share-dom.mjs
 */
import { chromium, devices } from "playwright";

const url =
  process.env.SHARE_URL ||
  "https://property-journal.vercel.app/share/test-invalid-token";
const expectMode = (process.env.SHARE_EXPECT || "any").toLowerCase();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...devices["Pixel 7"],
  viewport: { width: 412, height: 915 },
  userAgent:
    process.env.SHARE_UA ||
    devices["Pixel 7"].userAgent,
});
const page = await context.newPage();
page.on("console", (msg) => {
  const t = msg.text();
  if (/FORENSICS|PUBLIC FLOW|STEP|Eruda/.test(t)) {
    console.log("CONSOLE:", t.slice(0, 240));
  }
});

await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(4500);

async function capture(label) {
  return page.evaluate((labelInner) => {
    function styleDump(el) {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        id: el.id || undefined,
        childElementCount: el.childElementCount,
        textPreview: (el.innerText || "").replace(/\s+/g, " ").slice(0, 180),
        rect: {
          w: Math.round(r.width),
          h: Math.round(r.height),
          top: Math.round(r.top),
        },
        style: {
          display: cs.display,
          height: cs.height,
          minHeight: cs.minHeight,
          overflow: cs.overflow,
          backgroundColor: cs.backgroundColor,
        },
      };
    }
    const root = document.getElementById("root");
    const first = root?.firstElementChild || null;
    const text = (document.body.innerText || "").replace(/\s+/g, " ");
    return {
      label: labelInner,
      unlock: document.getElementById("pj-share-unlock")?.textContent || null,
      root: styleDump(root),
      firstChild: styleDump(first),
      textLen: text.length,
      text: text.slice(0, 500),
      hasRedSmoke: /PUBLIC SHARE WORKS/.test(text),
      hasInvalid: /invalid, expired, or no longer active/i.test(text),
      hasForensicsHud: /SHARE FORENSICS|Copy forensic report/i.test(text),
      hasHomeHealthScore: /Home Health Score/i.test(text),
      hasPropertyUi:
        /Property Overview|Property Details|Read-only Share|Shared via Property Journal|Summary/i.test(
          text
        ),
      hasLoading: /Loading shared property/i.test(text),
      startsWithPropertyChrome:
        /Read-only Share/i.test(text) &&
        /Property Details|Summary/i.test(text) &&
        !/SHARE FORENSICS|Home Health Score/i.test(text),
    };
  }, label);
}

const first = await capture("initial");
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(4500);
const afterRefresh = await capture("after-refresh");

const report = { url, expectMode, first, afterRefresh };
console.log(JSON.stringify(report, null, 2));

const rootH = first.root?.rect?.h ?? 0;
const childH = first.firstChild?.rect?.h ?? 0;
const unlockOk = /display:flex!important/.test(first.unlock || "");
let ok = unlockOk && rootH > 100 && childH > 100 && !first.hasRedSmoke;

if (expectMode === "invalid") {
  ok = ok && first.hasInvalid && afterRefresh.hasInvalid && !first.hasForensicsHud;
}
if (expectMode === "valid") {
  ok =
    ok &&
    first.hasPropertyUi &&
    afterRefresh.hasPropertyUi &&
    !first.hasForensicsHud &&
    !first.hasHomeHealthScore &&
    first.startsWithPropertyChrome;
}

if (!ok) {
  console.error("VERIFY_FAIL", {
    unlockOk,
    rootH,
    childH,
    hasRedSmoke: first.hasRedSmoke,
    hasInvalid: first.hasInvalid,
    hasPropertyUi: first.hasPropertyUi,
  });
  process.exitCode = 1;
} else {
  console.log("VERIFY_OK");
}

await browser.close();
