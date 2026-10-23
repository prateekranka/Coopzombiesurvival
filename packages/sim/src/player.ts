import { overlaps, type Box } from "./collision";
import { Button, type InputFrame } from "./input";
import { DT, PLAYER_HEIGHT, PLAYER_WIDTH, jumpSpeed, tuning } from "./tuning";

export type PlayerId = 0 | 1;

export interface PlayerState {
  id: PlayerId;
  /** Feet centre, in metres. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  /** Jump was held last tick, so a held button does not jump again. */
  jumpHeld: boolean;
  /** Ticks left in which a jump still works after leaving the ground. */
  coyote: number;
  /** Ticks left in which a pressed jump fires on landing. */
  jumpBuffer: number;
}

export function createPlayer(id: PlayerId, x: number, y: number): PlayerState {
  return { id, x, y, vx: 0, vy: 0, facing: 1, grounded: false, jumpHeld: false, coyote: 0, jumpBuffer: 0 };
}

export function playerBox(p: { x: number; y: number }): Box {
  const h = PLAYER_WIDTH / 2;
  return { minX: p.x - h, minY: p.y, maxX: p.x + h, maxY: p.y + PLAYER_HEIGHT };
}

function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}

/**
 * Advances one player by one tick. Pure apart from mutating `p`, so the guest can run the
 * same code for prediction and replay.
 */
export function stepPlayer(p: PlayerState, input: InputFrame, solids: readonly Box[]): void {
  const moveX = Math.max(-1, Math.min(1, input.moveX));
  const accel = p.grounded ? tuning.groundAccel : tuning.airAccel;
  p.vx = approach(p.vx, moveX * tuning.walkSpeed, accel * DT);
  if (moveX > 0.1) p.facing = 1;
  else if (moveX < -0.1) p.facing = -1;

  const jumpDown = (input.buttons & Button.Jump) !== 0;
  if (jumpDown && !p.jumpHeld) p.jumpBuffer = tuning.jumpBufferTicks;
  else if (p.jumpBuffer > 0) p.jumpBuffer--;
  p.jumpHeld = jumpDown;

  if (p.grounded) p.coyote = tuning.coyoteTicks;
  else if (p.coyote > 0) p.coyote--;

  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = jumpSpeed();
    p.jumpBuffer = 0;
    p.coyote = 0;
  }
  // Release early for a short hop.
  if (!jumpDown && p.vy > 0) p.vy *= tuning.jumpCut;

  p.vy = Math.max(p.vy - tuning.gravity * DT, -tuning.maxFallSpeed);

  // Move one axis at a time and push out of solids.
  const dirX = Math.sign(p.vx);
  p.x += p.vx * DT;
  for (const s of solids) {
    if (dirX === 0 || !overlaps(playerBox(p), s)) continue;
    p.x = dirX > 0 ? s.minX - PLAYER_WIDTH / 2 : s.maxX + PLAYER_WIDTH / 2;
    p.vx = 0;
  }

  const falling = p.vy <= 0;
  p.grounded = false;
  p.y += p.vy * DT;
  for (const s of solids) {
    if (!overlaps(playerBox(p), s)) continue;
    if (falling) {
      p.y = s.maxY;
      p.grounded = true;
    } else {
      p.y = s.minY - PLAYER_HEIGHT;
    }
    p.vy = 0;
  }
}
