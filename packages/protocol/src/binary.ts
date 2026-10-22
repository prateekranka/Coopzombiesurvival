// Binary input frames and snapshots. GAME.md section 10.
// Snapshots are quantized: positions in millimetres, speeds in cm/s.
// Deltas against the last acked snapshot come later; at two players a full snapshot is 40 bytes.

import type { InputFrame, PlayerId, PlayerState, WorldState } from "@lifeline/sim";

export const MsgType = {
  Input: 1,
  Snapshot: 2,
} as const;

const INPUT_BYTES = 6;
const SNAPSHOT_HEADER_BYTES = 8;
const PLAYER_BYTES = 16;

const Flag = { Grounded: 1, JumpHeld: 2, FacingLeft: 4 } as const;

const clampInt = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));

export function encodeInput(input: InputFrame): ArrayBuffer {
  const buf = new ArrayBuffer(INPUT_BYTES);
  const v = new DataView(buf);
  v.setUint8(0, MsgType.Input);
  v.setUint16(1, input.seq & 0xffff);
  v.setInt8(3, clampInt(input.moveX * 127, -127, 127));
  v.setInt8(4, clampInt(input.moveY * 127, -127, 127));
  v.setUint8(5, input.buttons & 0xff);
  return buf;
}

export function decodeInput(buf: ArrayBuffer): InputFrame {
  const v = new DataView(buf);
  if (v.byteLength !== INPUT_BYTES || v.getUint8(0) !== MsgType.Input) throw new Error("Not an input frame");
  return { seq: v.getUint16(1), moveX: v.getInt8(3) / 127, moveY: v.getInt8(4) / 127, buttons: v.getUint8(5) };
}

export interface Snapshot {
  tick: number;
  /** Seq of the last guest input the host applied. */
  ack: number;
  players: PlayerState[];
}

export function encodeSnapshot(state: WorldState, ack: number): ArrayBuffer {
  const buf = new ArrayBuffer(SNAPSHOT_HEADER_BYTES + PLAYER_BYTES * state.players.length);
  const v = new DataView(buf);
  v.setUint8(0, MsgType.Snapshot);
  v.setUint32(1, state.tick >>> 0);
  v.setUint16(5, ack & 0xffff);
  v.setUint8(7, state.players.length);
  let o = SNAPSHOT_HEADER_BYTES;
  for (const p of state.players) {
    v.setUint8(o, p.id);
    v.setInt32(o + 1, Math.round(p.x * 1000));
    v.setInt32(o + 5, Math.round(p.y * 1000));
    v.setInt16(o + 9, clampInt(p.vx * 100, -32768, 32767));
    v.setInt16(o + 11, clampInt(p.vy * 100, -32768, 32767));
    v.setUint8(
      o + 13,
      (p.grounded ? Flag.Grounded : 0) | (p.jumpHeld ? Flag.JumpHeld : 0) | (p.facing < 0 ? Flag.FacingLeft : 0),
    );
    v.setUint8(o + 14, p.coyote);
    v.setUint8(o + 15, p.jumpBuffer);
    o += PLAYER_BYTES;
  }
  return buf;
}

export function decodeSnapshot(buf: ArrayBuffer): Snapshot {
  const v = new DataView(buf);
  if (v.getUint8(0) !== MsgType.Snapshot) throw new Error("Not a snapshot");
  const count = v.getUint8(7);
  if (v.byteLength !== SNAPSHOT_HEADER_BYTES + PLAYER_BYTES * count) throw new Error("Bad snapshot length");
  const players: PlayerState[] = [];
  let o = SNAPSHOT_HEADER_BYTES;
  for (let i = 0; i < count; i++) {
    const flags = v.getUint8(o + 13);
    players.push({
      id: v.getUint8(o) as PlayerId,
      x: v.getInt32(o + 1) / 1000,
      y: v.getInt32(o + 5) / 1000,
      vx: v.getInt16(o + 9) / 100,
      vy: v.getInt16(o + 11) / 100,
      grounded: (flags & Flag.Grounded) !== 0,
      jumpHeld: (flags & Flag.JumpHeld) !== 0,
      facing: flags & Flag.FacingLeft ? -1 : 1,
      coyote: v.getUint8(o + 14),
      jumpBuffer: v.getUint8(o + 15),
    });
    o += PLAYER_BYTES;
  }
  return { tick: v.getUint32(1), ack: v.getUint16(5), players };
}

export function messageType(buf: ArrayBuffer): number {
  return buf.byteLength > 0 ? new DataView(buf).getUint8(0) : 0;
}

/** True if seq `a` is newer than `b`, with 16-bit wraparound. */
export function seqNewer(a: number, b: number): boolean {
  const d = (a - b) & 0xffff;
  return d !== 0 && d < 0x8000;
}
