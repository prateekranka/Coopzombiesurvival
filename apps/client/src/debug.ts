import { getLevel } from "@lifeline/content";
import type { PeerMessage, Role } from "@lifeline/protocol";
import { Button, createWorld, stepWorld, type PlayerId, type World } from "@lifeline/sim";
import type { InputSample, InputSource } from "./input";
import type { NetEvents } from "./net";
import {
  FixedTicker,
  GuestSession,
  HostSession,
  LEVEL_ID,
  frameFrom,
  lerpPlayer,
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

/** Two ends of an in-page link that behaves like the room relay, with delay. */
function loopback(settings: DebugSettings): [Connect, Connect] {
  const ends: { events?: NetEvents; open: boolean; lastAt: number }[] = [
    { open: false, lastAt: 0 },
    { open: false, lastAt: 0 },
  ];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  const make = (me: 0 | 1, role: Role): Connect => (events) => {
    const self = ends[me]!;
    const peer = ends[1 - me]!;
    self.events = events;
    later(0, () => {
      self.open = true;
      events.onStatus("open");
      events.onWelcome({ t: "welcome", role, code: "DBUG", peerPresent: peer.open, save: {} });
      if (peer.open) peer.events?.onPeer(true);
    });
    return {
      get isOpen() {
        return self.open;
      },
      send(data: ArrayBuffer | PeerMessage) {
        if (!self.open) return;
        if (!(data instanceof ArrayBuffer) && data.t === "save") return;
        const now = performance.now();
        const at = Math.max(peer.lastAt, now + settings.latency + Math.random() * settings.jitter);
        peer.lastAt = at;
        later(at - now, () => {
          if (!peer.open || !peer.events) return;
          if (data instanceof ArrayBuffer) peer.events.onBinary(data);
          else peer.events.onControl(data);
        });
      },
      close() {
        self.open = false;
        for (const t of timers) clearTimeout(t);
        timers.clear();
      },
    };
  };
  return [make(0, "host"), make(1, "guest")];
}

/** A partner that stands still, follows you, or copies your input. */
function bot(id: PlayerId, settings: DebugSettings, truth: () => World, you: InputSource): InputSource {
  let jumpHold = 0;
  let stuck = 0;
  return {
    sample(): InputSample {
      if (settings.bot === "idle") return { moveX: 0, moveY: 0, buttons: 0 };
      if (settings.bot === "mirror") return you.sample();

      const players = truth().state.players;
      const me = players[id];
      const target = players[id === 0 ? 1 : 0];
      const dx = target.x - me.x;
      const moveX = Math.abs(dx) > 1.5 ? Math.sign(dx) : 0;
      stuck = moveX !== 0 && me.grounded && Math.abs(me.vx) < 0.5 ? stuck + 1 : 0;
      const below = target.y > me.y + 0.8 && Math.abs(dx) < 4;
      if (jumpHold > 0) jumpHold--;
      // Hold jump for a while for full height, then let go so the next press counts.
      else if (me.grounded && (stuck > 2 || below)) jumpHold = 10;
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
