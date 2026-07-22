import { Alert, Platform, Share } from "react-native";
import { buildShareMessage, buildShareUrl, SHARE_NOT_CONFIGURED_MESSAGE } from "@/lib/shareUrl";

async function copyTextWeb(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
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
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  return ok;
}

/**
 * Share a property link.
 * Web: clipboard (+ optional Web Share API). Native: system share sheet.
 */
export async function sharePropertyLink(opts: {
  token: string;
  label: string;
  propertyLabel: string;
}): Promise<void> {
  const url = buildShareUrl(opts.token);
  if (!url) {
    Alert.alert("Sharing unavailable", SHARE_NOT_CONFIGURED_MESSAGE);
    return;
  }

  const intro = `View my Property Journal property history for ${opts.propertyLabel}.`;

  if (Platform.OS === "web") {
    try {
      const copied = await copyTextWeb(url);
      if (copied) {
        Alert.alert("Share link copied", url);
        return;
      }

      // Optional Web Share API when clipboard is unavailable.
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav && typeof nav.share === "function") {
        try {
          await nav.share({ title: opts.label, text: intro, url });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          console.warn("[share] Web Share API failed", err);
        }
      }

      Alert.alert("Copy failed", `Copy this link manually:\n\n${url}`);
    } catch (e) {
      console.warn("[share] web share failed", e);
      Alert.alert("Share failed", e instanceof Error ? e.message : String(e));
    }
    return;
  }

  const message = buildShareMessage(opts.token, intro);
  if (!message) {
    Alert.alert("Sharing unavailable", SHARE_NOT_CONFIGURED_MESSAGE);
    return;
  }
  await Share.share({ message, title: opts.label });
}
