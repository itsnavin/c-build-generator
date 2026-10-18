import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  use: { baseURL: process.env.LIVE_URL || "http://127.0.0.1:4173", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ],
  webServer: process.env.LIVE_URL ? undefined : {
    command: `"${process.execPath}" scripts/serve.mjs`,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI
  }
});
