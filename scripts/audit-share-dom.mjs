import { chromium, devices } from "playwright";

const url =
  process.env.SHARE_URL ||
  "https://property-journal.vercel.app/share/test-invalid-token";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...devices["Pixel 7"],
  viewport: { width: 412, height: 915 },
});
const page = await context.newPage();
page.on("console", (msg) => {
  const t = msg.text();
  if (/FORENSICS|PUBLIC FLOW|STEP|Eruda/.test(t)) {
    console.log("CONSOLE:", t.slice(0, 240));
  }
});

await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(5000);

const report = await page.evaluate(() => {
  function styleDump(el) {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      id: el.id || undefined,
      childElementCount: el.childElementCount,
      textPreview: (el.innerText || "").replace(/\s+/g, " ").slice(0, 160),
      rect: {
        w: Math.round(r.width),
        h: Math.round(r.height),
        top: Math.round(r.top),
      },
      style: {
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
        overflow: cs.overflow,
        overflowY: cs.overflowY,
        position: cs.position,
        height: cs.height,
        minHeight: cs.minHeight,
        flexGrow: cs.flexGrow,
        backgroundColor: cs.backgroundColor,
        pointerEvents: cs.pointerEvents,
        zIndex: cs.zIndex,
      },
    };
  }

  const root = document.getElementById("root");
  const chain = [];
  let el = root;
  for (let i = 0; i < 16 && el; i++) {
    chain.push(styleDump(el));
    el = el.firstElementChild;
  }

  // Find zero-height parents that still have text descendants
  const zeroParents = [];
  const walk = (node, depth) => {
    if (!node || depth > 20) return;
    if (node.nodeType === 1) {
      const r = node.getBoundingClientRect();
      const text = (node.innerText || "").trim();
      if (r.height < 2 && text.length > 0) {
        zeroParents.push({
          tag: node.tagName,
          depth,
          text: text.slice(0, 80),
          className: String(node.className || "").slice(0, 60),
        });
      }
      for (const c of node.children) walk(c, depth + 1);
    }
  };
  walk(root, 0);

  return {
    htmlClass: document.documentElement.className,
    unlock: document.getElementById("pj-share-unlock")?.textContent || null,
    html: styleDump(document.documentElement),
    body: styleDump(document.body),
    chain,
    zeroParents: zeroParents.slice(0, 12),
    textLen: (document.body.innerText || "").length,
    text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 500),
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
