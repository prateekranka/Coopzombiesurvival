import { expect, test, type Page } from "@playwright/test";

// Debug mode: one person plays alone with a bot partner, tunes the feel, and simulates the
// network without a second iPad.

type Player = { id: number; x: number; y: number };
type Hook = { status?: { mode: string }; authority?: Player[] };

const hook = (page: Page) => page.evaluate(() => (window as unknown as { __lifeline: Hook }).__lifeline);
const truthX = async (page: Page, id: number) => (await hook(page)).authority!.find((p) => p.id === id)!.x;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("play alone, swap, tune, pause and simulate the network", async ({ page }) => {
  await page.goto("/?debug");
  await expect.poll(async () => (await hook(page)).status?.mode).toBe("debug");
  await page.getByRole("button", { name: "Debug" }).click();
  await expect(page.getByText("Cass · bot")).toBeVisible();
  await expect(page.locator(".debug-overlay")).toContainText("Wren");

  // You move Wren; the bot moves Cass after you.
  const cassStart = await truthX(page, 1);
  await page.keyboard.down("KeyA");
  await expect.poll(() => truthX(page, 0), { timeout: 5000 }).toBeLessThan(2);
  await page.keyboard.up("KeyA");
  await expect.poll(() => truthX(page, 1), { timeout: 8000 }).toBeLessThan(cassStart - 2);

  // Swap: now the keys move Cass.
  await page.getByRole("button", { name: /You: Wren/ }).click();
  await expect(page.getByRole("button", { name: /You: Cass/ })).toBeVisible();
  await page.getByLabel("Partner bot").selectOption("idle");
  const wrenX = await truthX(page, 0);
  const cassX = await truthX(page, 1);
  await page.keyboard.down("KeyD");
  await expect.poll(() => truthX(page, 1)).toBeGreaterThan(cassX + 1);
  await page.keyboard.up("KeyD");
  expect(Math.abs((await truthX(page, 0)) - wrenX)).toBeLessThan(0.01);

  // Tune: the slider changes the sim and is marked as changed.
  const walk = page.locator(".sliders label").filter({ hasText: "Walk speed" });
  await walk.locator("input").fill("9");
  await expect(walk).toHaveClass(/changed/);
  await page.getByRole("button", { name: "Copy values" }).click();
  await expect(page.locator(".copy-out")).toHaveValue(/"walkSpeed": 9/);

  // Pause holds the world still; Step moves it one tick.
  await page.getByRole("button", { name: "Pause" }).click();
  const tick = await page.evaluate(() => (window as unknown as { __lifeline: { tick: number } }).__lifeline.tick);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __lifeline: { tick: number } }).__lifeline.tick)).toBe(tick);
  await page.getByRole("button", { name: "Step" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __lifeline: { tick: number } }).__lifeline.tick)).toBe(tick + 1);
  await page.getByRole("button", { name: "Play" }).click();

  // Settings survive a reload.
  await page.reload();
  await expect(page.locator(".sliders label").filter({ hasText: "Walk speed" })).toHaveClass(/changed/);
  await expect(page.getByRole("button", { name: /You: Cass/ })).toBeVisible();

  // Net sim: a host and a guest in one page, over a link with latency.
  await page.getByLabel("Simulate two iPads").check();
  await expect(page.locator(".debug-overlay")).toContainText("unacked inputs");
  const before = await truthX(page, 1);
  await page.keyboard.down("KeyA");
  await expect.poll(() => truthX(page, 1)).toBeLessThan(before - 1);
  await page.keyboard.up("KeyA");
  await page.screenshot({ path: "test-results/debug-net.png" });
});
