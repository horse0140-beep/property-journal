import { Linking, Platform, Share } from "react-native";
import {
  buildShareMessage,
  buildShareUrl,
  SHARE_APP_SCHEME,
  SHARE_NOT_CONFIGURED_MESSAGE,
} from "@/lib/shareUrl";
import { shareAudit, shareAuditFailure } from "@/lib/shareAudit";

export type ShareLinkResult =
  | { ok: true; url: string; method: "webshare" | "clipboard" }
  | { ok: false; url: string | null; error: string };

export { notifyUser } from "@/lib/userFeedback";

const SHARE_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

async function copyTextWeb(text: string): Promise<boolean> {
  let clipboardApiError: unknown = null;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await withTimeout(navigator.clipboard.writeText(text), SHARE_TIMEOUT_MS, "clipboard.writeText");
      return true;
    } catch (e) {
      clipboardApiError = e;
      shareAuditFailure("11 clipboard.writeText", e);
    }
  }

  if (typeof document === "undefined") {
    if (clipboardApiError) {
      throw clipboardApiError instanceof Error
        ? clipboardApiError
        : new Error(String(clipboardApiError));
    }
    return false;
  }

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
  } catch (e) {
    shareAuditFailure("11 execCommand copy", e);
    ok = false;
  }
  document.body.removeChild(ta);
  if (!ok && clipboardApiError) {
    throw clipboardApiError instanceof Error
      ? clipboardApiError
      : new Error(String(clipboardApiError));
  }
  return ok;
}

/**
 * Share a property link (single URL builder).
 * Web: clipboard first (reliable), then optional Web Share — never depends on navigator.share alone.
 */
export async function sharePropertyLink(opts: {
  token: string;
  label: string;
  propertyLabel: string;
}): Promise<ShareLinkResult> {
  const url = buildShareUrl(opts.token, { audit: true });
  if (!url) {
    const error = SHARE_NOT_CONFIGURED_MESSAGE;
    shareAudit("11", { method: null, result: "fail", error });
    return { ok: false, url: null, error };
  }

  const intro = `View my Property Journal property history for ${opts.propertyLabel}.`;

  if (Platform.OS === "web") {
    try {
      shareAudit("10", { method: "clipboard", finalUrl: url });
      const copied = await copyTextWeb(url);
      if (copied) {
        shareAudit("11", { method: "clipboard", result: "ok", finalUrl: url });

        // Optional native sheet — never block success on it.
        const nav = typeof navigator !== "undefined" ? navigator : null;
        if (nav && typeof nav.share === "function") {
          void withTimeout(
            nav.share({ title: opts.label, text: intro, url }),
            SHARE_TIMEOUT_MS,
            "navigator.share"
          ).catch((err) => {
            if (!(err instanceof Error && err.name === "AbortError")) {
              shareAuditFailure("11 navigator.share optional", err, { finalUrl: url });
            }
          });
        }

        return { ok: true, url, method: "clipboard" };
      }

      const error = `Unable to share: clipboard copy failed. Copy manually:\n\n${url}`;
      shareAudit("11", { method: "clipboard", result: "fail", error, finalUrl: url });
      return { ok: false, url, error };
    } catch (e) {
      const error = `Unable to share: ${e instanceof Error ? e.message : String(e)}`;
      shareAuditFailure("11 web share", e, { finalUrl: url });
      return { ok: false, url, error };
    }
  }

  const message = buildShareMessage(opts.token, intro);
  if (!message) {
    return { ok: false, url: null, error: SHARE_NOT_CONFIGURED_MESSAGE };
  }

  try {
    shareAudit("10", { method: "native_share", finalUrl: url });
    await withTimeout(Share.share({ message, title: opts.label }), SHARE_TIMEOUT_MS, "Share.share");
    shareAudit("11", { method: "native_share", result: "ok", finalUrl: url });
    return { ok: true, url, method: "clipboard" };
  } catch (e) {
    const error = `Unable to share: ${e instanceof Error ? e.message : String(e)}`;
    shareAuditFailure("11 native Share.share", e, { finalUrl: url });
    return { ok: false, url, error };
  }
}

/** Open the public HTTPS share URL in a new tab (web) or system browser (native). */
export async function openShareLink(token: string): Promise<ShareLinkResult> {
  shareAudit("12", { token });
  const url = buildShareUrl(token, { audit: true });
  if (!url) {
    const error = SHARE_NOT_CONFIGURED_MESSAGE;
    shareAuditFailure("12 openShareLink", new Error(error));
    return { ok: false, url: null, error };
  }

  if (url.startsWith(`${SHARE_APP_SCHEME}://`) || url.startsWith("homewise://")) {
    const error = "Unable to open: refused native scheme on web";
    shareAuditFailure("12 openShareLink", new Error(error), { finalUrl: url });
    return { ok: false, url, error };
  }

  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        const error =
          "Unable to open: popup blocked. Allow popups or paste the link in a new tab.";
        shareAuditFailure("12 window.open", new Error(error), { finalUrl: url });
        return { ok: false, url, error };
      }
      shareAudit("12", { result: "ok", finalUrl: url, method: "window.open" });
      return { ok: true, url, method: "clipboard" };
    }
    await withTimeout(Linking.openURL(url), SHARE_TIMEOUT_MS, "Linking.openURL");
    shareAudit("12", { result: "ok", finalUrl: url, method: "Linking.openURL" });
    return { ok: true, url, method: "clipboard" };
  } catch (e) {
    const error = `Unable to open: ${e instanceof Error ? e.message : String(e)}`;
    shareAuditFailure("12 openShareLink", e, { finalUrl: url });
    return { ok: false, url, error };
  }
}
