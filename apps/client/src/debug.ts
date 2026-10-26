import { getLevel } from "@lifeline/content";
import type { PeerMessage } from "@lifeline/protocol";
import { Button, createWorld, stepWorld, type Box, type HoseState, type PlayerId, type PlayerState, type World } from "@lifeline/sim";
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
    while (queue.length && queue[0]!.at <= now) queue.shift()!.deliver();
  }, 4);

  const send = (from: 0 | 1, deliver: () => void) => {
    const to = from === 0 ? 1 : 0;
    if (!ends[to].open) return;
    const now = simClock.now();
    const delay = Math.max(0, settings.latency + (Math.random() - 0.5) * 2 * settings.jitter);
    // Latency can fluctuate, but packets on a TCP connection never pass each other.
    const at = Math.max(now + delay, ends[from].lastAt + 1);
    ends[from].lastAt = at;
    queue.push({ at, deliver });
    queue.sort((a, b) => a.at - b.at);
  };

  const connect =
    (from: 0 | 1): Connect =>
    (events: NetEvents) => {
      ends[from].events = events;
      ends[from].open = true;
      ends[from].lastAt = 0;
      setTimeout(() => {
        events.onStatus?.("open");
        events.onWelcome({
          t: "welcome",
          role: from === 0 ? "host" : "guest",
          code: "DBUG",
          peerPresent: ends[from === 0 ? 1 : 0].open,
          save: null,
        });
        if (ends[from === 0 ? 1 : 0].open) ends[from === 0 ? 1 : 0].events?.onPeer(true);
      }, 0);
      return {
        get isOpen() {
          return ends[from].open;
        },
        send(data: ArrayBuffer | PeerMessage) {
          const to = from === 0 ? 1 : 0;
          if (data instanceof ArrayBuffer) {
            const copy = data.slice(0);
            send(from, () => ends[to].events?.onBinary(copy));
          } else {
            const copy = JSON.parse(JSON.stringify(data)) as PeerMessage;
            send(from, () => ends[to].events?.onControl(copy));
          }
        },
        close() {
          ends[from].open = false;
          ends[from === 0 ? 1 : 0].events?.onPeer(false);
          users--;
          if (users === 0) clearInterval(pump);
        },
      };
    };

  return [connect(0), connect(1)];
}

/** Simple platformer follower bot. GAME.md section 6.7. */
export function bot(id: PlayerId, settings: DebugSettings, getWorld: () => World, you: InputSource): InputSource {
  let jumpHold = 0;
  let stuck = 0;
  return {
    sample(): InputSample {
      if (settings.bot === "idle") return { moveX: 0, moveY: 0, buttons: 0 };
      if (settings.bot === "mirror") {
        const s = you.sample();
        return { moveX: -s.moveX, moveY: s.moveY, buttons: s.buttons };
      }
      const world = getWorld();
      const me = world.state.players[id];
      const partner = world.state.players[id === 0 ? 1 : 0];
      const target = partner.x;

      // Follow horizontally, keeping a short gap.
      let goalX = target;
      let slack = 1.0;
      let climb = false;

      // If the partner is on a higher platform, find a ledge on the way up.
      if (partner.y > me.y + 0.8) {
        const gap = (x: number, s: Box) => (x < s.minX ? s.minX - x : x > s.maxX ? x - s.maxX : 0);
        // Candidate platforms you can reach from here.
        const steps = world.solids
          .filter((s) => s.maxY > me.y && s.maxY <= me.y + 2.2)
          .sort((a, b) => gap(me.x, a) - gap(me.x, b));
        const step = steps[0];
        if (step) {
          goalX = Math.max(step.minX + 0.3, Math.min(step.maxX - 0.3, me.x));
          slack = 0.2;
          const edge = gap(me.x, step);
          const dir = Math.sign(goalX - me.x);
          const ahead = me.x + dir * 0.6;
          const supported = world.solids.some((s) => s.maxY === me.y && ahead >= s.minX && ahead <= s.maxX);
          climb = edge > 0 && (edge < 1.4 || !supported);
        }
      }
      const moveX = Math.abs(goalX - me.x) > slack ? Math.sign(goalX - me.x) : 0;
      stuck = moveX !== 0 && me.grounded && Math.abs(me.vx) < 0.5 ? stuck + 1 : 0;
      if (jumpHold > 0) jumpHold--;
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

  rebuild() {
    this.teardown();
    this.build();
  }

  get localId(): PlayerId {
    return this.settings.controlled;
  }

  get world(): World {
    return this.solo?.world ?? this.host!.world;
  }

  get localState(): PlayerState {
    if (this.guest && this.settings.controlled === 1) return this.guest.stats.own;
    return this.world.state.players[this.settings.controlled];
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

  hoseView(): HoseState {
    return this.world.state.hose;
  }

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
