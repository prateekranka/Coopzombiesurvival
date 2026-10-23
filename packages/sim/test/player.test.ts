import { getLevel } from "@lifeline/content";
import { describe, expect, it } from "vitest";
import { Button, DEFAULT_TUNING, DT, createWorld, resetTuning, setTuning, tuning, stepPlayer, stepWorld, type InputFrame } from "../src";

const level = getLevel("m0-test-room");
const input = (moveX = 0, buttons = 0, seq = 0): InputFrame => ({ seq, moveX, moveY: 0, buttons });

function settled() {
  const world = createWorld(level);
  for (let i = 0; i < 30; i++) stepWorld(world, []);
  return world;
}

describe("player movement", () => {
  it("lands on the floor and stays grounded", () => {
    const world = settled();
    const [a, b] = world.state.players;
    expect(a.grounded).toBe(true);
    expect(a.y).toBe(2);
    expect(b.y).toBe(2);
  });

  it("walks at walk speed", () => {
    const world = settled();
    for (let i = 0; i < 15; i++) stepWorld(world, [input(1)]);
    expect(world.state.players[0].vx).toBeCloseTo(DEFAULT_TUNING.walkSpeed);
  });

  it("jumps about the jump height", () => {
    const world = settled();
    const p = world.state.players[0];
    let maxY = p.y;
    stepWorld(world, [input(0, Button.Jump)]);
    for (let i = 0; i < 60; i++) {
      stepWorld(world, [input(0, Button.Jump)]);
      maxY = Math.max(maxY, p.y);
    }
    expect(maxY - 2).toBeGreaterThan(DEFAULT_TUNING.jumpHeight - 0.15);
    expect(maxY - 2).toBeLessThan(DEFAULT_TUNING.jumpHeight + 0.15);
    expect(p.grounded).toBe(true);
  });

  it("does not jump again while jump stays held", () => {
    const world = settled();
    const p = world.state.players[0];
    for (let i = 0; i < 90; i++) stepWorld(world, [input(0, Button.Jump)]);
    expect(p.grounded).toBe(true);
    expect(p.vy).toBe(0);
  });

  it("stops at walls", () => {
    const world = settled();
    for (let i = 0; i < 120; i++) stepWorld(world, [input(-1)]);
    const p = world.state.players[0];
    expect(p.x).toBeCloseTo(1.3);
    expect(p.vx).toBe(0);
  });

  it("is deterministic, so the guest can replay inputs", () => {
    const run = () => {
      const world = settled();
      const p = { ...world.state.players[1] };
      for (let i = 0; i < 200; i++) stepPlayer(p, input(Math.sin(i / 9), i % 40 < 5 ? Button.Jump : 0), world.solids);
      return p;
    };
    expect(run()).toEqual(run());
  });

  it("reads live tuning values", () => {
    setTuning({ walkSpeed: 8, gravity: Number.NaN });
    expect(tuning.gravity).toBe(DEFAULT_TUNING.gravity);
    const world = settled();
    // Few enough ticks to reach full speed before the first box.
    for (let i = 0; i < 8; i++) stepWorld(world, [input(1)]);
    expect(world.state.players[0].vx).toBeCloseTo(8);
    resetTuning();
    expect(tuning).toEqual(DEFAULT_TUNING);
  });

  it("uses a fixed 30 Hz step", () => {
    expect(DT).toBeCloseTo(1 / 30);
  });
});

describe("test room", () => {
  it("can be climbed to the top platform with the default jump", () => {
    resetTuning();
    const world = settled();
    const p = world.state.players[0];
    // Run right and jump at each step up, like a player would.
    const jumpAt = [6.8, 10.6, 16.6];
    let hold = 0;
    let next = 0;
    for (let i = 0; i < 300 && p.x < 22; i++) {
      if (hold > 0) hold--;
      else if (next < jumpAt.length && p.x >= jumpAt[next]! && p.grounded) {
        hold = 10;
        next++;
      }
      stepWorld(world, [input(1, hold > 0 ? Button.Jump : 0)]);
    }
    for (let i = 0; i < 30; i++) stepWorld(world, []);
    expect(p.y).toBe(5);
  });

  it("leaves head room to walk under the platforms", () => {
    const world = settled();
    const p = world.state.players[1];
    p.x = 11.5; // past the first box
    for (let i = 0; i < 400; i++) stepPlayer(p, input(1), world.solids);
    // Stopped only by the metal crate at x = 28, not by a low platform.
    expect(p.x).toBeCloseTo(27.7);
  });
});
