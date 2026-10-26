// First-pass tuning values. GAME.md sections 6.1, 6.2, and 6.6.

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;

// Placeholder capsule size, in metres.
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.6;

export interface Tuning {
  /** m/s² */
  gravity: number;
  /** m/s */
  walkSpeed: number;
  /** m/s: GAME.md 6.2 under water (heavy boots) */
  underwaterSpeed: number;
  /** m/s²: submerged gravity for heavy boots */
  underwaterGravity: number;
  /** m */
  jumpHeight: number;
  /** m/s */
  maxFallSpeed: number;
  /** m/s² */
  groundAccel: number;
  /** m/s² */
  airAccel: number;
  /** Ticks in which a jump still works after leaving the ground. Forgiving on touch screens. */
  coyoteTicks: number;
  /** Ticks in which a pressed jump fires on landing. */
  jumpBufferTicks: number;
  /** Upward speed kept each tick after jump is released, 0 to 1. Lower gives shorter hops. */
  jumpCut: number;
  /** m/s: rapid uncontrolled float upward during blow-up (>85 psi) */
  blowUpSpeed: number;
  /** m: standard hose length */
  maxHoseLength: number;
  /** psi/s: base air use */
  airUseBase: number;
  /** psi/s per metre depth */
  airUsePerDepth: number;
  /** psi added per pump stroke */
  pumpAirPerStroke: number;
}

export const DEFAULT_TUNING: Readonly<Tuning> = Object.freeze({
  gravity: 20,
  walkSpeed: 4.5,
  underwaterSpeed: 1.6,
  underwaterGravity: 10,
  jumpHeight: 1.3,
  maxFallSpeed: 24,
  groundAccel: 45,
  airAccel: 22,
  coyoteTicks: 3,
  jumpBufferTicks: 3,
  jumpCut: 0.6,
  blowUpSpeed: 6.0,
  maxHoseLength: 30,
  airUseBase: 1.0,
  airUsePerDepth: 0.12,
  pumpAirPerStroke: 5.0,
});

/**
 * The live values the sim reads. Only the debug mode changes them: the host and the guest
 * must use the same values, or prediction drifts.
 */
export const tuning: Tuning = { ...DEFAULT_TUNING };

export function setTuning(values: Partial<Tuning>): void {
  for (const key of Object.keys(DEFAULT_TUNING) as (keyof Tuning)[]) {
    const v = values[key];
    if (typeof v === "number" && Number.isFinite(v)) tuning[key] = v;
  }
}

export function resetTuning(): void {
  Object.assign(tuning, DEFAULT_TUNING);
}

export const jumpSpeed = (t: Tuning = tuning) => Math.sqrt(2 * t.gravity * t.jumpHeight);
