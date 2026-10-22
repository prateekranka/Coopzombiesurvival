// One player's input for one tick. GAME.md sections 6.3 and 10.

export const Button = {
  Jump: 1 << 0,
  Attack: 1 << 1,
  Use: 1 << 2,
  Interact: 1 << 3,
  Signal: 1 << 4,
} as const;

export interface InputFrame {
  /** Sequence number, wraps at 65536. */
  seq: number;
  /** Stick, -1 to 1. */
  moveX: number;
  moveY: number;
  /** Bit set of Button values held this tick. */
  buttons: number;
}

export const NO_INPUT: InputFrame = { seq: 0, moveX: 0, moveY: 0, buttons: 0 };
