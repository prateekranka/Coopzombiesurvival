import { getLevel } from "@lifeline/content";
import type { PeerMessage, Role } from "@lifeline/protocol";
import { Button, createWorld, stepWorld, type Box, type PlayerId, type World } from "@lifeline/sim";
import type { InputSample, InputSource } from "./input";
import type { NetEvents } from "./net";
import {
  FixedTicker,
  GuestSession,
  HostSession,
  LEVEL_ID,
  frameFrom,
  lerpPlayer,
  simClock,
  snapshotOf,
  type Connect,
  type Session,
  type SessionStatus,
  type ViewPlayer,
} from "./session";

// Debug mode: play alone to tune the feel. You drive one player, a bot drives the other, and
// you can swap at any time. "Net sim" runs a real host and a real guest in this page over a
// fake link with latency, so you can feel prediction and corrections without a second iPad.

export type BotMode = "idle" | "follow" | "mirror";

export interface DebugSettings {
  net: boolean;
  controlled: PlayerId;
  bot: BotMode;
  /** One-way delay of the fake link, ms. */
  latency: number;
  /** Extra random delay, 0 to this many ms. Order is kept, as on a WebSocket. */
  jitter: number;
  /** Draw where the other side thinks each player is. */
  ghosts: boolean;
}

export const DEFAULT_DEBUG_SETTINGS: DebugSettings = {
  net: false,
  controlled: 0,
  bot: "follow",
  latency: 60,
  jitter: 20,
  ghosts: true,
};

/**
 * Two ends of an in-page link that behaves like the room relay, with delay. Delay is counted in
 * game time, so it stays right in slow motion and when stepping one tick at a time.
 */
function loopback(settings: DebugSettings): [Connect, Connect] {
  type End = { events?: NetEvents; open: boolean; lastAt: number };
  const ends: [End, End] = [
    { open: false, lastAt: 0 },
    { open: false, lastAt: 0 },
  ];
  const queue: { at: number; deliver: () => void }[] = [];
  let users = 2;
  const pump = setInterval(() => {
    const now = simClock.now();
    // Arrival times only grow per direction, but the two directions interleave.
    while (true) {
      const i = queue.findIndex((m) => m.at <= now);
      if (i < 0) break;
      queue.splice(i, 1)[0]!.deliver();
    }
  }, 4);

  const make = (me: 0 | 1, role: Role): Connect => (events) => {
    const self = ends[me];
    const peer = ends[me === 0 ? 1 : 0];
    self.events = events;
    queue.push({
      at: simClock.now(),
      deliver: () => {
        self.open = true;
        events.onStatus("open");
        events.onWelcome({ t: "welcome", role, code: "DBUG", peerPresent: peer.open, save: {} });
        if (peer.open) peer.events?.onPeer(true);
      },
    });
    return {
      get isOpen() {
        return self.open;
      },
      send(data: ArrayBuffer | PeerMessage) {
        if (!self.open) return;
        if (!(data instanceof ArrayBuffer) && data.t === "save") return;
        // Like a WebSocket, messages keep their order: never arrive before the previous one.
        const at = Math.max(peer.lastAt, simClock.now() + settings.latency + Math.random() * settings.jitter);
        peer.lastAt = at;
        queue.push({
          at,
          deliver: () => {
            if (!peer.open || !peer.events) return;
            if (data instanceof ArrayBuffer) peer.events.onBinary(data);
            else peer.events.onControl(data);
          },
        });
      },
      close() {
        self.open = false;
        if (--users === 0) clearInterval(pump);
      },
    };
  };
  return [make(0, "host"), make(1, "guest")];
}

/** Highest step the bot tries to jump onto, in metres. The default jump is 1.3 m. */
const REACH = 1.2;

/** Horizontal distance from x to a box, 0 when x is above it. */
const gap = (x: number, s: Box) => (x < s.minX ? s.minX - x : x > s.maxX ? x - s.maxX : 0);

