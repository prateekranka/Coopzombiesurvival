import { getLevel } from "@lifeline/content";
import {
  MsgType,
  decodeHose,
  decodeInput,
  decodeSnapshot,
  encodeHose,
  encodeInput,
  encodeSnapshot,
  messageType,
  seqNewer,
  type Snapshot,
} from "@lifeline/protocol";
import {
  DT,
  NO_INPUT,
  TICK_RATE,
  createWorld,
  stepPlayer,
  stepWorld,
  type HoseState,
  type InputFrame,
  type PlayerId,
  type PlayerState,
  type World,
} from "@lifeline/sim";
import type { InputSource } from "./input";
import { NetClient, type NetEvents, type NetStatus, type Transport } from "./net";

// The three ways to play: host (runs the sim), guest (predicts itself, interpolates the rest)
// and local (both players in one browser, no server). GAME.md section 10.
// Debug mode (debug.ts) builds on these with a bot partner and a simulated network.

const queryParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("level") : null;
export const LEVEL_ID = queryParam === "m1-harbour" || queryParam === "harbour" ? "m1-harbour" : "m0-test-room";

const TICK_MS = 1000 / TICK_RATE;
/** The guest shows the host's world this far in the past, in ticks (100 ms). */
const INTERP_DELAY_TICKS = 3;
const SNAPSHOT_BUFFER = 32;
const MAX_QUEUED_GUEST_INPUTS = 4;
/** Ticks run at once after a slow frame. Past this (half a second), the sim skips ahead. */
const MAX_CATCH_UP = 15;

export interface ViewPlayer {
  id: PlayerId;
  x: number;
  y: number;
  facing: 1 | -1;
  hp?: number;
  underwater?: boolean;
}

export interface SessionStatus {
  mode: "local" | "host" | "guest" | "debug";
  net: NetStatus | "local";
  peer: boolean;
  code?: string;
}

export interface Session {
  readonly world: World;
  /** The player this screen follows. */
  readonly localId: PlayerId;
  view(now: number): ViewPlayer[];
  hoseView?(): HoseState;
  status(): SessionStatus;
  dispose(): void;
}

/**
 * Shared by every ticker on the page, so debug mode can slow, pause and step the host and the
 * guest together. Normal play never changes it.
 */
class SimClock {
  private _scale = 1;
  private _paused = false;
  /** Each ticker runs one tick when this goes up while paused. */
  stepToken = 0;
  // Game time is real time scaled, frozen while paused, plus one tick per step.
  private base = 0;
  private realAt = performance.now();

  get scale() {
    return this._scale;
  }

  get paused() {
    return this._paused;
  }

  /** Game time in ms. Debug mode's fake link uses it, so latency follows slow motion and steps. */
  now(): number {
    return this._paused ? this.base : this.base + (performance.now() - this.realAt) * this._scale;
  }

  setScale(scale: number) {
    this.rebase();
    this._scale = scale;
  }

  setPaused(paused: boolean) {
    this.rebase();
    this._paused = paused;
  }

  step() {
    this.setPaused(true);
    this.base += TICK_MS;
    this.stepToken++;
  }

  private rebase() {
    this.base = this.now();
    this.realAt = performance.now();
  }
}

export const simClock = new SimClock();

export class FixedTicker {
  private acc = 0;
  private last = performance.now();
  private lastTickAt = this.last;
  private stepToken = simClock.stepToken;
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(step: () => void) {
    this.timer = setInterval(() => {
      const now = performance.now();
      const elapsed = now - this.last;
      this.last = now;
      if (simClock.paused) {
        this.acc = 0;
        if (this.stepToken !== simClock.stepToken) {
          this.stepToken = simClock.stepToken;
          step();
          this.lastTickAt = now - TICK_MS;
        }
        return;
      }
      this.stepToken = simClock.stepToken;
      this.acc += elapsed * simClock.scale;
      let steps = 0;
      while (this.acc >= TICK_MS && steps < MAX_CATCH_UP) {
        step();
        this.acc -= TICK_MS;
        steps++;
      }
      // After a long stall (a background tab), skip ahead instead of fast-forwarding.
      if (steps === MAX_CATCH_UP) this.acc = 0;
      if (steps > 0) this.lastTickAt = now - this.acc / simClock.scale;
    }, 4);
  }

