import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Custom HTML shell for the web export (public share pages + SPA).
 * Keep branding as Property Journal only.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <title>Property Journal</title>
        <meta name="description" content="Property Journal — shared property preview" />
        <ScrollViewStyleReset />
      </head>
      <body style={{ margin: 0, backgroundColor: "#F5F7FB" }}>{children}</body>
    </html>
  );
}
