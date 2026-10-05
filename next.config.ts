import type { NextConfig } from "next";
import { publicOrigin } from "./src/lib/urls";

for (const name of ["NEXT_PUBLIC_API_BASE_URL", "NEXT_PUBLIC_SITE_ORIGIN"] as const) {
  const value = process.env[name];
  if (value) publicOrigin(value, process.env.NODE_ENV !== "production");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Public data is loaded afresh in the browser, never in an RSC payload.
  async headers() {
    return [{
      source: "/trace/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
    }];
  },
};

export default nextConfig;
