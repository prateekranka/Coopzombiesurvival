import type { Box } from "./collision";
import { Button, type InputFrame } from "./input";
import type { PlayerId, PlayerState } from "./player";
import { DT, tuning } from "./tuning";

export interface Vec2D {
  x: number;
  y: number;
}

export interface LineSignal {
  senderId: PlayerId;
  pulls: number;
  /** Progress along the rope: 0 at sender, 1 at recipient. */
  progress: number;
}

export interface ReceivedSignal {
  recipientId: PlayerId;
  pulls: number;
  text: string;
  tick: number;
}

export const SIGNAL_MESSAGES: Record<number, string> = {
  1: "OK",
  2: "Give slack",
  3: "Take up slack",
  4: "Pull me up",
};

export const HOSE_NODE_COUNT = 16;
export const MAX_HOSE_SNAGS = 3;

export interface HoseState {
  /** Maximum possible length when fully paid out (metres). Default 30. */
  maxLength: number;
  /** Currently paid out active tether length (metres). */
  activeLength: number;
  /** Air pressure: 0 to 100 psi. Safe band is 35 to 75. */
  pressure: number;
  /** Cooldown ticks between pump strokes. */
  pumpCooldown: number;
  /** Verlet particle positions along the hose: node 0 is Anchor, node N-1 is Diver. */
  nodes: Vec2D[];
  /** Previous positions for Verlet velocity calculation. */
  oldNodes: Vec2D[];
  /** Number of active snags on solid corners (0 to 3). */
  snags: number;
  /** Positions of corners where the hose is currently snagged. */
  snagPoints: Vec2D[];
  /** Warning state: pressure < 35. */
  warning: boolean;
  /** Suffocation state: pressure < 15 (takes 10 HP/s damage). */
  suffocating: boolean;
  /** Active line signal wave travelling along the hose. */
  signal?: LineSignal;
  /** Most recent signal received at either end. */
  lastReceivedSignal?: ReceivedSignal;

  // Internal signal pull accumulator state
  _pullAccum: [number, number]; // [player0, player1]
  _pullTimer: [number, number];
  _prevSignalHeld: [boolean, boolean];
  _prevUseHeld: [boolean, boolean];
}

export function createHose(ax: number, ay: number, dx: number, dy: number, length = 30): HoseState {
  const nodes: Vec2D[] = [];
  const oldNodes: Vec2D[] = [];

  for (let i = 0; i < HOSE_NODE_COUNT; i++) {
    const t = i / (HOSE_NODE_COUNT - 1);
    const x = ax + (dx - ax) * t;
    const y = ay + (dy - ay) * t;
    nodes.push({ x, y });
    oldNodes.push({ x, y });
  }

  return {
    maxLength: length,
    activeLength: length,
    pressure: 60,
    pumpCooldown: 0,
    nodes,
    oldNodes,
    snags: 0,
    snagPoints: [],
    warning: false,
    suffocating: false,
    _pullAccum: [0, 0],
    _pullTimer: [0, 0],
    _prevSignalHeld: [false, false],
    _prevUseHeld: [false, false],
  };
}

/**
 * Pumps air into the hose. Anchor action.
 * Returns true if a pump stroke occurred.
 */
export function pumpHose(hose: HoseState): boolean {
  if (hose.pumpCooldown > 0) return false;
  // GAME.md 6.6: each snag -30% flow; at 3 snags, no air flows.
  const flow = hose.snags >= 3 ? 0 : Math.max(0, 1 - 0.3 * hose.snags);
  hose.pressure = Math.min(100, hose.pressure + tuning.pumpAirPerStroke * flow);
  hose.pumpCooldown = 8; // ~0.27s cooldown
  return true;
}

/**
 * Triggers a line signal directly (used in tests or scripted triggers).
 */
export function sendSignal(hose: HoseState, senderId: PlayerId, pulls: number): void {
  hose.signal = {
    senderId,
    pulls: Math.max(1, Math.min(4, pulls)),
    progress: 0,
  };
}

function solveBoxCollision(node: Vec2D, oldNode: Vec2D, solids: readonly Box[]) {
  for (const s of solids) {
    if (node.x >= s.minX && node.x <= s.maxX && node.y >= s.minY && node.y <= s.maxY) {
      const left = node.x - s.minX;
      const right = s.maxX - node.x;
      const bottom = node.y - s.minY;
      const top = s.maxY - node.y;
      const min = Math.min(left, right, bottom, top);

      if (min === top) {
        node.y = s.maxY;
        // Friction on top surface
        oldNode.x += (node.x - oldNode.x) * 0.4;
      } else if (min === left) {
        node.x = s.minX;
      } else if (min === right) {
        node.x = s.maxX;
      } else {
        node.y = s.minY;
      }
    }
  }
}

