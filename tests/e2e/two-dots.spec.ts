import { expect, test, type Page } from "@playwright/test";

// M0 "Two dots": two iPads join one room by code and each moves its own capsule.
// GAME.md section 14.

type Hook = {
  status?: { mode: string; net: string; peer: boolean; code?: string };
  players?: { id: number; x: number; y: number }[];
  authority?: { id: number; x: number; y: number }[];
};

const hook = (page: Page) => page.evaluate(() => (window as unknown as { __lifeline: Hook }).__lifeline);
const playerX = async (page: Page, id: number) => (await hook(page)).players?.find((p) => p.id === id)?.x ?? NaN;

async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test("two iPads join one room and see each other move", async ({ browser }) => {
  const hostCtx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const guestCtx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  // Host: tap to start, then host a room.
  await host.goto("/");
  await host.getByText("Tap to start").click();
  await host.getByRole("button", { name: "Host a room" }).click();
  await expect.poll(async () => (await hook(host)).status?.code ?? "").toMatch(/^[A-Z]{4}$/);
  const code = (await hook(host)).status!.code!;
  await expect(host.getByText(`Room ${code}`)).toBeVisible();

  // Guest: tap to start, type the code, join.
  await guest.goto("/");
  await guest.getByText("Tap to start").click();
  await guest.getByLabel("Room code").fill(code);
  await guest.getByRole("button", { name: "Join" }).click();

  await expect.poll(async () => (await hook(host)).status?.peer).toBe(true);
  await expect.poll(async () => (await hook(guest)).status?.peer).toBe(true);
  await expect(host.getByText("Cass · linked")).toBeVisible();
  await expect(guest.getByText("Wren · linked")).toBeVisible();

  // The host moves right; the guest sees it.
  const hostStart = await playerX(guest, 0);
  await hold(host, "KeyD", 1000);
  await expect.poll(() => playerX(guest, 0)).toBeGreaterThan(hostStart + 2);

  // The guest moves left with prediction; the host's authoritative state follows.
  const guestStart = (await hook(host)).authority!.find((p) => p.id === 1)!.x;
  await guest.keyboard.down("ArrowLeft");
  // Prediction: the guest's own capsule moves at once, before any round trip could finish.
  await expect.poll(() => playerX(guest, 1), { intervals: [50], timeout: 400 }).toBeLessThan(guestStart - 0.05);
  await guest.waitForTimeout(800);
  await guest.keyboard.up("ArrowLeft");
  await expect.poll(async () => (await hook(host)).authority!.find((p) => p.id === 1)!.x).toBeLessThan(guestStart - 2);

  // Both screens agree once everyone stops.
  const gap = async () => {
    const [h, g] = await Promise.all([hook(host), hook(guest)]);
    return Math.max(
      ...[0, 1].map((id) => Math.abs(h.authority!.find((p) => p.id === id)!.x - g.players!.find((p) => p.id === id)!.x)),
    );
  };
  await expect.poll(gap, { timeout: 10_000 }).toBeLessThan(0.05);

  await host.screenshot({ path: "test-results/m0-host.png" });
  await guest.screenshot({ path: "test-results/m0-guest.png" });
  await hostCtx.close();
  await guestCtx.close();
});

test("a wrong code does not join", async ({ page }) => {
  await page.goto("/?auto=join&room=ZZZZ");
  await expect.poll(async () => (await hook(page)).status?.net).toBe("closed");
});
