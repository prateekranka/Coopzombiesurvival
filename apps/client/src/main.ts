import "./style.css";
import { getLevel } from "@lifeline/content";
import type { Role } from "@lifeline/protocol";
import { isRoomCode } from "@lifeline/protocol";
import { resetTuning, type PlayerId } from "@lifeline/sim";
import { DebugSession } from "./debug";
import { createDebugPanel, loadDebugSettings } from "./debug-panel";
import {
  KEYS_ALL,
  KEYS_ARROWS,
  KEYS_WASD,
  combine,
  firstGamepadIndex,
  gamepad,
  isTouchDevice,
  keyboard,
  touchControls,
  type InputSource,
} from "./input";
import { createRoom } from "./net";
import { Renderer } from "./render";
import { GuestSession, HostSession, LEVEL_ID, LocalSession, type Session } from "./session";

// Title screen, lobby and HUD. GAME.md sections 7 and 8.

const NAMES: Record<PlayerId, string> = { 0: "Wren", 1: "Cass" };
const LAST_ROOM_KEY = "lifeline.lastRoom";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ui = document.querySelector<HTMLElement>("#ui")!;
const params = new URLSearchParams(location.search);

let session: Session | undefined;
let debugPanel: ReturnType<typeof createDebugPanel> | undefined;
let renderer: Renderer | undefined;
const touch = touchControls(ui);
const pad = (): InputSource => ({ sample: () => gamepad(firstGamepadIndex() ?? 0).sample() });

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function readLastRoom(): { code: string; role: Role } | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_ROOM_KEY) ?? "null") as { code: string; role: Role } | null;
    return v && isRoomCode(v.code) ? v : undefined;
  } catch {
    return undefined;
  }
}

function writeLastRoom(code: string, role: Role) {
  try {
    localStorage.setItem(LAST_ROOM_KEY, JSON.stringify({ code, role }));
  } catch {
    // Private mode: rejoin by code still works.
  }
}

/** iOS plays sound only after a tap, so the title screen unlocks audio. GAME.md section 8. */
function unlockAudio() {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, 22050);
  src.connect(ctx.destination);
  src.start();
  void ctx.resume();
}

function showTitle() {
  const screen = el("div", "screen title");
  screen.append(el("h1", "logo", "LIFELINE"), el("p", "tagline", "Two iPads. One lifeline."), el("p", "tap", "Tap to start"));
  screen.addEventListener(
    "pointerup",
    () => {
      unlockAudio();
      document.documentElement.requestFullscreen?.().catch(() => {});
      screen.remove();
      showLobby();
    },
    { once: true },
  );
  ui.append(screen);
}

function showLobby(error?: string) {
  const screen = el("div", "screen lobby");
  const card = el("div", "card");
  card.append(el("h2", "", "Play together"));

  const host = el("button", "big primary", "Host a room");
  host.addEventListener("click", async () => {
    host.disabled = true;
    try {
      const code = await createRoom();
      screen.remove();
      start("host", code);
    } catch (e) {
      host.disabled = false;
      status.textContent = e instanceof Error ? e.message : "Could not reach the server.";
    }
  });

  const joinRow = el("form", "join");
  const input = el("input", "code");
  input.maxLength = 4;
  input.placeholder = "CODE";
  input.autocomplete = "off";
  input.autocapitalize = "characters";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Room code");
  input.value = params.get("room")?.toUpperCase() ?? "";
  input.addEventListener("input", () => (input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "")));
  const join = el("button", "big", "Join");
  join.type = "submit";
  joinRow.append(input, join);
  joinRow.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isRoomCode(input.value)) {
      status.textContent = "Type the 4-letter code from the other iPad.";
      return;
    }
    screen.remove();
    start("guest", input.value);
  });

  card.append(host, joinRow);

  const last = readLastRoom();
  if (last) {
    const rejoin = el("button", "small", `Rejoin ${last.code} as ${last.role === "host" ? "host" : "guest"}`);
    rejoin.addEventListener("click", () => {
      screen.remove();
      start(last.role, last.code);
    });
    card.append(rejoin);
  }

  const solo = el("button", "small", "Play alone (debug)");
  solo.addEventListener("click", () => {
    screen.remove();
    start("debug");
  });
  card.append(solo);

  const local = el("button", "small", "Both players on this device");
  local.addEventListener("click", () => {
    screen.remove();
    start("local");
  });
  card.append(local);

  const status = el("p", "status", error ?? "");
  card.append(status);
  screen.append(card);
  ui.append(screen);
}

