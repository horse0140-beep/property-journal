/**
 * Temporary public-share forensics for mobile blank-screen diagnosis.
 * Visible HUD + console + optional remote webhook + Eruda mobile console.
 *
 * Safety rules:
 * - Activate only on /share/* (web pathname or native share route).
 * - Never log Supabase keys, emails, addresses, document URLs, or full tokens.
 * - Tokens: last 4 characters only.
 * - Remote POST is optional, fire-and-forget, and must not block UI.
 */

export type ForensicStepId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type ForensicEntry = {
  at: string;
  step: number | "FAIL" | "MODULE";
  label: string;
  detail?: string;
  stack?: string;
};

const STORAGE_KEY = "pj_share_forensics_v1";
const STEP_LABELS: Record<number, string> = {
  1: "STEP 1 Route mounted",
  2: "STEP 2 Token parsed",
  3: "STEP 3 Supabase initialized",
  4: "STEP 4 RPC started",
  5: "STEP 5 RPC returned",
  6: "STEP 6 Data normalized",
  7: "STEP 7 Header rendered",
  8: "STEP 8 Property rendered",
  9: "STEP 9 Photos rendered",
  10: "STEP 10 Page complete",
};

type Listener = (entries: ForensicEntry[]) => void;

const listeners = new Set<Listener>();
let entries: ForensicEntry[] = [];
let lastException: { message: string; stack?: string } | null = null;
let handlersInstalled = false;
let erudaStarted = false;

function nowIso() {
  return new Date().toISOString();
}

/** True only for public share URLs / routes. */
export function isShareForensicsPath(pathname?: string | null): boolean {
  if (typeof pathname === "string" && pathname.length > 0) {
    return /^\/share(\/|$)/i.test(pathname);
  }
  if (typeof window !== "undefined" && typeof window.location?.pathname === "string") {
    return /^\/share(\/|$)/i.test(window.location.pathname);
  }
  return false;
}

/** Mask share token — keep only the last 4 characters. */
export function maskShareToken(token: string | null | undefined): string {
  const t = (token ?? "").trim();
  if (!t) return "(empty)";
  if (t.length <= 4) return `…${t}`;
  return `…${t.slice(-4)} (len=${t.length})`;
}

/** Scrub tokens, emails, and common secret patterns from forensic strings. */
export function scrubForensicText(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);
  // Full /share/<token> path segments
  s = s.replace(/(\/share\/)([^/?#\s]+)/gi, (_m, p1: string, tok: string) => `${p1}${maskShareToken(tok)}`);
  // HW- style tokens appearing bare
  s = s.replace(/\b(HW-[A-Z0-9]{6,})\b/gi, (_m, tok: string) => maskShareToken(tok));
  // Emails
  s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");
  // Bearer / supabase-looking secrets
  s = s.replace(/\b(eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, "[jwt]");
  s = s.replace(/\b(sb_publishable_|sb_secret_|supabase)[^\s"']{8,}/gi, "[redacted]");
  return s;
}

/** Safe href for logs: origin + /share/…last4 (no full token, no query secrets). */
export function safeShareHref(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  try {
    const { origin, pathname, search } = window.location;
    const path = scrubForensicText(pathname);
    // Drop query/hash — may contain auth fragments on mis-routed opens.
    void search;
    return scrubForensicText(`${origin}${path}`);
  } catch {
    return null;
  }
}

function persist() {
  if (typeof sessionStorage === "undefined") return;
  if (!isShareForensicsPath()) return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ entries: entries.slice(-40), lastException })
    );
  } catch {
    // ignore quota
  }
}

function notify() {
  persist();
  const snapshot = [...entries];
  listeners.forEach((l) => {
    try {
      l(snapshot);
    } catch {
      // ignore
    }
  });
}

function push(entry: ForensicEntry) {
  const safe: ForensicEntry = {
    ...entry,
    detail: entry.detail ? scrubForensicText(entry.detail) : undefined,
    stack: entry.stack ? scrubForensicText(entry.stack) : undefined,
    label: scrubForensicText(entry.label),
  };
  entries = [...entries, safe].slice(-60);
  const line = `[SHARE FORENSICS] ${safe.label}${safe.detail ? ` · ${safe.detail}` : ""}`;
  if (safe.step === "FAIL") {
    console.error(line, safe.stack ?? "");
  } else {
    console.info(line);
  }
  // Never await — remote logging must not block render or share flow.
  postRemoteFireAndForget(safe);
  notify();
}

function postRemoteFireAndForget(entry: ForensicEntry) {
  const url = process.env.EXPO_PUBLIC_SHARE_FORENSICS_URL?.trim();
  if (!url || typeof fetch === "undefined") return;
  if (!isShareForensicsPath()) return;

  try {
    const body = JSON.stringify({
      source: "property-journal-share",
      href: safeShareHref(),
      ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
      entry,
    });
    // Prefer sendBeacon when available (non-blocking); else fetch without await.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([body], { type: "application/json" });
        const ok = navigator.sendBeacon(url, blob);
        if (ok) return;
      } catch {
        // fall through to fetch
      }
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // swallow — never surface to UI
    });
  } catch {
    // swallow
  }
}

