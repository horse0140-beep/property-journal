import { rewrite } from "@vercel/functions";

/**
 * SPA fallback for Expo web.output=single.
 * vercel.json rewrites should handle this; middleware is a second line of defense
 * when nested routes (e.g. /share/<token>) would otherwise return platform 404.
 */
export const config = {
  matcher: ["/((?!_expo/|favicon\\.ico|.*\\..*).*)"],
};

export default function middleware(request: Request) {
  const url = new URL(request.url);
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return;
  }
  return rewrite(new URL("/", request.url));
}