function distToSegment(c: Vec2D, a: Vec2D, b: Vec2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-6) return Math.hypot(c.x - a.x, c.y - a.y);
  const t = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / l2));
  return Math.hypot(c.x - (a.x + t * dx), c.y - (a.y + t * dy));
}

function detectSnags(hose: HoseState, solids: readonly Box[]): void {
  const snags: Vec2D[] = [];
  const N = HOSE_NODE_COUNT;

  for (const s of solids) {
    const corners: Vec2D[] = [
      { x: s.minX, y: s.minY },
      { x: s.minX, y: s.maxY },
      { x: s.maxX, y: s.minY },
      { x: s.maxX, y: s.maxY },
    ];

    for (const c of corners) {
      let nearCorner = false;
      for (let i = 0; i < N - 1; i++) {
        if (distToSegment(c, hose.nodes[i]!, hose.nodes[i + 1]!) < 0.65) {
          nearCorner = true;
          break;
        }
      }

      if (nearCorner) {
        // Find nearest node to corner
        let minDist = Infinity;
        let minNodeIdx = 0;
        for (let i = 0; i < N; i++) {
          const d = Math.hypot(hose.nodes[i]!.x - c.x, hose.nodes[i]!.y - c.y);
          if (d < minDist) {
            minDist = d;
            minNodeIdx = i;
          }
        }

        const pIdx = Math.max(0, minNodeIdx - 1);
        const nIdx = Math.min(N - 1, minNodeIdx + 1);
        const prev = hose.nodes[pIdx]!;
        const curr = hose.nodes[minNodeIdx]!;
        const next = hose.nodes[nIdx]!;

        const d1x = curr.x - prev.x;
        const d1y = curr.y - prev.y;
        const d2x = next.x - curr.x;
        const d2y = next.y - curr.y;
        const len1 = Math.hypot(d1x, d1y);
        const len2 = Math.hypot(d2x, d2y);

        let bends = false;
        if (len1 > 0.05 && len2 > 0.05) {
          const dot = (d1x * d2x + d1y * d2y) / (len1 * len2);
          bends = dot < 0.95; // Angle bend > ~18 degrees
        } else {
          bends = true;
        }

        if (bends && !snags.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 0.3)) {
          snags.push(c);
        }
      }
    }
  }

  hose.snagPoints = snags;
  hose.snags = Math.min(MAX_HOSE_SNAGS, snags.length);
}

/**
 * Steps the air hose simulation for one tick:
 * - Verlet rope integration & distance constraints
 * - Corner snag detection
 * - Air pressure consumption & pumping
 * - Line signal pulses
 * - Diver tether limits
 */