/** Call from the first executable line of the share route module. */
export function forensicModuleLoad(file: string) {
  push({
    at: nowIso(),
    step: "MODULE",
    label: "MODULE LOAD share route file evaluating",
    detail: file,
  });
}

export function forensicStep(
  step: ForensicStepId,
  detail?: string,
  extra?: Record<string, unknown>
) {
  const label = STEP_LABELS[step] ?? `STEP ${step}`;
  if (extra && Object.keys(extra).length) {
    const safeExtra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(extra)) {
      const key = k.toLowerCase();
      if (key.includes("key") || key.includes("secret") || key.includes("password")) continue;
      if (key === "token" && typeof v === "string") {
        safeExtra.token = maskShareToken(v);
        continue;
      }
      if (key === "href" && typeof v === "string") {
        safeExtra.href = scrubForensicText(v);
        continue;
      }
      if (typeof v === "string") {
        safeExtra[k] = scrubForensicText(v);
      } else if (
        typeof v === "number" ||
        typeof v === "boolean" ||
        v === null ||
        v === undefined
      ) {
        safeExtra[k] = v;
      } else {
        safeExtra[k] = "[omitted]";
      }
    }
    console.info(`[SHARE FORENSICS] ${label} meta`, safeExtra);
  }
  push({
    at: nowIso(),
    step,
    label,
    detail: detail ? scrubForensicText(detail) : undefined,
  });
}

export function forensicFail(where: string, error: unknown, fileHint?: string) {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = scrubForensicText(err.message);
  const stack = err.stack ? scrubForensicText(err.stack) : undefined;
  lastException = { message, stack };
  push({
    at: nowIso(),
    step: "FAIL",
    label: `FAIL @ ${scrubForensicText(where)}`,
    detail: scrubForensicText(
      `${fileHint ? `${fileHint} · ` : ""}${err.name}: ${err.message}`
    ),
    stack,
  });
}

export function getForensicEntries(): ForensicEntry[] {
  return [...entries];
}

export function getLastForensicException() {
  return lastException;
}

export function subscribeForensics(listener: Listener): () => void {
  listeners.add(listener);
  listener([...entries]);
  return () => listeners.delete(listener);
}

export function missingSteps(reached: Set<number>): number[] {
  const missing: number[] = [];
  for (let i = 1; i <= 10; i++) {
    if (!reached.has(i)) missing.push(i);
  }
  return missing;
}

