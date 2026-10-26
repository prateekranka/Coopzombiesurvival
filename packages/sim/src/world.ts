import type { Level } from "@lifeline/content";
import { solidsFromLevel, type Box } from "./collision";
import { createHose, stepHose, type HoseState } from "./hose";
import { NO_INPUT, type InputFrame } from "./input";
import { createPlayer, stepPlayer, type PlayerState } from "./player";
import { tuning } from "./tuning";

export interface WorldState {
  tick: number;
  players: [PlayerState, PlayerState];
  hose: HoseState;
}

export interface World {
  level: Level;
  solids: Box[];
  state: WorldState;
}

export function createWorld(level: Level): World {
  const [ax, ay] = level.spawns.out;
  const [bx, by] = level.spawns.anchor;
  return {
    level,
    solids: solidsFromLevel(level),
    state: {
      tick: 0,
      players: [createPlayer(0, ax, ay), createPlayer(1, bx, by)],
      hose: createHose(bx, by, ax, ay, tuning.maxHoseLength),
    },
  };
}

/** Advances the whole world by one tick. Only the host calls this. */
export function stepWorld(world: World, inputs: readonly [InputFrame?, InputFrame?]): void {
  const { state, solids, level } = world;
  const waterLevel = level.water?.level;
  state.players.forEach((p, i) => stepPlayer(p, inputs[i] ?? NO_INPUT, solids, waterLevel));
  stepHose(state.hose, state.players[1], state.players[0], inputs, solids, waterLevel, state.tick);
  state.tick++;
}
