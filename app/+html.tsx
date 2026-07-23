import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Custom HTML shell for the web export (public share pages + SPA).
 * Keep branding as Property Journal only.
 *
 * ScrollViewStyleReset sets body { overflow: hidden }, which blanks some
 * Android browsers on /share/*. An early script unlocks scrolling for share routes.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <title>Property Journal</title>
        <meta name="description" content="Property Journal — shared property preview" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html.pj-share-route, html.pj-share-route body {
                height: auto !important;
                min-height: 100% !important;
                overflow: auto !important;
                overflow-y: auto !important;
                background-color: #F0F4FF !important;
              }
              html.pj-share-route #root {
                height: auto !important;
                min-height: 100vh !important;
                display: block !important;
              }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(/^\\/share(\\/|$)/i.test(location.pathname)){document.documentElement.classList.add("pj-share-route");}}catch(e){}})();`,
          }}
        />
      </head>
      <body style={{ margin: 0, backgroundColor: "#F0F4FF" }}>{children}</body>
    </html>
  );
}
