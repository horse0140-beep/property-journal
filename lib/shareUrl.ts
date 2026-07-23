import Constants from "expo-constants";
import { shareAudit } from "@/lib/shareAudit";

/** Shown in preview/dev when EXPO_PUBLIC_SHARE_BASE_URL is not set. */
export const SHARE_NOT_CONFIGURED_MESSAGE = "Sharing is not configured yet";

/** Native deep-link scheme — must match app.json → expo.scheme */
export const SHARE_APP_SCHEME = "homewise";

/**
 * Domains that must not be used unless explicitly deployed.
 * homewise.app is listed in .env.example as an illustration only.
 */
const BLOCKED_PLACEHOLDER_HOSTS = new Set(["homewise.app"]);

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

/**
 * Site origin for public share links.
 * Required: https://property-journal.vercel.app
 * Legacy values ending in /share are accepted and normalized (never /share/share).
 */
export function getShareBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_SHARE_BASE_URL?.trim() ?? "";
  if (!raw) return null;

  let base = normalizeBaseUrl(raw);
  if (/\/share$/i.test(base)) {
    base = base.replace(/\/share$/i, "");
  }

  try {
    const { hostname, protocol } = new URL(base);
    if (protocol !== "https:" && protocol !== "http:") return null;
    if (BLOCKED_PLACEHOLDER_HOSTS.has(hostname)) return null;
    if (hostname === "localhost" || hostname.endsWith(".localhost")) return null;
  } catch {
    return null;
  }

  return base;
}

export function isShareConfigured(): boolean {
  return getShareBaseUrl() !== null;
}

/**
 * Single shared URL builder for Share and Open Link.
 * Final form: {origin}/share/{token}
 */
export function buildShareUrl(token: string, opts?: { audit?: boolean }): string | null {
  const audit = opts?.audit === true;
  const envRaw = process.env.EXPO_PUBLIC_SHARE_BASE_URL?.trim() ?? "";
  const base = getShareBaseUrl();
  const rawToken = token === undefined || token === null ? "" : String(token);

  if (audit) {
    console.info("[SEND AUDIT 01] raw base URL", envRaw || "(unset)");
    console.info("[SEND AUDIT 02] normalized base URL", base);
    shareAudit("07", { environmentBaseUrl: envRaw || "(unset)" });
    shareAudit("08", { normalizedBaseUrl: base });
    // Mask token content in console; length is enough for audits.
    console.info("[SEND AUDIT 03] raw token", rawToken ? `${rawToken.slice(0, 4)}…` : "(empty)");
    console.info("[SEND AUDIT 04] token length", rawToken.trim().length);
  }

  if (!base) {
    if (audit) {
      console.info("[SEND AUDIT 05] final URL", null);
      shareAudit("09", { finalGeneratedUrl: null, reason: "base_not_configured" });
    }
    return null;
  }

  if (token === undefined || token === null) {
    if (audit) {
      console.info("[SEND AUDIT 05] final URL", null);
      shareAudit("09", { finalGeneratedUrl: null, reason: "token_undefined" });
    }
    return null;
  }

  const clean = String(token).trim();
  if (!clean) {
    if (audit) {
      console.info("[SEND AUDIT 05] final URL", null);
      shareAudit("09", { finalGeneratedUrl: null, reason: "token_empty" });
    }
    return null;
  }

  const url = `${base}/share/${encodeURIComponent(clean)}`;

  // Guardrails against known bad patterns
  if (url.includes("/share/share/")) {
    if (audit) {
      console.info("[SEND AUDIT 05] final URL", null);
      shareAudit("09", { finalGeneratedUrl: url, reason: "double_share_rejected" });
    }
    return null;
  }
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] !== "share" || !parts[1] || parts.length !== 2) {
      if (audit) {
        console.info("[SEND AUDIT 05] final URL", null);
        shareAudit("09", { finalGeneratedUrl: url, reason: "path_shape_rejected" });
      }
      return null;
    }
  } catch {
    if (audit) {
      console.info("[SEND AUDIT 05] final URL", null);
      shareAudit("09", { finalGeneratedUrl: url, reason: "url_parse_failed" });
    }
    return null;
  }

  if (audit) {
    console.info("[SEND AUDIT 05] final URL", url);
    shareAudit("09", { finalGeneratedUrl: url, token: clean });
  }
  return url;
}

/** Native deep link — opens the in-app share screen when the app is installed. */
export function buildNativeShareUrl(token: string): string {
  const clean = token.trim();
  return `${SHARE_APP_SCHEME}://share/${encodeURIComponent(clean)}`;
}

/**
 * Prefer the public HTTPS URL; include the native URL as a fallback hint for app users.
 * Returns null when HTTPS sharing is not configured.
 */
export function buildShareMessage(token: string, intro: string): string | null {
  const publicUrl = buildShareUrl(token);
  if (!publicUrl) return null;

  const nativeUrl = buildNativeShareUrl(token);
  return `${intro}\n\n${publicUrl}\n\nOpen in app: ${nativeUrl}`;
}

/** Parse a share token from homewise:// or https://…/share/<token> URLs. */
export function extractShareTokenFromUrl(url: string): string | null {
  const native = url.match(/^homewise:\/\/share\/([^/?#]+)/i);
  if (native?.[1]) return decodeURIComponent(native[1]);

  const https = url.match(/\/share\/([^/?#]+)/i);
  if (https?.[1]) return decodeURIComponent(https[1]);

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const shareIdx = parts.indexOf("share");
    if (shareIdx >= 0 && parts[shareIdx + 1]) {
      return decodeURIComponent(parts[shareIdx + 1]);
    }
    if (parsed.hostname === "share" && parts[0]) {
      return decodeURIComponent(parts[0]);
    }
  } catch {
    // ignore
  }
  return null;
}

/** Log share URL config once in dev / preview builds. */
export function logShareUrlConfig(): void {
  const base = getShareBaseUrl();
  shareAudit("config", {
    environmentBaseUrl: process.env.EXPO_PUBLIC_SHARE_BASE_URL?.trim() || "(unset)",
    normalizedBaseUrl: base,
    appOwnership: Constants.appOwnership ?? null,
  });
}
