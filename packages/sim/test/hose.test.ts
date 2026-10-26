import { getLevel } from "@lifeline/content";
import { describe, expect, it } from "vitest";
import {
  Button,
  DEFAULT_TUNING,
  DT,
  HOSE_NODE_COUNT,
  createHose,
  createPlayer,
  createWorld,
  pumpHose,
  resetTuning,
  sendSignal,
  stepHose,
  stepPlayer,
  stepWorld,
  tuning,
  type InputFrame,
} from "../src";

const input = (moveX = 0, buttons = 0, moveY = 0, seq = 0): InputFrame => ({ seq, moveX, moveY, buttons });

describe("hose initialization & nodes", () => {
  it("initializes with 16 nodes connecting anchor and diver", () => {
    const hose = createHose(0, 0, 15, 0, 30);
    expect(hose.nodes.length).toBe(HOSE_NODE_COUNT);
    expect(hose.nodes[0]!.x).toBe(0);
    expect(hose.nodes[HOSE_NODE_COUNT - 1]!.x).toBe(15);
    expect(hose.pressure).toBe(60);
    expect(hose.warning).toBe(false);
    expect(hose.suffocating).toBe(false);
  });
});

describe("underwater mechanics", () => {
  it("slows player to underwater speed and disables jump", () => {
    resetTuning();
    const p = createPlayer(0, 5, 2);
    // Water level is at y = 5, player is at y = 2 (underwater)
    stepPlayer(p, input(1, Button.Jump), [], 5);
    expect(p.underwater).toBe(true);
    // Jump should not have engaged
    expect(p.vy).toBeLessThanOrEqual(0);
    // Acceleration towards underwater speed (1.6 m/s)
    for (let i = 0; i < 20; i++) stepPlayer(p, input(1), [], 5);
    expect(p.vx).toBeCloseTo(DEFAULT_TUNING.underwaterSpeed, 1);
  });

  it("consumes air faster at greater depth", () => {
    const anchor = createPlayer(1, 10, 10);
    const shallowDiver = createPlayer(0, 10, 8);
    const deepDiver = createPlayer(0, 10, 2);

    const shallowHose = createHose(10, 10, 10, 8, 30);
    const deepHose = createHose(10, 10, 10, 2, 30);

    const waterLevel = 10;
    // Step 30 ticks (1 second)
    for (let i = 0; i < 30; i++) {
      stepHose(shallowHose, anchor, shallowDiver, [], [], waterLevel);
      stepHose(deepHose, anchor, deepDiver, [], [], waterLevel);
    }

    const shallowUsed = 60 - shallowHose.pressure;
    const deepUsed = 60 - deepHose.pressure;

    // Shallow depth = 2m (1.0 + 0.12 * 2 = 1.24 psi/s)
    // Deep depth = 8m (1.0 + 0.12 * 8 = 1.96 psi/s)
    expect(deepUsed).toBeGreaterThan(shallowUsed);
    expect(shallowUsed).toBeCloseTo(1.24, 1);
    expect(deepUsed).toBeCloseTo(1.96, 1);
  });
});

describe("air pump & snags", () => {
  it("adds +5 psi per pump stroke with cooldown", () => {
    const hose = createHose(0, 0, 5, 0, 30);
    hose.pressure = 50;
    const pumped = pumpHose(hose);
    expect(pumped).toBe(true);
    expect(hose.pressure).toBe(55);

    // Immediate second pump fails due to cooldown
    expect(pumpHose(hose)).toBe(false);
    expect(hose.pressure).toBe(55);
  });

  it("reduces airflow by 30% per snag, and stops air at 3 snags", () => {
    const hose = createHose(0, 0, 5, 0, 30);
    hose.pressure = 50;
    hose.snags = 1;
    pumpHose(hose);
    // 5 * (1 - 0.3) = 3.5 psi added
    expect(hose.pressure).toBeCloseTo(53.5);

    hose.pumpCooldown = 0;
    hose.snags = 3;
    pumpHose(hose);
    // 3 snags = 0 flow
    expect(hose.pressure).toBeCloseTo(53.5);
  });

  it("detects snags when hose wraps around solid corners", () => {
    const anchor = createPlayer(1, 0, 6);
    const diver = createPlayer(0, 10, 1);
    const hose = createHose(0, 6, 10, 1, 13);
    const solids = [
      { minX: 0, minY: 0, maxX: 12, maxY: 1 },
      { minX: 4, minY: 1, maxX: 6, maxY: 4 },
    ];

    for (let i = 0; i < 60; i++) {
      stepHose(hose, anchor, diver, [], solids, undefined, i);
    }

    expect(hose.snagPoints.length).toBeGreaterThan(0);
    expect(hose.snags).toBeGreaterThanOrEqual(1);
  });

  it("reeling in reduces active length and helps clear snags", () => {
    const anchor = createPlayer(1, 0, 2);
    const diver = createPlayer(0, 5, 2);
    const hose = createHose(0, 2, 5, 2, 30);
    expect(hose.activeLength).toBe(30);

    // Anchor holds interact and stick down (reel in)
    const reelInput = input(0, Button.Interact, -1);
    for (let i = 0; i < 30; i++) {
      stepHose(hose, anchor, diver, [input(), reelInput], [], undefined, i);
    }
    // 3 m/s reel in for 1 second = 3 metres shorter
    expect(hose.activeLength).toBeCloseTo(27, 0.5);
  });
});

