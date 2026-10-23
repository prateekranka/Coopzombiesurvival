import { getLevel } from "@lifeline/content";
import { createWorld, stepWorld, type InputSource } from "@lifeline/sim";
import { describe, expect, it } from "vitest";
import { DEFAULT_DEBUG_SETTINGS, bot } from "../src/debug";

const still: InputSource = { sample: () => ({ moveX: 0, moveY: 0, buttons: 0 }) };

describe("follow bot", () => {
  it("climbs the test room to reach you on the top platform", () => {
    const world = createWorld(getLevel("m0-test-room"));
    const [you, partner] = world.state.players;
    // You stand on the high platform at x 18-23.
    Object.assign(you, { x: 21, y: 5 });
    const settings = { ...DEFAULT_DEBUG_SETTINGS, bot: "follow" as const };
    const brain = bot(1, settings, () => world, still);
    for (let i = 0; i < 30 * 20; i++) {
      const s = brain.sample();
      stepWorld(world, [undefined, { seq: 0, ...s }]);
      if (partner.grounded && partner.y === 5) break;
    }
    expect(partner.y).toBe(5);
    expect(Math.abs(partner.x - you.x)).toBeLessThan(3);
  });
});