export function installShareForensicErrorHandlers() {
  if (handlersInstalled || typeof window === "undefined") return;
  if (!isShareForensicsPath()) return;
  handlersInstalled = true;

  window.addEventListener("error", (event) => {
    if (!isShareForensicsPath()) return;
    forensicFail(
      "window.onerror",
      event.error ?? new Error(event.message),
      `${event.filename || "unknown"}:${event.lineno || 0}:${event.colno || 0}`
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!isShareForensicsPath()) return;
    forensicFail("unhandledrejection", event.reason, "Promise rejection");
  });
}

/** Temporary Eruda — /share/* only. Never load on authenticated app pages. */
export function startShareErudaConsole() {
  if (erudaStarted || typeof document === "undefined") return;
  if (!isShareForensicsPath()) return;
  erudaStarted = true;
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/eruda";
  script.async = true;
  script.onload = () => {
    if (!isShareForensicsPath()) return;
    try {
      const w = window as unknown as { eruda?: { init: () => void } };
      w.eruda?.init();
      console.info("[SHARE FORENSICS] Eruda mobile console ready — tap the floating gear");
      push({
        at: nowIso(),
        step: "MODULE",
        label: "Eruda mobile console initialized",
        detail: "Open floating console for full stack traces",
      });
    } catch (e) {
      forensicFail("eruda.init", e, "lib/publicShareForensics.ts");
    }
  };
  script.onerror = () => {
    forensicFail(
      "eruda.load",
      new Error("Failed to load Eruda CDN script"),
      "lib/publicShareForensics.ts"
    );
  };
  document.head.appendChild(script);
}