/** A partner that stands still, follows you, or copies your input. */
function bot(id: PlayerId, settings: DebugSettings, truth: () => World, you: InputSource): InputSource {
  let jumpHold = 0;
  let stuck = 0;
  return {
    sample(): InputSample {
      if (settings.bot === "idle") return { moveX: 0, moveY: 0, buttons: 0 };
      if (settings.bot === "mirror") return you.sample();

      const world = truth();
      const me = world.state.players[id];
      const target = world.state.players[id === 0 ? 1 : 0];
      let goalX = target.x;
      let slack = 1.5;
      let climb = false;
      // You are higher: head for the nearest step it can jump onto, and jump at its edge.
      if (target.y > me.y + 0.5) {
        const step = world.solids
          .filter((s) => s.maxY > me.y + 0.3 && s.maxY <= me.y + REACH)
          .map((s) => ({ s, cost: gap(me.x, s) + gap(target.x, s) * 0.5 }))
          .sort((a, b) => a.cost - b.cost)[0]?.s;
        if (step) {
          goalX = Math.min(Math.max(target.x, step.minX + 0.5), step.maxX - 0.5);
          slack = 0.2;
          const edge = gap(me.x, step);
          climb = edge > 0 && edge < 1.4;
        }
      }
      const moveX = Math.abs(goalX - me.x) > slack ? Math.sign(goalX - me.x) : 0;
      stuck = moveX !== 0 && me.grounded && Math.abs(me.vx) < 0.5 ? stuck + 1 : 0;
      if (jumpHold > 0) jumpHold--;
      // Hold jump for a while for full height, then let go so the next press counts.
      else if (me.grounded && (stuck > 2 || climb)) jumpHold = 10;
      return { moveX, moveY: 0, buttons: jumpHold > 1 ? Button.Jump : 0 };
    },
  };
}

export class DebugSession implements Session {
  private solo: { world: World; prev: ViewPlayer[]; ticker: FixedTicker } | undefined;
  private host: HostSession | undefined;
  private guest: GuestSession | undefined;

  constructor(
    readonly settings: DebugSettings,
    private readonly you: InputSource,
  ) {
    this.build();
  }

  /** Rebuilds the game for the current settings, from the spawn points. */
  rebuild() {
    this.teardown();
    this.build();
  }

  get localId(): PlayerId {
    return this.settings.controlled;
  }

  /** The host's world: the truth. */
  get world(): World {
    return this.solo?.world ?? this.host!.world;
  }

  get guestStats() {
    return this.guest?.stats;
  }

  swap() {
    this.settings.controlled = this.settings.controlled === 0 ? 1 : 0;
  }

  view(now: number): ViewPlayer[] {
    if (this.solo) {
      const t = this.solo.ticker.alpha(now);
      return this.solo.world.state.players.map((p, i) => lerpPlayer(this.solo!.prev[i]!, p, t));
    }
    return this.settings.controlled === 0 ? this.host!.view(now) : this.guest!.view(now);
  }

  /** In net sim, where the other side has the players. */
  ghosts(): ViewPlayer[] {
    if (this.solo || !this.settings.ghosts) return [];
    if (this.settings.controlled === 1) return snapshotOf(this.host!.world.state.players);
    const own = this.guest!.stats.own;
    return [{ id: own.id, x: own.x, y: own.y, facing: own.facing }];
  }

  status(): SessionStatus {
    return { mode: "debug", net: "local", peer: true };
  }

  dispose() {
    this.teardown();
  }

  private sourceFor(id: PlayerId): InputSource {
    const partner = bot(id, this.settings, () => this.world, this.you);
    return { sample: () => (this.settings.controlled === id ? this.you : partner).sample() };
  }

  private build() {
    if (!this.settings.net) {
      const world = createWorld(getLevel(LEVEL_ID));
      const sources = [this.sourceFor(0), this.sourceFor(1)] as const;
      const solo = {
        world,
        prev: snapshotOf(world.state.players),
        ticker: new FixedTicker(() => {
          solo.prev = snapshotOf(world.state.players);
          stepWorld(world, [frameFrom(sources[0], 0), frameFrom(sources[1], 0)]);
        }),
      };
      this.solo = solo;
      return;
    }
    const [hostLink, guestLink] = loopback(this.settings);
    this.host = new HostSession("DBUG", this.sourceFor(0), "Wren", hostLink);
    this.guest = new GuestSession("DBUG", this.sourceFor(1), "Cass", guestLink);
  }

  private teardown() {
    this.solo?.ticker.stop();
    this.host?.dispose();
    this.guest?.dispose();
    this.solo = this.host = this.guest = undefined;
  }
}
