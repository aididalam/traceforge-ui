import type { NextConfig } from "next";
import { publicOrigin } from "./src/lib/urls";

for (const name of ["NEXT_PUBLIC_API_BASE_URL", "NEXT_PUBLIC_SITE_ORIGIN"] as const) {
  const value = process.env[name];
  if (value) publicOrigin(value, process.env.NODE_ENV !== "production");
}

const nextConfig: NextConfig = {
  distDir: process.env.TRACEFORGE_UI_DIST_DIR || ".next",
  poweredByHeader: false,
  // Public data is loaded afresh in the browser, never in an RSC payload.
  async headers() {
    return ["/trace/:path*", "/track/:path*"].map(source => ({
      source,
      headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
    }));
  },
};

export default nextConfig;