describe("hazards & blow-up", () => {
  it("warns below 35 psi and suffocates below 15 psi", () => {
    const anchor = createPlayer(1, 0, 10);
    const diver = createPlayer(0, 0, 2);
    const hose = createHose(0, 10, 0, 2, 30);

    hose.pressure = 34;
    stepHose(hose, anchor, diver, [], [], 10);
    expect(hose.warning).toBe(true);
    expect(hose.suffocating).toBe(false);

    hose.pressure = 14;
    const hpBefore = diver.hp;
    // Step for 1 second (30 ticks)
    for (let i = 0; i < 30; i++) {
      stepHose(hose, anchor, diver, [], [], 10);
    }
    expect(hose.suffocating).toBe(true);
    // 10 HP/s damage
    expect(diver.hp).toBeCloseTo(hpBefore - 10, 0.5);
  });

  it("triggers blow-up when pressure exceeds 85 psi underwater", () => {
    const anchor = createPlayer(1, 0, 10);
    const diver = createPlayer(0, 0, 2);
    const hose = createHose(0, 10, 0, 2, 30);
    hose.pressure = 86;
    diver.underwater = true;

    stepHose(hose, anchor, diver, [], [], 10);
    expect(diver.blowUpTicks).toBe(60);

    // Diver floats rapidly up during blow-up
    stepPlayer(diver, input(), [], 10);
    expect(diver.vy).toBe(DEFAULT_TUNING.blowUpSpeed);
    expect(diver.y).toBeGreaterThan(2);
  });
});

describe("line signals", () => {
  it("transmits signal wave along hose to recipient", () => {
    const anchor = createPlayer(1, 0, 2);
    const diver = createPlayer(0, 10, 2);
    const hose = createHose(0, 2, 10, 2, 30);

    // Send 2 pulls ("Give slack") from diver (id 0)
    sendSignal(hose, 0, 2);
    expect(hose.signal).toBeDefined();
    expect(hose.signal!.pulls).toBe(2);
    expect(hose.signal!.senderId).toBe(0);

    // Step until signal wave arrives at anchor (recipient id 1)
    let arrived = false;
    for (let i = 0; i < 60; i++) {
      stepHose(hose, anchor, diver, [], [], undefined, i);
      if (hose.lastReceivedSignal) {
        arrived = true;
        break;
      }
    }

    expect(arrived).toBe(true);
    expect(hose.lastReceivedSignal!.recipientId).toBe(1);
    expect(hose.lastReceivedSignal!.pulls).toBe(2);
    expect(hose.lastReceivedSignal!.text).toBe("Give slack");
  });
});

describe("tether limit", () => {
  it("prevents diver from walking beyond the active hose length", () => {
    const world = createWorld(getLevel("m0-test-room"));
    world.state.hose.activeLength = 5.0; // Short 5-metre tether
    world.state.players[1].x = 4.0; // Anchor stationary at x=4
    world.state.players[0].x = 4.0;

    // Diver tries to sprint right towards x=20
    for (let i = 0; i < 90; i++) {
      stepWorld(world, [input(1), input(0)]);
    }

    const dist = Math.abs(world.state.players[0].x - world.state.players[1].x);
    // Should be clamped to roughly active length
    expect(dist).toBeLessThanOrEqual(5.6);
  });
});
