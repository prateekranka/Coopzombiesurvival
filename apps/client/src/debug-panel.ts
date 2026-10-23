import { DEFAULT_TUNING, resetTuning, setTuning, tuning, type Tuning } from "@lifeline/sim";
import { DEFAULT_DEBUG_SETTINGS, type BotMode, type DebugSession, type DebugSettings } from "./debug";
import type { Renderer } from "./render";
import { simClock } from "./session";

// The debug panel: tuning sliders, time controls, bot and network settings, and a live
// readout. Everything you change is kept in this browser, so it survives a reload.

const STORE_KEY = "lifeline.debug";

interface Stored {
  settings?: Partial<DebugSettings>;
  tuning?: Partial<Tuning>;
  view?: { hitboxes?: boolean; zoom?: number; overlay?: boolean; open?: boolean };
}

function load(): Stored {
  try {
    return (JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as Stored) ?? {};
  } catch {
    return {};
  }
}

function save(data: Stored) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {
    // Private mode: settings last until reload.
  }
}

/** Settings to start debug mode with, and the saved tuning applied to the sim. */
export function loadDebugSettings(): DebugSettings {
  const stored = load();
  setTuning(stored.tuning ?? {});
  return { ...DEFAULT_DEBUG_SETTINGS, ...stored.settings };
}

const SLIDERS: { key: keyof Tuning; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: "walkSpeed", label: "Walk speed", min: 1, max: 12, step: 0.1, unit: "m/s" },
  { key: "groundAccel", label: "Ground accel", min: 5, max: 200, step: 1, unit: "m/s²" },
  { key: "airAccel", label: "Air accel", min: 0, max: 200, step: 1, unit: "m/s²" },
  { key: "jumpHeight", label: "Jump height", min: 0.3, max: 4, step: 0.05, unit: "m" },
  { key: "gravity", label: "Gravity", min: 5, max: 60, step: 0.5, unit: "m/s²" },
  { key: "jumpCut", label: "Short-hop cut", min: 0, max: 1, step: 0.05, unit: "×" },
  { key: "maxFallSpeed", label: "Max fall speed", min: 5, max: 60, step: 1, unit: "m/s" },
  { key: "coyoteTicks", label: "Coyote time", min: 0, max: 15, step: 1, unit: "ticks" },
  { key: "jumpBufferTicks", label: "Jump buffer", min: 0, max: 15, step: 1, unit: "ticks" },
];

const NAMES = ["Wren", "Cass"] as const;