  /** How far the render time is between the last two ticks, 0 to 1. */
  alpha(now: number): number {
    if (simClock.paused) return 1;
    return Math.min(1, Math.max(0, ((now - this.lastTickAt) * simClock.scale) / TICK_MS));
  }

  stop() {
    clearInterval(this.timer);
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function lerpPlayer(a: PlayerState | ViewPlayer, b: PlayerState | ViewPlayer, t: number): ViewPlayer {
  return {
    id: b.id,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    facing: b.facing,
    hp: (b as PlayerState).hp,
    underwater: (b as PlayerState).underwater,
  };
}

export const snapshotOf = (players: readonly PlayerState[]): ViewPlayer[] =>
  players.map((p) => ({ id: p.id, x: p.x, y: p.y, facing: p.facing, hp: p.hp, underwater: p.underwater }));

export function frameFrom(source: InputSource, seq: number): InputFrame {
  const s = source.sample();
  return { seq, moveX: s.moveX, moveY: s.moveY, buttons: s.buttons };
}

export class LocalSession implements Session {
  readonly world = createWorld(getLevel(LEVEL_ID));
  readonly localId: PlayerId = 0;
  private prev = snapshotOf(this.world.state.players);
  private readonly ticker: FixedTicker;

  constructor(sources: [InputSource, InputSource], levelId = LEVEL_ID) {
    if (levelId !== LEVEL_ID) {
      this.world = createWorld(getLevel(levelId));
      this.prev = snapshotOf(this.world.state.players);
    }
    this.ticker = new FixedTicker(() => {
      this.prev = snapshotOf(this.world.state.players);
      stepWorld(this.world, [frameFrom(sources[0], 0), frameFrom(sources[1], 0)]);
    });
  }

  view(now: number): ViewPlayer[] {
    const t = this.ticker.alpha(now);
    return this.world.state.players.map((p, i) => lerpPlayer(this.prev[i]!, p, t));
  }

  hoseView(): HoseState {
    return this.world.state.hose;
  }

  status(): SessionStatus {
    return { mode: "local", net: "local", peer: true };
  }

  dispose() {
    this.ticker.stop();
  }
}

export type Connect = (events: NetEvents) => Transport;

function newSave(): string {
  return JSON.stringify({ version: 1, chapter: 0, level: LEVEL_ID, scrap: 0 });
}

export class HostSession implements Session {
  readonly world = createWorld(getLevel(LEVEL_ID));
  readonly localId: PlayerId = 0;
  private prev = snapshotOf(this.world.state.players);
  private readonly ticker: FixedTicker;
  private readonly net: Transport;
  private guestInputs: InputFrame[] = [];
  private lastGuestInput: InputFrame = NO_INPUT;
  private ack = 0;
  private peer = false;
  private netStatus: NetStatus = "connecting";

  constructor(
    readonly code: string,
    source: InputSource,
    name: string,
    connect: Connect = (events) => new NetClient(code, "host", events),
    levelId = LEVEL_ID,
  ) {
    if (levelId !== LEVEL_ID) {
      this.world = createWorld(getLevel(levelId));
      this.prev = snapshotOf(this.world.state.players);
    }
    this.net = connect({
      onWelcome: (msg) => {
        this.peer = msg.peerPresent;
        this.net.send({ t: "hello", name });
        if (!msg.save) this.net.send({ t: "save", data: newSave() });
      },
      onPeer: (present) => {
        this.peer = present;
        if (present) this.net.send({ t: "hello", name });
        else {
          this.guestInputs = [];
          this.lastGuestInput = NO_INPUT;
        }
      },
      onControl: () => {},
      onBinary: (buf) => {
        if (messageType(buf) !== MsgType.Input) return;
        this.guestInputs.push(decodeInput(buf));
        // If the guest runs ahead, drop old inputs so its lag does not grow.
        if (this.guestInputs.length > MAX_QUEUED_GUEST_INPUTS) this.guestInputs.shift();
      },
      onStatus: (s) => (this.netStatus = s),
    });

    this.ticker = new FixedTicker(() => {
      this.prev = snapshotOf(this.world.state.players);
      const next = this.guestInputs.shift();
      if (next) {
        this.ack = next.seq;
        this.lastGuestInput = next;
      }
      stepWorld(this.world, [frameFrom(source, 0), this.peer ? this.lastGuestInput : NO_INPUT]);
      // 20 snapshots a second: send on 2 of every 3 ticks.
      if (this.world.state.tick % 3 !== 0) {
        this.net.send(encodeSnapshot(this.world.state, this.ack));
        this.net.send(encodeHose(this.world.state.hose));
      }
    });
  }

  view(now: number): ViewPlayer[] {
    const t = this.ticker.alpha(now);
    return this.world.state.players.map((p, i) => lerpPlayer(this.prev[i]!, p, t));
  }

  hoseView(): HoseState {
    return this.world.state.hose;
  }

  status(): SessionStatus {
    return { mode: "host", net: this.netStatus, peer: this.peer, code: this.code };
  }

  dispose() {
    this.ticker.stop();
    this.net.close();
  }
}

export class GuestSession implements Session {
  readonly world = createWorld(getLevel(LEVEL_ID));
  readonly localId: PlayerId = 1;
  private own: PlayerState = { ...this.world.state.players[1] };
  private prevOwn: ViewPlayer = { ...this.own };
  private history: InputFrame[] = [];
  private seq = 0;
  private snapshots: Snapshot[] = [];
  private latestAt = 0;
  private synced = false;
  /** Visual-only offset that hides prediction corrections, decays to zero. */
  private correction = { x: 0, y: 0 };
  private lastView = 0;
  private peer = false;
  private netStatus: NetStatus = "connecting";
  private readonly ticker: FixedTicker;
  private readonly net: Transport;

  constructor(
    readonly code: string,
    source: InputSource,
    name: string,
    connect: Connect = (events) => new NetClient(code, "guest", events),
    levelId = LEVEL_ID,
  ) {
    if (levelId !== LEVEL_ID) {
      this.world = createWorld(getLevel(levelId));
      this.own = { ...this.world.state.players[1] };
      this.prevOwn = { ...this.own };
    }
    this.net = connect({
      onWelcome: (msg) => {
        this.peer = msg.peerPresent;
        this.net.send({ t: "hello", name });
      },
      onPeer: (present) => {
        this.peer = present;
        if (present) this.net.send({ t: "hello", name });
        // A new host starts a fresh sim, so forget the old one.
        else this.synced = false;
      },
      onControl: () => {},
      onBinary: (buf) => {
        const type = messageType(buf);
        if (type === MsgType.Snapshot) this.onSnapshot(decodeSnapshot(buf));
        else if (type === MsgType.Hose) {
          const snap = decodeHose(buf);
          this.world.state.hose.pressure = snap.pressure;
          this.world.state.hose.activeLength = snap.activeLength;
          this.world.state.hose.snags = snap.snags;
          this.world.state.hose.warning = snap.warning;
          this.world.state.hose.suffocating = snap.suffocating;
          this.world.state.hose.nodes = snap.nodes;
          this.world.state.hose.signal = snap.signal;
        }
      },
      onStatus: (s) => (this.netStatus = s),
    });

    this.ticker = new FixedTicker(() => {
      if (!this.synced || !this.net.isOpen) return;
      this.seq = (this.seq + 1) & 0xffff;
      const frame = frameFrom(source, this.seq);
      this.history.push(frame);
      this.prevOwn = { ...this.own };
      stepPlayer(this.own, frame, this.world.solids, this.world.level.water?.level);
      this.net.send(encodeInput(frame));
    });
  }

  /** For the debug overlay. */
  get stats() {
    return {
      unacked: this.history.length,
      correction: Math.hypot(this.correction.x, this.correction.y),
      own: this.own,
    };
  }

  private onSnapshot(s: Snapshot) {
    const last = this.snapshots.at(-1);
    if (last && s.tick <= last.tick) {
      // The host restarted its sim (a new host): start over.
      if (last.tick - s.tick < 30) return;
      this.snapshots = [];
      this.synced = false;
    }
    this.snapshots.push(s);
    if (this.snapshots.length > SNAPSHOT_BUFFER) this.snapshots.shift();
    this.latestAt = simClock.now();
    this.world.state.tick = s.tick;

    const auth = s.players.find((p) => p.id === this.localId);
    if (!auth) return;
    this.history = this.history.filter((h) => seqNewer(h.seq, s.ack));
    if (!this.synced) {
      this.synced = true;
      this.history = [];
      this.own = { ...auth };
      this.prevOwn = { ...auth };
      return;
    }
    const before = { x: this.own.x, y: this.own.y };
    this.own = { ...auth };
    for (const h of this.history) stepPlayer(this.own, h, this.world.solids, this.world.level.water?.level);
    this.correction.x += before.x - this.own.x;
    this.correction.y += before.y - this.own.y;
    // A big error is a teleport, not jitter: snap.
    if (Math.hypot(this.correction.x, this.correction.y) > 2) this.correction = { x: 0, y: 0 };
    this.world.state.players[this.localId] = this.own;
  }

  view(now: number): ViewPlayer[] {
    const dt = this.lastView ? (now - this.lastView) / 1000 : 0;
    this.lastView = now;
    const decay = Math.exp(-dt * 12);
    this.correction.x *= decay;
    this.correction.y *= decay;

    const ownView = lerpPlayer(this.prevOwn, this.own, this.ticker.alpha(now));
    ownView.x += this.correction.x;
    ownView.y += this.correction.y;

    const latest = this.snapshots.at(-1);
    if (!latest) return [ownView];
    // Game time, not frame time, so slow motion and stepping stay right in debug mode.
    const renderTick = latest.tick + (simClock.now() - this.latestAt) / 1000 / DT - INTERP_DELAY_TICKS;
    const others: ViewPlayer[] = [];
    for (const p of latest.players) {
      if (p.id === this.localId) continue;
      others.push(this.interpolate(p.id, renderTick) ?? p);
    }
    return [...others, ownView].sort((a, b) => a.id - b.id);
  }

  hoseView(): HoseState {
    return this.world.state.hose;
  }

  private interpolate(id: PlayerId, tick: number): ViewPlayer | undefined {
    for (let i = this.snapshots.length - 1; i > 0; i--) {
      const b = this.snapshots[i]!;
      const a = this.snapshots[i - 1]!;
      if (tick < a.tick || tick > b.tick) continue;
      const pa = a.players.find((p) => p.id === id);
      const pb = b.players.find((p) => p.id === id);
      if (!pa || !pb) return pb ?? pa;
      const t = b.tick === a.tick ? 0 : (tick - a.tick) / (b.tick - a.tick);
      return lerpPlayer(pa, pb, Math.max(0, Math.min(1, t)));
    }
    return this.snapshots.at(-1)?.players.find((p) => p.id === id);
  }

  status(): SessionStatus {
    return { mode: "guest", net: this.netStatus, peer: this.peer, code: this.code };
  }

  dispose() {
    this.ticker.stop();
    this.net.close();
  }
}
