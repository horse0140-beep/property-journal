/**
 * Optional public-share debug helpers.
 * Production: all logging / Eruda / remote posts are OFF unless explicitly enabled.
 *
 * Enable console trail: EXPO_PUBLIC_DEBUG_SHARE=1 (or __DEV__)
 * Enable Eruda gear:    EXPO_PUBLIC_DEBUG_SHARE_ERUDA=1 (also requires DEBUG_SHARE or __DEV__)
 * Optional webhook:     EXPO_PUBLIC_SHARE_FORENSICS_URL (only when DEBUG_SHARE is on)
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

function envFlag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Console / trail enabled in __DEV__ or when EXPO_PUBLIC_DEBUG_SHARE is set. */
export function isShareDebugEnabled(): boolean {
  if (typeof __DEV__ !== "undefined" && __DEV__) return true;
  return envFlag("EXPO_PUBLIC_DEBUG_SHARE");
}

/** Eruda only when explicitly requested (never on by default in production). */
export function isShareErudaEnabled(): boolean {
  return isShareDebugEnabled() && envFlag("EXPO_PUBLIC_DEBUG_SHARE_ERUDA");
}

function nowIso() {
  return new Date().toISOString();
}

export function isShareForensicsPath(pathname?: string | null): boolean {
  if (typeof pathname === "string" && pathname.length > 0) {
    return /^\/share(\/|$)/i.test(pathname);
  }
  if (typeof window !== "undefined" && typeof window.location?.pathname === "string") {
    return /^\/share(\/|$)/i.test(window.location.pathname);
  }
  return false;
}

export function maskShareToken(token: string | null | undefined): string {
  const t = (token ?? "").trim();
  if (!t) return "(empty)";
  if (t.length <= 4) return `…${t}`;
  return `…${t.slice(-4)} (len=${t.length})`;
}

export function scrubForensicText(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);
  s = s.replace(/(\/share\/)([^/?#\s]+)/gi, (_m, p1: string, tok: string) => `${p1}${maskShareToken(tok)}`);
  s = s.replace(/\b(HW-[A-Z0-9]{6,})\b/gi, (_m, tok: string) => maskShareToken(tok));
  s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");
  s = s.replace(/\b(eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, "[jwt]");
  s = s.replace(/\b(sb_publishable_|sb_secret_|supabase)[^\s"']{8,}/gi, "[redacted]");
  return s;
}

export function safeShareHref(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  try {
    const { origin, pathname } = window.location;
    return scrubForensicText(`${origin}${pathname}`);
  } catch {
    return null;
  }
}

function persist() {
  if (!isShareDebugEnabled() || typeof sessionStorage === "undefined") return;
  if (!isShareForensicsPath()) return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ entries: entries.slice(-40), lastException })
    );
  } catch {
    // ignore
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
  if (!isShareDebugEnabled()) return;
  const safe: ForensicEntry = {
    ...entry,
    detail: entry.detail ? scrubForensicText(entry.detail) : undefined,
    stack: entry.stack ? scrubForensicText(entry.stack) : undefined,
    label: scrubForensicText(entry.label),
  };
  entries = [...entries, safe].slice(-60);
  const line = `[SHARE DEBUG] ${safe.label}${safe.detail ? ` · ${safe.detail}` : ""}`;
  if (safe.step === "FAIL") {
    console.error(line, safe.stack ?? "");
  } else {
    console.info(line);
  }
  postRemoteFireAndForget(safe);
  notify();
}

function postRemoteFireAndForget(entry: ForensicEntry) {
  if (!isShareDebugEnabled()) return;
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
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(url, blob)) return;
      } catch {
        // fall through
      }
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // swallow
  }
}

export function forensicModuleLoad(file: string) {
  if (!isShareDebugEnabled()) return;
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
  if (!isShareDebugEnabled()) return;
  const label = STEP_LABELS[step] ?? `STEP ${step}`;
  if (extra && Object.keys(extra).length) {
    console.info(`[SHARE DEBUG] ${label} meta`, extra);
  }
  push({ at: nowIso(), step, label, detail: detail ? scrubForensicText(detail) : undefined });
}

export function forensicFail(where: string, error: unknown, fileHint?: string) {
  if (!isShareDebugEnabled()) return;
  const err = error instanceof Error ? error : new Error(String(error));
  const message = scrubForensicText(err.message);
  const stack = err.stack ? scrubForensicText(err.stack) : undefined;
  lastException = { message, stack };
  push({
    at: nowIso(),
    step: "FAIL",
    label: `FAIL @ ${scrubForensicText(where)}`,
    detail: scrubForensicText(`${fileHint ? `${fileHint} · ` : ""}${err.name}: ${err.message}`),
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

export function installShareForensicErrorHandlers() {
  if (!isShareDebugEnabled() || handlersInstalled || typeof window === "undefined") return;
  if (!isShareForensicsPath()) return;
  handlersInstalled = true;

  window.addEventListener("error", (event) => {
    if (!isShareDebugEnabled() || !isShareForensicsPath()) return;
    forensicFail(
      "window.onerror",
      event.error ?? new Error(event.message),
      `${event.filename || "unknown"}:${event.lineno || 0}:${event.colno || 0}`
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!isShareDebugEnabled() || !isShareForensicsPath()) return;
    forensicFail("unhandledrejection", event.reason, "Promise rejection");
  });
}

/** Eruda — only with EXPO_PUBLIC_DEBUG_SHARE_ERUDA=1 (+ DEBUG_SHARE / __DEV__). */
export function startShareErudaConsole() {
  if (!isShareErudaEnabled() || erudaStarted || typeof document === "undefined") return;
  if (!isShareForensicsPath()) return;
  erudaStarted = true;
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/eruda";
  script.async = true;
  script.onload = () => {
    if (!isShareErudaEnabled() || !isShareForensicsPath()) return;
    try {
      const w = window as unknown as { eruda?: { init: () => void } };
      w.eruda?.init();
      console.info("[SHARE DEBUG] Eruda mobile console ready");
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

export function diagnoseMissingStep(_reached: Set<number>) {
  return {
    missingStep: 10 as number | "MODULE",
    file: "—",
    component: "—",
    lineHint: "debug trail disabled in production",
    hypothesis: "Enable EXPO_PUBLIC_DEBUG_SHARE=1 to collect STEP trail.",
  };
}

export function formatForensicReport(): string {
  if (!isShareDebugEnabled()) return "(share debug disabled)";
  return scrubForensicText(
    entries.map((e) => `${e.at} | ${e.label}${e.detail ? ` | ${e.detail}` : ""}`).join("\n\n")
  );
}
