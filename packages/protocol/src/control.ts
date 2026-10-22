// JSON control messages. Binary frames carry inputs and snapshots; see binary.ts.
// GAME.md section 10.

export type Role = "host" | "guest";

/** Sent by the room server. */
export type ServerMessage =
  | { t: "welcome"; role: Role; code: string; peerPresent: boolean; save: unknown }
  | { t: "peer"; role: Role; present: boolean }
  | { t: "error"; reason: "full" | "not-found" | "bad-request" };

/** Sent peer to peer through the relay, or to the server ("save"). */
export type PeerMessage =
  | { t: "hello"; name: string }
  | { t: "event"; name: string; data?: unknown }
  | { t: "save"; data: unknown };

export type ControlMessage = ServerMessage | PeerMessage;

export const ROOM_CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O
export const ROOM_CODE_LENGTH = 4;

export function isRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_LETTERS.includes(c));
}

export function randomRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_LETTERS[Math.floor(random() * ROOM_CODE_LETTERS.length)];
  }
  return code;
}
