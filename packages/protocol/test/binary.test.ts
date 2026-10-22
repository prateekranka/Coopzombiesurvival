import { getLevel } from "@lifeline/content";
import { Button, createWorld, stepWorld } from "@lifeline/sim";
import { describe, expect, it } from "vitest";
import { decodeInput, decodeSnapshot, encodeInput, encodeSnapshot, isRoomCode, randomRoomCode, seqNewer } from "../src";

describe("input frames", () => {
  it("round-trips with quantized sticks", () => {
    const frame = { seq: 65535, moveX: -1, moveY: 0.5, buttons: Button.Jump | Button.Signal };
    const out = decodeInput(encodeInput(frame));
    expect(out.seq).toBe(65535);
    expect(out.moveX).toBe(-1);
    expect(out.moveY).toBeCloseTo(0.5, 1);
    expect(out.buttons).toBe(frame.buttons);
  });
});

describe("snapshots", () => {
  it("round-trips the world within quantization", () => {
    const world = createWorld(getLevel("m0-test-room"));
    for (let i = 0; i < 20; i++) stepWorld(world, [{ seq: i, moveX: 1, moveY: 0, buttons: Button.Jump }]);
    const buf = encodeSnapshot(world.state, 1234);
    expect(buf.byteLength).toBe(40);
    const snap = decodeSnapshot(buf);
    expect(snap.tick).toBe(20);
    expect(snap.ack).toBe(1234);
    snap.players.forEach((p, i) => {
      const src = world.state.players[i]!;
      expect(p.id).toBe(src.id);
      expect(p.x).toBeCloseTo(src.x, 2);
      expect(p.y).toBeCloseTo(src.y, 2);
      expect(p.vx).toBeCloseTo(src.vx, 1);
      expect(p.vy).toBeCloseTo(src.vy, 1);
      expect(p.grounded).toBe(src.grounded);
      expect(p.jumpHeld).toBe(src.jumpHeld);
      expect(p.facing).toBe(src.facing);
      expect(p.coyote).toBe(src.coyote);
      expect(p.jumpBuffer).toBe(src.jumpBuffer);
    });
  });

  it("rejects the wrong message type", () => {
    expect(() => decodeSnapshot(encodeInput({ seq: 1, moveX: 0, moveY: 0, buttons: 0 }))).toThrow();
  });
});

describe("helpers", () => {
  it("compares sequence numbers across the wrap", () => {
    expect(seqNewer(1, 65535)).toBe(true);
    expect(seqNewer(65535, 1)).toBe(false);
    expect(seqNewer(5, 5)).toBe(false);
  });

  it("makes valid room codes", () => {
    for (let i = 0; i < 50; i++) expect(isRoomCode(randomRoomCode())).toBe(true);
    expect(isRoomCode("ABIO")).toBe(false);
    expect(isRoomCode("abcd")).toBe(false);
  });
});