/** Maps the first missing STEP to the exact file/component/line to inspect. */
export function diagnoseMissingStep(reached: Set<number>): {
  missingStep: number | "MODULE";
  file: string;
  component: string;
  lineHint: string;
  hypothesis: string;
} {
  const tokenModuleLoaded = entries.some(
    (e) =>
      e.step === "MODULE" &&
      typeof e.detail === "string" &&
      e.detail.includes("app/share/[token].tsx")
  );
  const shareGroupLoaded = entries.some(
    (e) =>
      e.step === "MODULE" &&
      typeof e.detail === "string" &&
      e.detail.includes("app/share/_layout.tsx")
  );
  const rootShareLoaded = entries.some(
    (e) =>
      e.step === "MODULE" &&
      typeof e.detail === "string" &&
      e.detail.includes("app/_layout.tsx")
  );

  if (!tokenModuleLoaded) {
    if (shareGroupLoaded) {
      return {
        missingStep: "MODULE",
        file: "app/share/[token].tsx",
        component: "module evaluation",
        lineHint: "forensicModuleLoad after imports",
        hypothesis:
          "ShareLayout mounted but [token].tsx never evaluated — Stack did not load the token screen (bad param / unmatched route).",
      };
    }
    if (rootShareLoaded) {
      return {
        missingStep: "MODULE",
        file: "app/share/_layout.tsx → app/share/[token].tsx",
        component: "expo-router Stack share",
        lineHint: 'RootLayout Stack.Screen name="share"',
        hypothesis:
          "Root layout saw /share and skipped AuthGate, but share route modules never loaded — SPA rewrite or router matching failure.",
      };
    }
    return {
      missingStep: "MODULE",
      file: "app/_layout.tsx",
      component: "RootLayout / unlockPublicShareScrollEarly",
      lineHint: "isPublicShareUrlSync + Stack",
      hypothesis:
        "No share MODULE markers at all — JS bundle never ran share path, or page is not this SPA (CDN/platform 404 shell).",
    };
  }
  if (!reached.has(1)) {
    return {
      missingStep: 1,
      file: "app/share/[token].tsx",
      component: "SharedPropertyScreen",
      lineHint: "export default function SharedPropertyScreen",
      hypothesis:
        "Module loaded but default export never rendered — ShareLayout/[token] Stack screen not mounted, or parent Suspense/AuthProvider blocked paint.",
    };
  }
  if (!reached.has(2)) {
    return {
      missingStep: 2,
      file: "app/share/[token].tsx",
      component: "SharedPropertyScreenInner",
      lineHint: "useEffect load pipeline · STEP 2",
      hypothesis:
        "Route rendered but load effect never ran (unmount race) or crashed before STEP 2.",
    };
  }
  if (!reached.has(3)) {
    return {
      missingStep: 3,
      file: "app/share/[token].tsx + lib/supabase.ts",
      component: "SharedPropertyScreenInner.run",
      lineHint: "STEP 3 supabase.auth.getSession",
      hypothesis: "Token parsed but Supabase client probe never completed.",
    };
  }
  if (!reached.has(4)) {
    return {
      missingStep: 4,
      file: "app/share/[token].tsx",
      component: "SharedPropertyScreenInner.run",
      lineHint: "STEP 4 get_share_by_token starting",
      hypothesis: "Stopped after Supabase init — before RPC call.",
    };
  }
  if (!reached.has(5)) {
    return {
      missingStep: 5,
      file: "services/sharingService.ts",
      component: "fetchPropertyShareByToken",
      lineHint: 'supabase.rpc("get_share_by_token", { p_token })',
      hypothesis:
        "RPC never returned (network hang, CORS, or timeout) — check FAIL @ RPC timeout / Eruda Network.",
    };
  }
  if (!reached.has(6)) {
    return {
      missingStep: 6,
      file: "app/share/[token].tsx",
      component: "asSnapshot / normalization",
      lineHint: "STEP 6 snap = asSnapshot(result.snapshot_json)",
      hypothesis: "RPC returned but normalization crashed — see FAIL @ normalization stack.",
    };
  }
  if (!reached.has(7)) {
    return {
      missingStep: 7,
      file: "app/share/[token].tsx",
      component: "SharedPropertyScreenInner success JSX header",
      lineHint: "/* STEP 7 header */ View + property_label",
      hypothesis:
        "Data ready but header never painted — stuck in loading/error branch or paint effect blocked.",
    };
  }
  if (!reached.has(8)) {
    return {
      missingStep: 8,
      file: "app/share/[token].tsx",
      component: "Property Overview card",
      lineHint: "/* STEP 8 property */ View cardTitle Property Overview",
      hypothesis: "Header painted but property block never committed.",
    };
  }
  if (!reached.has(9)) {
    return {
      missingStep: 9,
      file: "app/share/[token].tsx",
      component: "STEP 9 photos skip marker",
      lineHint: "forensicStep(9, skipped — no photo section)",
      hypothesis:
        "Unexpected — photos are not rendered on this page; if STEP 8 hit and 9 missing, paint effect aborted.",
    };
  }
  if (!reached.has(10)) {
    return {
      missingStep: 10,
      file: "app/share/[token].tsx",
      component: "SharedPropertyScreenInner paint effect",
      lineHint: "forensicStep(10, page complete)",
      hypothesis: "UI painted but completion marker never set — rAF cancelled on unmount.",
    };
  }
  return {
    missingStep: 10,
    file: "—",
    component: "—",
    lineHint: "all STEPs reached",
    hypothesis: "Trail complete through STEP 10.",
  };
}

export function formatForensicReport(): string {
  const reached = new Set(
    entries.filter((e) => typeof e.step === "number").map((e) => e.step as number)
  );
  const diag = diagnoseMissingStep(reached);
  const lines = entries.map(
    (e) =>
      `${e.at} | ${e.label}${e.detail ? ` | ${e.detail}` : ""}${
        e.stack ? `\n${e.stack}` : ""
      }`
  );
  lines.unshift(
    `DIAGNOSIS: missing=${String(diag.missingStep)} | ${diag.file} | ${diag.component} | ${diag.lineHint}\n${diag.hypothesis}`
  );
  if (lastException) {
    lines.push(`LAST EXCEPTION: ${lastException.message}\n${lastException.stack ?? ""}`);
  }
  return scrubForensicText(lines.join("\n\n"));
}
