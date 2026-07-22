import Constants from "expo-constants";

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
 * Expected: https://property-journal.vercel.app
 * Legacy values ending in /share are accepted and normalized.
 */
export function getShareBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_SHARE_BASE_URL?.trim();
  if (!raw) return null;

  let base = normalizeBaseUrl(raw);
  // Legacy env included /share — strip so we never emit /share/share/<token>.
  if (/\/share$/i.test(base)) {
    base = base.replace(/\/share$/i, "");
  }

  try {
    const { hostname, protocol } = new URL(base);
    if (protocol !== "https:" && protocol !== "http:") return null;
    if (BLOCKED_PLACEHOLDER_HOSTS.has(hostname)) return null;
  } catch {
    return null;
  }

  return base;
}

export function isShareConfigured(): boolean {
  return getShareBaseUrl() !== null;
}

/**
 * Public HTTPS link: {EXPO_PUBLIC_SHARE_BASE_URL}/share/<token>
 * Example: https://property-journal.vercel.app/share/HW-XXXX
 */
export function buildShareUrl(token: string): string | null {
  const base = getShareBaseUrl();
  if (!base) return null;

  const clean = token.trim();
  if (!clean) return null;

  return `${base}/share/${encodeURIComponent(clean)}`;
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
  if (!__DEV__) return;
  const base = getShareBaseUrl();
  console.info(
    `[share] EXPO_PUBLIC_SHARE_BASE_URL=${base ?? "(not configured)"} · appOwnership=${Constants.appOwnership}`
  );
}
