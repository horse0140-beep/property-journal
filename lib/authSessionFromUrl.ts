import { supabase } from "@/lib/supabase";

export function parseParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const hashIndex = url.indexOf("#");
  const queryIndex = url.indexOf("?");

  const paramString =
    hashIndex !== -1
      ? url.slice(hashIndex + 1)
      : queryIndex !== -1
        ? url.slice(queryIndex + 1)
        : "";

  for (const segment of paramString.split("&")) {
    if (!segment) continue;
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    const key = decodeURIComponent(segment.slice(0, eq));
    const value = decodeURIComponent(segment.slice(eq + 1));
    params[key] = value;
  }

  return params;
}

/** PKCE codes are single-use — never exchange the same one twice. */
const consumedCodes = new Set<string>();

function friendlyLinkError(params: Record<string, string>): string {
  const description = (params.error_description ?? "").replace(/\+/g, " ").trim();
  if (params.error_code === "otp_expired" || description.toLowerCase().includes("expired")) {
    return "This link has expired. Please request a new one.";
  }
  return description || "This link is invalid or has expired. Please request a new one.";
}

/** Exchange Supabase auth tokens or PKCE code from a deep link / redirect URL. */
export async function createSessionFromUrl(url: string): Promise<boolean> {
  const params = parseParamsFromUrl(url);

  // Supabase redirects failed links with error params instead of tokens.
  if (params.error || params.error_code) {
    throw new Error(friendlyLinkError(params));
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw new Error(error.message);
    return true;
  }

  if (params.code) {
    if (consumedCodes.has(params.code)) {
      // Another screen already exchanged this code — report current session state.
      const { data } = await supabase.auth.getSession();
      return Boolean(data.session);
    }
    consumedCodes.add(params.code);
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw new Error(error.message);
    return true;
  }

  return false;
}

export function isAuthCallbackUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("access_token=") ||
    lower.includes("refresh_token=") ||
    lower.includes("code=") ||
    lower.includes("type=signup") ||
    lower.includes("type=email") ||
    lower.includes("type=recovery") ||
    lower.includes("type=magiclink") ||
    lower.includes("auth/callback") ||
    lower.includes("confirm-email") ||
    lower.includes("reset-password")
  );
}

export function isRecoveryUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("reset-password") || lower.includes("type=recovery");
}