async function start(mode: Role | "local" | "debug", code?: string) {
  renderer ??= await Renderer.create(canvas, getLevel(LEVEL_ID));

  const touchOn = isTouchDevice();
  if (touchOn) touch.show();

  // Only debug mode changes the feel values. Real games use the defaults on both iPads.
  if (mode !== "debug") resetTuning();

  if (mode === "debug") {
    const debug = new DebugSession(loadDebugSettings(), combine(keyboard(KEYS_ALL), pad(), touch));
    session = debug;
    debugPanel = createDebugPanel(ui, debug, renderer);
  } else if (mode === "local") {
    // Player 1 uses WASD, player 2 uses a gamepad or the arrow keys. GAME.md section 10.
    session = new LocalSession([combine(keyboard(KEYS_WASD), touch), combine(pad(), keyboard(KEYS_ARROWS))]);
  } else {
    const source = combine(keyboard(KEYS_ALL), pad(), touch);
    writeLastRoom(code!, mode);
    session =
      mode === "host" ? new HostSession(code!, source, NAMES[0]) : new GuestSession(code!, source, NAMES[1]);
  }
  showHud();
}

const hud = {
  root: el("div", "hud"),
  room: el("div", "pill room"),
  partner: el("div", "pill partner"),
  objective: el("div", "objective", "Find each other. Jump on the boxes."),
  arrow: el("div", "partner-arrow"),
};

function showHud() {
  hud.root.append(hud.room, hud.partner, hud.objective, hud.arrow);
  ui.append(hud.root);
}

function updateHud() {
  if (!session || !renderer) return;
  const s = session.status();
  const partnerId: PlayerId = session.localId === 0 ? 1 : 0;
  hud.room.hidden = !s.code;
  if (s.code) hud.room.textContent = `Room ${s.code}`;

  let state: string;
  if (s.mode === "debug") state = "bot";
  else if (s.net === "local") state = "on this device";
  else if (s.net === "reconnecting" || s.net === "connecting") state = "connecting…";
  else if (s.net === "closed") state = "disconnected";
  else state = s.peer ? "linked" : s.mode === "host" ? "waiting to join" : "waiting for host";
  hud.partner.textContent = `${NAMES[partnerId]} · ${state}`;
  hud.partner.dataset.player = String(partnerId);
  hud.partner.dataset.linked = String(s.peer && (s.net === "open" || s.net === "local"));
}

function updatePartnerArrow(view: ReturnType<Session["view"]>) {
  if (!session || !renderer) return;
  const me = view.find((p) => p.id === session!.localId);
  const other = view.find((p) => p.id !== session!.localId);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!me || !other) {
    hud.arrow.hidden = true;
    return;
  }
  const pos = renderer.worldToScreen(other.x, other.y + 0.8);
  const margin = 40;
  const onScreen = pos.x > 0 && pos.x < w && pos.y > 0 && pos.y < h;
  hud.arrow.hidden = onScreen;
  if (onScreen) return;
  const cx = w / 2;
  const cy = h / 2;
  const angle = Math.atan2(pos.y - cy, pos.x - cx);
  const scale = Math.min((w / 2 - margin) / Math.abs(Math.cos(angle) || 1e-6), (h / 2 - margin) / Math.abs(Math.sin(angle) || 1e-6));
  hud.arrow.style.transform = `translate(${cx + Math.cos(angle) * scale}px, ${cy + Math.sin(angle) * scale}px)`;
  hud.arrow.dataset.player = String(other.id);
  hud.arrow.innerHTML = `<span class="tip" style="transform: rotate(${angle}rad)"></span><span class="dist">${Math.round(Math.hypot(other.x - me.x, other.y - me.y))} m</span>`;
}

function frame(now: number) {
  if (session && renderer) {
    const view = session.view(now);
    renderer.render(view, session.localId, session instanceof DebugSession ? session.ghosts() : []);
    debugPanel?.update(now);
    updateHud();
    updatePartnerArrow(view);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Stop iOS from scrolling, zooming or selecting while you play.
// The debug panel still scrolls.
document.addEventListener(
  "touchmove",
  (e) => {
    if (!(e.target as Element).closest?.(".debug-panel")) e.preventDefault();
  },
  { passive: false },
);
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());

// Test and debug hook. Read only.
Object.defineProperty(window, "__lifeline", {
  value: {
    get status() {
      return session?.status();
    },
    get players() {
      return session?.view(performance.now());
    },
    get authority() {
      return session?.world.state.players.map((p) => ({ id: p.id, x: p.x, y: p.y }));
    },
    get tick() {
      return session?.world.state.tick;
    },
    get backend() {
      return renderer?.backend;
    },
  },
});

const auto = params.get("auto");
const room = params.get("room")?.toUpperCase();
if (params.has("debug")) start("debug");
else if (params.has("local")) start("local");
else if (auto === "host") createRoom().then((code) => start("host", code), () => showLobby("Could not reach the server."));
else if (auto === "join" && room && isRoomCode(room)) start("guest", room);
else showTitle();
