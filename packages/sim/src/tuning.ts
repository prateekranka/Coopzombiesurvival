// First-pass tuning values. GAME.md sections 6.1 and 6.2.

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;

export const GRAVITY = 20;
export const WALK_SPEED = 4.5;
export const JUMP_HEIGHT = 1.3;
export const JUMP_SPEED = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
export const MAX_FALL_SPEED = 24;

export const GROUND_ACCEL = 45;
export const AIR_ACCEL = 22;

// Forgiveness windows, in ticks, so jumps feel fair on touch screens.
export const COYOTE_TICKS = 3;
export const JUMP_BUFFER_TICKS = 3;

// Placeholder capsule size, in metres.
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.6;
