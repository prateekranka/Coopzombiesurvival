import { Button } from "@lifeline/sim";

// Input sources. Each one reports the current stick and buttons; sessions turn that into
// numbered InputFrames once per tick. GAME.md section 7.

export interface InputSample {
  moveX: number;
  moveY: number;
  buttons: number;
}

export interface InputSource {
  sample(): InputSample;
}

const held = new Set<string>();
const isTextField = (t: EventTarget | null) =>
  t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && (t.type === "text" || t.type === "search"));
window.addEventListener("keydown", (e) => {
  if (isTextField(e.target)) return;
  held.add(e.code);
});
window.addEventListener("keyup", (e) => held.delete(e.code));
window.addEventListener("blur", () => held.clear());

export interface KeyMap {
  left: string[];
  right: string[];
  up: string[];
  down: string[];
  jump: string[];
  attack: string[];
  use: string[];
  interact: string[];
  signal: string[];
}

export const KEYS_WASD: KeyMap = {
  left: ["KeyA"],
  right: ["KeyD"],
  up: ["KeyW"],
  down: ["KeyS"],
  jump: ["Space", "KeyW"],
  attack: ["KeyJ"],
  use: ["KeyK"],
  interact: ["KeyE"],
  signal: ["KeyQ"],
};

export const KEYS_ARROWS: KeyMap = {
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  jump: ["ArrowUp", "Enter"],
  attack: ["Period"],
  use: ["Slash"],
  interact: ["ShiftRight"],
  signal: ["Comma"],
};

export const KEYS_ALL: KeyMap = Object.fromEntries(
  Object.keys(KEYS_WASD).map((k) => [k, [...KEYS_WASD[k as keyof KeyMap], ...KEYS_ARROWS[k as keyof KeyMap]]]),
) as unknown as KeyMap;

const any = (codes: string[]) => codes.some((c) => held.has(c));

export function keyboard(map: KeyMap): InputSource {
  return {
    sample() {
      return {
        moveX: (any(map.right) ? 1 : 0) - (any(map.left) ? 1 : 0),
        moveY: (any(map.up) ? 1 : 0) - (any(map.down) ? 1 : 0),
        buttons:
          (any(map.jump) ? Button.Jump : 0) |
          (any(map.attack) ? Button.Attack : 0) |
          (any(map.use) ? Button.Use : 0) |
          (any(map.interact) ? Button.Interact : 0) |
          (any(map.signal) ? Button.Signal : 0),
      };
    },
  };
}

const DEADZONE = 0.2;

/** Standard-mapping gamepad: left stick, A jump, X attack, B use, Y interact, RB signal. */
export function gamepad(index: number): InputSource {
  return {
    sample() {
      const pad = navigator.getGamepads?.()[index];
      if (!pad) return { moveX: 0, moveY: 0, buttons: 0 };
      const ax = pad.axes[0] ?? 0;
      const ay = -(pad.axes[1] ?? 0);
      const pressed = (i: number) => pad.buttons[i]?.pressed ?? false;
      const dpadX = (pressed(15) ? 1 : 0) - (pressed(14) ? 1 : 0);
      return {
        moveX: Math.abs(ax) > DEADZONE ? ax : dpadX,
        moveY: Math.abs(ay) > DEADZONE ? ay : 0,
        buttons:
          (pressed(0) ? Button.Jump : 0) |
          (pressed(2) ? Button.Attack : 0) |
          (pressed(1) ? Button.Use : 0) |
          (pressed(3) ? Button.Interact : 0) |
          (pressed(5) ? Button.Signal : 0),
      };
    },
  };
}

export function firstGamepadIndex(): number | undefined {
  const pads = navigator.getGamepads?.() ?? [];
  return pads.find((p) => p?.connected)?.index;
}

/** Combines sources: the strongest stick wins and buttons are merged. */
export function combine(...sources: InputSource[]): InputSource {
  return {
    sample() {
      const out: InputSample = { moveX: 0, moveY: 0, buttons: 0 };
      for (const s of sources) {
        const v = s.sample();
        if (Math.abs(v.moveX) > Math.abs(out.moveX)) out.moveX = v.moveX;
        if (Math.abs(v.moveY) > Math.abs(out.moveY)) out.moveY = v.moveY;
        out.buttons |= v.buttons;
      }
      return out;
    },
  };
}

const STICK_RADIUS = 64;

/**
 * On-screen touch controls: a floating stick on the left half and a button cluster on the
 * right. GAME.md section 7.
 */
export function touchControls(root: HTMLElement): InputSource & { show(): void } {
  const layer = document.createElement("div");
  layer.className = "touch";
  layer.hidden = true;
  layer.innerHTML = `
    <div class="stick-zone"><div class="stick-base"><div class="stick-knob"></div></div></div>
    <div class="buttons">
      <button class="btn btn-signal" data-btn="${Button.Signal}" aria-label="Signal">Signal</button>
      <button class="btn btn-use" data-btn="${Button.Use}" aria-label="Use">Use</button>
      <button class="btn btn-attack" data-btn="${Button.Attack}" aria-label="Attack">Hit</button>
      <button class="btn btn-jump" data-btn="${Button.Jump}" aria-label="Jump">Jump</button>
    </div>`;
  root.append(layer);

  const zone = layer.querySelector<HTMLElement>(".stick-zone")!;
  const base = layer.querySelector<HTMLElement>(".stick-base")!;
  const knob = layer.querySelector<HTMLElement>(".stick-knob")!;
  let stickId: number | undefined;
  let originX = 0;
  let originY = 0;
  let moveX = 0;
  let moveY = 0;

  zone.addEventListener("pointerdown", (e) => {
    if (stickId !== undefined) return;
    stickId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    originX = e.clientX;
    originY = e.clientY;
    base.style.transform = `translate(${originX}px, ${originY}px)`;
    knob.style.transform = "translate(0px, 0px)";
    base.classList.add("active");
  });
  zone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== stickId) return;
    let dx = e.clientX - originX;
    let dy = e.clientY - originY;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    moveX = dx / STICK_RADIUS;
    moveY = -dy / STICK_RADIUS;
  });
  const release = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    stickId = undefined;
    moveX = moveY = 0;
    base.classList.remove("active");
  };
  zone.addEventListener("pointerup", release);
  zone.addEventListener("pointercancel", release);

  let buttons = 0;
  for (const el of layer.querySelectorAll<HTMLButtonElement>(".btn")) {
    const bit = Number(el.dataset.btn);
    const down = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      buttons |= bit;
      el.classList.add("down");
    };
    const up = () => {
      buttons &= ~bit;
      el.classList.remove("down");
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
  }

  return {
    show() {
      layer.hidden = false;
    },
    sample() {
      return { moveX: Math.abs(moveX) > DEADZONE ? moveX : 0, moveY, buttons };
    },
  };
}

export const isTouchDevice = () => matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
