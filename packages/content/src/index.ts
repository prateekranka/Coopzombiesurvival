import testRoom from "../levels/m0-test-room.json";
import type { Level } from "./level";

export type * from "./level";

export const levels: Record<string, Level> = {
  [testRoom.id]: testRoom as Level,
};

export function getLevel(id: string): Level {
  const level = levels[id];
  if (!level) throw new Error(`Unknown level: ${id}`);
  return level;
}
