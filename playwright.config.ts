import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests", testMatch: "**/*.spec.ts", fullyParallel: true, workers: 2,
  timeout: 30000, retries: 0,
  use: { baseURL: "http://127.0.0.1:4178", trace: "retain-on-failure", serviceWorkers: "block" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1100 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" } },
  ],
  webServer: [
    { command: "node --experimental-strip-types tests/fixture-server.mjs", url: "http://127.0.0.1:4202/health", reuseExistingServer: false },
    { command: "npm run start -- --port 4178", url: "http://127.0.0.1:4178", reuseExistingServer: false,
      env: { NEXT_TELEMETRY_DISABLED: "1", TRACEFORGE_BROADCAST_ENABLED: "false", TRACEFORGE_PUBLIC_API_ORIGIN: "http://127.0.0.1:4202" } },
  ],
});
