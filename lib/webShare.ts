import { Alert, Linking, Platform, Share } from "react-native";
import { buildShareMessage, buildShareUrl, SHARE_NOT_CONFIGURED_MESSAGE } from "@/lib/shareUrl";
import { notifyUser } from "@/lib/userFeedback";

export type ShareLinkResult =
  | { ok: true; url: string; method: "webshare" | "clipboard" }
  | { ok: false; url: string | null; error: string };

export { notifyUser } from "@/lib/userFeedback";

async function copyTextWeb(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn("[share] clipboard.writeText failed", e);
    }
  }

  // Fallback for older browsers / insecure contexts
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

/**
 * Share a property link.
 * Web: Web Share API → clipboard → textarea fallback. Always returns a result.
 * Native: system share sheet.
 */
export async function sharePropertyLink(opts: {
  token: string;
  label: string;
  propertyLabel: string;
}): Promise<ShareLinkResult> {
  const url = buildShareUrl(opts.token);
  if (!url) {
    const error = SHARE_NOT_CONFIGURED_MESSAGE;
    notifyUser("Sharing unavailable", error);
    return { ok: false, url: null, error };
  }

  if (__DEV__) {
    console.info("[share] final URL:", url);
  }

  const intro = `View my Property Journal property history for ${opts.propertyLabel}.`;

  if (Platform.OS === "web") {
    try {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav && typeof nav.share === "function") {
        try {
          await nav.share({ title: opts.label, text: intro, url });
          // Also copy so the required confirmation is accurate.
          await copyTextWeb(url).catch(() => false);
          notifyUser("Share link copied", url);
          return { ok: true, url, method: "webshare" };
        } catch (err) {
          // AbortError = user dismissed sheet — fall through to clipboard.
          if (!(err instanceof Error && err.name === "AbortError")) {
            console.warn("[share] Web Share API failed", err);
          }
        }
      }

      const copied = await copyTextWeb(url);
      if (copied) {
        notifyUser("Share link copied", url);
        return { ok: true, url, method: "clipboard" };
      }

      const error = `Copy this link manually:\n\n${url}`;
      notifyUser("Copy failed", error);
      return { ok: false, url, error };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.warn("[share] web share failed", e);
      notifyUser("Share failed", error);
      return { ok: false, url, error };
    }
  }

  const message = buildShareMessage(opts.token, intro);
  if (!message) {
    const error = SHARE_NOT_CONFIGURED_MESSAGE;
    notifyUser("Sharing unavailable", error);
    return { ok: false, url: null, error };
  }
  await Share.share({ message, title: opts.label });
  return { ok: true, url, method: "clipboard" };
}

/** Open the public HTTPS share URL in a new tab (web) or system browser (native). */
export async function openShareLink(token: string): Promise<ShareLinkResult> {
  const url = buildShareUrl(token);
  if (!url) {
    const error = SHARE_NOT_CONFIGURED_MESSAGE;
    notifyUser("Sharing unavailable", error);
    return { ok: false, url: null, error };
  }

  if (__DEV__) {
    console.info("[share] open URL:", url);
  }

  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return { ok: true, url, method: "clipboard" };
    }
    await Linking.openURL(url);
    return { ok: true, url, method: "clipboard" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    notifyUser("Open failed", error);
    return { ok: false, url, error };
  }
}