export function createDebugPanel(root: HTMLElement, session: DebugSession, renderer: Renderer) {
  const stored = load();
  const view = { hitboxes: false, zoom: 1, overlay: true, open: false, ...stored.view };
  renderer.debug.hitboxes = view.hitboxes;
  renderer.debug.zoom = view.zoom;
  const s = session.settings;

  const persist = () => {
    const changed: Partial<Tuning> = {};
    for (const k of Object.keys(DEFAULT_TUNING) as (keyof Tuning)[]) {
      if (tuning[k] !== DEFAULT_TUNING[k]) changed[k] = tuning[k];
    }
    save({ settings: { ...s }, tuning: changed, view });
    return changed;
  };

  const wrap = document.createElement("div");
  wrap.className = "debug";
  wrap.innerHTML = `
    <button class="debug-toggle" type="button" aria-expanded="false">Debug</button>
    <pre class="debug-overlay" aria-live="off"></pre>
    <div class="debug-panel" hidden>
      <section>
        <h3>Play</h3>
        <div class="row">
          <button type="button" data-act="swap"></button>
          <button type="button" data-act="reset" title="R">Reset</button>
        </div>
        <label>Partner bot
          <select data-set="bot">
            <option value="follow">Follows you</option>
            <option value="idle">Stands still</option>
            <option value="mirror">Copies you</option>
          </select>
        </label>
      </section>
      <section>
        <h3>Time</h3>
        <div class="row">
          <button type="button" data-act="pause" title="P"></button>
          <button type="button" data-act="step" title="N">Step</button>
        </div>
        <div class="row speeds">
          ${[0.1, 0.25, 0.5, 1].map((v) => `<button type="button" data-speed="${v}">${v}×</button>`).join("")}
        </div>
      </section>
      <section>
        <h3>Network</h3>
        <label class="check"><input type="checkbox" data-set="net" /> Simulate two iPads</label>
        <div class="net-only">
          <label>Latency <output data-out="latency"></output>
            <input type="range" min="0" max="400" step="10" data-set="latency" /></label>
          <label>Jitter <output data-out="jitter"></output>
            <input type="range" min="0" max="200" step="5" data-set="jitter" /></label>
          <label class="check"><input type="checkbox" data-set="ghosts" /> Show the other side's view</label>
        </div>
      </section>
      <section>
        <h3>Feel</h3>
        <div class="sliders"></div>
        <div class="row">
          <button type="button" data-act="copy">Copy values</button>
          <button type="button" data-act="defaults">Defaults</button>
        </div>
        <textarea class="copy-out" readonly hidden rows="4"></textarea>
      </section>
      <section>
        <h3>View</h3>
        <label class="check"><input type="checkbox" data-view="hitboxes" /> Hitboxes (H)</label>
        <label class="check"><input type="checkbox" data-view="overlay" /> Readout</label>
        <label>Zoom <output data-out="zoom"></output>
          <input type="range" min="0.5" max="2.5" step="0.05" data-view="zoom" /></label>
      </section>
      <p class="keys">Keys: Tab swap · P pause · N step · R reset · H hitboxes · \` panel</p>
    </div>`;
  root.append(wrap);

  const q = <T extends Element>(sel: string) => wrap.querySelector<T>(sel)!;
  const panel = q<HTMLElement>(".debug-panel");
  const toggle = q<HTMLButtonElement>(".debug-toggle");
  const overlay = q<HTMLElement>(".debug-overlay");
  const copyOut = q<HTMLTextAreaElement>(".copy-out");

  const setOpen = (open: boolean) => {
    view.open = open;
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    persist();
  };
  toggle.addEventListener("click", () => setOpen(!view.open));
  setOpen(view.open);

  // Feel sliders.
  const sliderBox = q<HTMLElement>(".sliders");
  const sliderInputs = new Map<keyof Tuning, { input: HTMLInputElement; out: HTMLOutputElement; row: HTMLElement }>();
  for (const def of SLIDERS) {
    const row = document.createElement("label");
    row.innerHTML = `<span>${def.label} <output></output></span><input type="range" min="${def.min}" max="${def.max}" step="${def.step}" />`;
    const input = row.querySelector("input")!;
    const out = row.querySelector("output")!;
    input.addEventListener("input", () => {
      setTuning({ [def.key]: Number(input.value) });
      syncSliders();
      persist();
    });
    sliderBox.append(row);
    sliderInputs.set(def.key, { input, out, row });
  }
  const syncSliders = () => {
    for (const def of SLIDERS) {
      const { input, out, row } = sliderInputs.get(def.key)!;
      input.value = String(tuning[def.key]);
      out.textContent = `${tuning[def.key]} ${def.unit}`;
      row.classList.toggle("changed", tuning[def.key] !== DEFAULT_TUNING[def.key]);
    }
  };

  // Settings controls.
  const bindSetting = <K extends keyof DebugSettings>(key: K, rebuild: boolean) => {
    const input = q<HTMLInputElement | HTMLSelectElement>(`[data-set="${key}"]`);
    const read = () => {
      if (input instanceof HTMLInputElement && input.type === "checkbox") return input.checked;
      if (input instanceof HTMLInputElement && input.type === "range") return Number(input.value);
      return input.value;
    };
    input.addEventListener("input", () => {
      (s as unknown as Record<string, unknown>)[key] = read();
      if (rebuild) session.rebuild();
      sync();
      persist();
    });
  };
  bindSetting("bot", false);
  bindSetting("net", true);
  bindSetting("latency", false);
  bindSetting("jitter", false);
  bindSetting("ghosts", false);

  for (const key of ["hitboxes", "overlay"] as const) {
    const input = q<HTMLInputElement>(`[data-view="${key}"]`);
    input.addEventListener("input", () => {
      view[key] = input.checked;
      renderer.debug.hitboxes = view.hitboxes;
      sync();
      persist();
    });
  }
  const zoom = q<HTMLInputElement>('[data-view="zoom"]');
  zoom.addEventListener("input", () => {
    view.zoom = Number(zoom.value);
    renderer.debug.zoom = view.zoom;
    sync();
    persist();
  });

  const actions: Record<string, () => void> = {
    swap: () => session.swap(),
    reset: () => session.rebuild(),
    pause: () => (simClock.paused = !simClock.paused),
    step: () => {
      simClock.paused = true;
      simClock.stepToken++;
    },
    defaults: () => {
      resetTuning();
      syncSliders();
      copyOut.hidden = true;
    },
    copy: () => {
      const text = JSON.stringify(persist(), null, 2);
      copyOut.value = text === "{}" ? "All values are the defaults." : text;
      copyOut.hidden = false;
      copyOut.select();
      navigator.clipboard?.writeText(text).catch(() => {});
    },
  };
  // Give the keys back to the game after each change.
  wrap.addEventListener("change", (e) => (e.target as HTMLElement).blur());
  wrap.addEventListener("pointerup", (e) => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLButtonElement || (t instanceof HTMLInputElement && t.type !== "range")) setTimeout(() => t.blur());
  });

  wrap.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-act], [data-speed]");
    if (!el) return;
    if (el.dataset.speed) simClock.scale = Number(el.dataset.speed);
    else actions[el.dataset.act!]?.();
    sync();
    persist();
  });

  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    if (e.target instanceof HTMLInputElement && e.target.type === "text") return;
    const act: Record<string, () => void> = {
      Tab: actions.swap!,
      KeyP: actions.pause!,
      KeyN: actions.step!,
      KeyR: actions.reset!,
      Backquote: () => setOpen(!view.open),
      KeyH: () => {
        view.hitboxes = !view.hitboxes;
        renderer.debug.hitboxes = view.hitboxes;
      },
    };
    const fn = act[e.code];
    if (!fn) return;
    e.preventDefault();
    fn();
    sync();
    persist();
  });

  function sync() {
    q<HTMLButtonElement>('[data-act="swap"]').textContent = `You: ${NAMES[s.controlled]} (swap)`;
    q<HTMLButtonElement>('[data-act="pause"]').textContent = simClock.paused ? "Play" : "Pause";
    for (const b of wrap.querySelectorAll<HTMLButtonElement>("[data-speed]")) {
      b.classList.toggle("on", Number(b.dataset.speed) === simClock.scale);
    }
    q<HTMLSelectElement>('[data-set="bot"]').value = s.bot;
    q<HTMLInputElement>('[data-set="net"]').checked = s.net;
    q<HTMLInputElement>('[data-set="latency"]').value = String(s.latency);
    q<HTMLInputElement>('[data-set="jitter"]').value = String(s.jitter);
    q<HTMLInputElement>('[data-set="ghosts"]').checked = s.ghosts;
    q<HTMLOutputElement>('[data-out="latency"]').textContent = `${s.latency} ms each way`;
    q<HTMLOutputElement>('[data-out="jitter"]').textContent = `+0–${s.jitter} ms`;
    q<HTMLElement>(".net-only").hidden = !s.net;
    q<HTMLInputElement>('[data-view="hitboxes"]').checked = view.hitboxes;
    q<HTMLInputElement>('[data-view="overlay"]').checked = view.overlay;
    zoom.value = String(view.zoom);
    q<HTMLOutputElement>('[data-out="zoom"]').textContent = `${view.zoom}×`;
    overlay.hidden = !view.overlay;
    syncSliders();
  }
  sync();

  let frames = 0;
  let fps = 0;
  let fpsAt = performance.now();

  return {
    /** Call once per frame. */
    update(now: number) {
      frames++;
      if (now - fpsAt >= 500) {
        fps = Math.round((frames * 1000) / (now - fpsAt));
        frames = 0;
        fpsAt = now;
      }
      if (!view.overlay) return;
      const p = session.world.state.players[s.controlled];
      const f = (n: number) => n.toFixed(2).padStart(6);
      const lines = [
        `${fps} fps · tick ${session.world.state.tick} · ${simClock.paused ? "PAUSED" : `${simClock.scale}×`} · ${renderer.backend}`,
        `${NAMES[s.controlled]}  x${f(p.x)}  y${f(p.y)}`,
        `vx${f(p.vx)}  vy${f(p.vy)}  ${p.grounded ? "ground" : "air   "}`,
        `coyote ${p.coyote}  buffer ${p.jumpBuffer}`,
      ];
      const g = session.guestStats;
      if (s.net && g) lines.push(`net: ${g.unacked} unacked inputs · correction ${g.correction.toFixed(3)} m`);
      overlay.textContent = lines.join("\n");
    },
  };
}
