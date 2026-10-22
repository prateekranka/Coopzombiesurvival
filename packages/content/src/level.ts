// Level data format. GAME.md section 12, "Level data (first pass)".
// Only the fields M0 needs are required; the rest are optional until their systems exist.

export type Vec2 = [number, number];

export type Material = "concrete" | "wood" | "metal" | "mud";

export interface PolyGeometry {
  type: "poly";
  points: Vec2[];
  material: Material;
}

export interface Checkpoint {
  id: string;
  pos: Vec2;
  swapBell: boolean;
}

export interface Level {
  id: string;
  chapter: number;
  name: string;
  size: Vec2;
  water?: { level: number };
  geometry: PolyGeometry[];
  spawns: { out: Vec2; anchor: Vec2 };
  checkpoints: Checkpoint[];
}