export function stepHose(
  hose: HoseState,
  anchor: PlayerState,
  diver: PlayerState,
  inputs: readonly [InputFrame?, InputFrame?],
  solids: readonly Box[],
  waterLevel?: number,
  tick = 0,
): void {
  if (hose.pumpCooldown > 0) hose.pumpCooldown--;

  const anchorInput = inputs[1];
  const diverInput = inputs[0];

  // 1. Check pump inputs (Anchor pressing Button.Use)
  if (anchorInput) {
    const useHeld = (anchorInput.buttons & Button.Use) !== 0;
    if (useHeld && !hose._prevUseHeld[1]) {
      pumpHose(hose);
    }
    hose._prevUseHeld[1] = useHeld;

    // Winch controls: holding Interact reels in or pays out
    const interactHeld = (anchorInput.buttons & Button.Interact) !== 0;
    if (interactHeld) {
      if (anchorInput.moveY < -0.2) {
        // Reel in (pulls snags free)
        const straightDist = Math.hypot(diver.x - anchor.x, diver.y - anchor.y);
        hose.activeLength = Math.max(straightDist + 0.5, hose.activeLength - 3.0 * DT);
      } else if (anchorInput.moveY > 0.2) {
        // Pay out
        hose.activeLength = Math.min(hose.maxLength, hose.activeLength + 3.0 * DT);
      }
    }
  }

  // 2. Air pressure consumption & hazards
  const diverDepth = waterLevel !== undefined ? Math.max(0, waterLevel - diver.y) : 0;
  const consumption = (tuning.airUseBase + (diverDepth > 0 ? tuning.airUsePerDepth * diverDepth : 0)) * DT;
  hose.pressure = Math.max(0, hose.pressure - consumption);

  hose.warning = hose.pressure < 35;
  hose.suffocating = hose.pressure < 15;

  // Suffocation damage (10 HP/s)
  if (hose.suffocating) {
    diver.hp = Math.max(0, diver.hp - 10 * DT);
  }

  // Blow-up trigger: above 85 psi underwater
  if (hose.pressure > 85 && diver.underwater && diver.blowUpTicks === 0) {
    diver.blowUpTicks = 60; // 2 seconds at 30 Hz
  }

  // 3. Process Line Signal button taps (1 to 4 pulls)
  for (const id of [0, 1] as const) {
    const input = id === 0 ? diverInput : anchorInput;
    if (!input) continue;

    const signalHeld = (input.buttons & Button.Signal) !== 0;
    if (signalHeld && !hose._prevSignalHeld[id]) {
      hose._pullAccum[id] = Math.min(4, hose._pullAccum[id] + 1);
      hose._pullTimer[id] = 12; // 0.4s tap window
    }
    hose._prevSignalHeld[id] = signalHeld;

    if (hose._pullTimer[id] > 0) {
      hose._pullTimer[id]--;
      if (hose._pullTimer[id] === 0 && hose._pullAccum[id] > 0) {
        sendSignal(hose, id, hose._pullAccum[id]);
        hose._pullAccum[id] = 0;
      }
    }
  }

  // Advance active signal
  if (hose.signal) {
    // Pulse travels along hose: ~25 m/s
    const speed = 25;
    hose.signal.progress += (speed / Math.max(5, hose.activeLength)) * DT;
    if (hose.signal.progress >= 1.0) {
      const recipientId = hose.signal.senderId === 0 ? 1 : 0;
      hose.lastReceivedSignal = {
        recipientId,
        pulls: hose.signal.pulls,
        text: SIGNAL_MESSAGES[hose.signal.pulls] ?? "Signal",
        tick,
      };
      hose.signal = undefined;
    }
  }

  // 4. Verlet rope simulation
  const anchorPos: Vec2D = { x: anchor.x, y: anchor.y + 0.8 };
  const diverPos: Vec2D = { x: diver.x, y: diver.y + 1.0 };

  const N = HOSE_NODE_COUNT;
  const segRest = hose.activeLength / (N - 1);

  // Integrate free nodes (1 to N-2)
  for (let i = 1; i < N - 1; i++) {
    const node = hose.nodes[i]!;
    const old = hose.oldNodes[i]!;
    const vx = (node.x - old.x) * 0.92;
    const vy = (node.y - old.y) * 0.92;

    old.x = node.x;
    old.y = node.y;

    const submerged = waterLevel !== undefined && node.y < waterLevel;
    const g = submerged ? 3.0 : 12.0;

    node.x += vx;
    node.y += vy - g * DT * DT;

    // Apply transverse wave displacement if signal is passing through this node
    if (hose.signal) {
      const nodeProgress = hose.signal.senderId === 1 ? i / (N - 1) : 1 - i / (N - 1);
      const distToWave = Math.abs(nodeProgress - hose.signal.progress);
      if (distToWave < 0.1) {
        const wave = Math.sin((distToWave / 0.1) * Math.PI) * 0.18;
        node.y += wave;
      }
    }
  }

  // Pin ends
  hose.nodes[0]!.x = anchorPos.x;
  hose.nodes[0]!.y = anchorPos.y;
  hose.nodes[N - 1]!.x = diverPos.x;
  hose.nodes[N - 1]!.y = diverPos.y;

  // Relaxation passes
  for (let iter = 0; iter < 5; iter++) {
    for (let i = 0; i < N - 1; i++) {
      const a = hose.nodes[i]!;
      const b = hose.nodes[i + 1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);

      if (dist > segRest && dist > 1e-4) {
        const diff = (dist - segRest) / dist;
        const cx = dx * diff * 0.5;
        const cy = dy * diff * 0.5;

        if (i > 0) {
          a.x += cx;
          a.y += cy;
        }
        if (i + 1 < N - 1) {
          b.x -= cx;
          b.y -= cy;
        }
      }
    }

    // Collide with solids
    for (let i = 1; i < N - 1; i++) {
      solveBoxCollision(hose.nodes[i]!, hose.oldNodes[i]!, solids);
    }
  }

  // Detect snags around solid corners
  detectSnags(hose, solids);

  // 5. Tether constraint: clamp diver if distance along hose exceeds activeLength
  let totalDist = 0;
  for (let i = 0; i < N - 1; i++) {
    totalDist += Math.hypot(hose.nodes[i + 1]!.x - hose.nodes[i]!.x, hose.nodes[i + 1]!.y - hose.nodes[i]!.y);
  }

  if (totalDist > hose.activeLength) {
    const prev = hose.nodes[N - 2]!;
    const toPrevX = prev.x - diver.x;
    const toPrevY = prev.y - (diver.y + 1.0);
    const toPrevLen = Math.hypot(toPrevX, toPrevY);
    if (toPrevLen > 1e-4) {
      const over = totalDist - hose.activeLength;
      // Pull diver towards previous node
      diver.x += (toPrevX / toPrevLen) * over * 0.5;
      if (diver.vx * toPrevX < 0) diver.vx = 0;
    }
  }
}
