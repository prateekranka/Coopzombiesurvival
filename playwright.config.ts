import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Two iPad-sized clients against the real Worker, run locally by wrangler. GAME.md section 11.
const PORT = 8788;
const localChromium = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  // Each test runs two rendering clients; in parallel they starve each other on CI machines.
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1180, height: 820 },
    launchOptions: existsSync(localChromium) ? { executablePath: localChromium } : {},
  },
  webServer: {
    command: `npm run build && npx wrangler dev --config apps/server/wrangler.jsonc --port ${PORT} --ip 127.0.0.1`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
