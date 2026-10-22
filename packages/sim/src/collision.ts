import type { Level } from "@lifeline/content";

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// M0 treats each level polygon as its bounding box. Real polygon shapes come with Rapier in M1.
export function solidsFromLevel(level: Level): Box[] {
  return level.geometry.map((g) => {
    const xs = g.points.map((p) => p[0]);
    const ys = g.points.map((p) => p[1]);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  });
}

export function overlaps(a: Box, b: Box): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}
