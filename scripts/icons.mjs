// Renders apps/client/public/icon.svg to the PNG sizes iOS and the manifest need.
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("apps/client/public/icon.svg", "utf8");
// Cloud sessions ship one Chromium build; use it if it is there.
const local = "/opt/pw-browsers/chromium";
const browser = await chromium.launch(existsSync(local) ? { executablePath: local } : {});
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: `apps/client/public/icon-${size}.png`, omitBackground: true });
  await page.close();
}
await browser.close();
