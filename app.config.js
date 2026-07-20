/**
 * Dynamic Expo config — merges app.json and adds universal/app links when
 * EXPO_PUBLIC_SHARE_BASE_URL points at a real deployed HTTPS host.
 */
module.exports = ({ config }) => {
  const shareBase = process.env.EXPO_PUBLIC_SHARE_BASE_URL?.trim();
  let shareHost = null;

  if (shareBase) {
    try {
      const host = new URL(shareBase).hostname;
      if (host && host !== "homewise.app") {
        shareHost = host;
      }
    } catch {
      // ignore invalid URL
    }
  }

  const ios = { ...config.ios };
  const android = { ...config.android };

  if (shareHost) {
    ios.associatedDomains = [`applinks:${shareHost}`];
    android.intentFilters = [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: shareHost, pathPrefix: "/share" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ];
  }

  const showRealErrors =
    process.env.EXPO_PUBLIC_SHOW_REAL_ERRORS === "1" ||
    process.env.EAS_BUILD_PROFILE === "preview" ||
    process.env.EAS_BUILD_PROFILE === "development";

  return {
    ...config,
    ios,
    android,
    extra: {
      ...(config.extra ?? {}),
      showRealErrors,
    },
  };
};
