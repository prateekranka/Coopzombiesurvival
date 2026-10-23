import * as THREE from "three/webgpu";
import type { Level } from "@lifeline/content";
import { PLAYER_HEIGHT, PLAYER_WIDTH, type PlayerId } from "@lifeline/sim";
import type { ViewPlayer } from "./session";

// Placeholder art: flat shapes with ink outlines, in the Ink Wobble palette. GAME.md section 8.
// Uses the WebGPU renderer, which falls back to WebGL2 when WebGPU is missing.

export const PALETTE = {
  sky: 0xcfc09a,
  shallow: 0x78a39c,
  deep: 0x263c3e,
  brass: 0xd8a048,
  zombie: 0x8fa58a,
  ink: 0x1d1712,
} as const;

export const PLAYER_COLORS: Record<PlayerId, number> = { 0: 0xff9f43, 1: 0x4aa3ff };

const MATERIAL_COLORS: Record<string, number> = {
  concrete: 0x6b6250,
  wood: 0x8a6a45,
  metal: 0x5b666b,
  mud: 0x5a4a35,
};

/** Metres of world shown top to bottom when the camera follows one player. */
const VIEW_HEIGHT = 11;
/** GAME.md 6.1: within this distance, both cameras frame both players. */
const FRAME_BOTH_DISTANCE = 12;
const LOOK_AHEAD = 1.5;

function capsuleShape(w: number, h: number): THREE.Shape {
  const r = w / 2;
  const s = new THREE.Shape();
  s.moveTo(-r, r);
  s.lineTo(-r, h - r);
  s.absarc(0, h - r, r, Math.PI, 0, true);
  s.lineTo(r, r);
  s.absarc(0, r, r, 0, Math.PI, true);
  return s;
}

const basic = (color: number) => new THREE.MeshBasicNodeMaterial({ color });

export class Renderer {
  private readonly renderer: THREE.WebGPURenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private readonly players = new Map<PlayerId, THREE.Group>();
  private readonly ghosts = new Map<PlayerId, THREE.Group>();
  /** Debug mode switches. */
  readonly debug = { hitboxes: false, zoom: 1 };
  private readonly backdrop = new THREE.Group();
  private cam = { x: 0, y: 0, h: VIEW_HEIGHT };
  private hasCam = false;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly level: Level,
  ) {
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.camera.position.z = 50;
    this.buildBackdrop();
    this.buildLevel();
    for (const id of [0, 1] as const) {
      this.players.set(id, this.buildPlayer(id));
      this.ghosts.set(id, this.buildGhost(id));
    }
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  static async create(canvas: HTMLCanvasElement, level: Level): Promise<Renderer> {
    const r = new Renderer(canvas, level);
    await r.renderer.init();
    return r;
  }

  get backend(): string {
    const backend = (this.renderer as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend;
    return backend?.isWebGPUBackend ? "webgpu" : "webgl2";
  }

  private buildBackdrop() {
    // Crooked buildings far behind the play plane, drawn with parallax.
    const [w] = this.level.size;
    let x = -10;
    let i = 0;
    while (x < w + 20) {
      const bw = 3 + ((i * 7) % 5);
      const bh = 6 + ((i * 13) % 9);
      const shape = new THREE.Shape();
      const lean = ((i % 3) - 1) * 0.4;
      shape.moveTo(0, 0);
      shape.lineTo(bw, 0);
      shape.lineTo(bw + lean, bh);
      shape.lineTo(lean, bh + 0.6);
      shape.closePath();
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), basic(i % 2 ? 0xb5a682 : 0xa8997a));
      mesh.position.set(x, 0, -20);
      this.backdrop.add(mesh);
      x += bw + 0.5;
      i++;
    }
    this.scene.add(this.backdrop);
  }

  private buildLevel() {
    const ink = new THREE.LineBasicNodeMaterial({ color: PALETTE.ink });
    for (const g of this.level.geometry) {
      const shape = new THREE.Shape(g.points.map(([x, y]) => new THREE.Vector2(x, y)));
      const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), basic(MATERIAL_COLORS[g.material] ?? 0x666666));
      this.scene.add(fill);
      // WebGPURenderer has no LineLoop, so close the line by repeating the first point.
      const pts = [...g.points, g.points[0]!].map(([x, y]) => new THREE.Vector3(x, y, 0.1));
      this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ink));
    }
    for (const cp of this.level.checkpoints) {
      const post = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 2.2), basic(PALETTE.ink));
      post.position.set(cp.pos[0], cp.pos[1] + 1.1, -0.5);
      const bell = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), basic(PALETTE.brass));
      bell.position.set(cp.pos[0], cp.pos[1] + 2.2, -0.4);
      this.scene.add(post, bell);
    }
  }

  private buildPlayer(id: PlayerId): THREE.Group {
    const group = new THREE.Group();
    const outline = new THREE.Mesh(
      new THREE.ShapeGeometry(capsuleShape(PLAYER_WIDTH + 0.12, PLAYER_HEIGHT + 0.12)),
      basic(PALETTE.ink),
    );
    outline.position.y = -0.06;
    const body = new THREE.Mesh(new THREE.ShapeGeometry(capsuleShape(PLAYER_WIDTH, PLAYER_HEIGHT)), basic(PLAYER_COLORS[id]));
    body.position.z = 0.01;
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), basic(0xffffff));
    eye.name = "eye";
    eye.position.set(0.14, PLAYER_HEIGHT - 0.35, 0.02);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), basic(PALETTE.ink));
    pupil.position.set(0.03, 0, 0.01);
    eye.add(pupil);
    group.add(outline, body, eye, this.hitbox(0xff2bd6));
    group.position.z = 1 + id * 0.1;
    this.scene.add(group);
    return group;
  }

  /** Where the host has this player, drawn as an outline. Debug mode only. */
  private buildGhost(id: PlayerId): THREE.Group {
    const group = new THREE.Group();
    const pts = capsuleShape(PLAYER_WIDTH, PLAYER_HEIGHT)
      .getPoints(12)
      .map((p) => new THREE.Vector3(p.x, p.y, 0));
    pts.push(pts[0]!.clone());
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicNodeMaterial({ color: PLAYER_COLORS[id] })));
    group.position.z = 2;
    group.visible = false;
    this.scene.add(group);
    return group;
  }

  /** The collision box the sim uses, in the player's own space. */
  private hitbox(color: number): THREE.Line {
    const h = PLAYER_WIDTH / 2;
    const pts = [
      [-h, 0],
      [h, 0],
      [h, PLAYER_HEIGHT],
      [-h, PLAYER_HEIGHT],
      [-h, 0],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0.05));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicNodeMaterial({ color }));
    line.name = "hitbox";
    line.visible = false;
    return line;
  }

  private resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
  }

  private updateCamera(view: ViewPlayer[], followId: PlayerId) {
    const me = view.find((p) => p.id === followId);
    if (!me) return;
    const other = view.find((p) => p.id !== followId);
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    let tx = me.x + me.facing * LOOK_AHEAD;
    let ty = me.y + PLAYER_HEIGHT;
    const viewHeight = VIEW_HEIGHT * this.debug.zoom;
    let th = viewHeight;
    if (other && Math.hypot(other.x - me.x, other.y - me.y) < FRAME_BOTH_DISTANCE) {
      tx = (me.x + other.x) / 2;
      ty = (me.y + other.y) / 2 + PLAYER_HEIGHT;
      const needW = Math.abs(other.x - me.x) + 6;
      const needH = Math.abs(other.y - me.y) + 5;
      th = Math.max(viewHeight, needH, needW / aspect);
    }
    // Keep the view inside the level.
    const [lw, lh] = this.level.size;
    const halfW = (th * aspect) / 2;
    tx = halfW * 2 >= lw ? lw / 2 : Math.min(Math.max(tx, halfW), lw - halfW);
    ty = Math.max(ty, th / 2 - 0.5);
    ty = Math.min(ty, Math.max(th / 2, lh - th / 2));

    if (!this.hasCam) {
      this.cam = { x: tx, y: ty, h: th };
      this.hasCam = true;
    } else {
      this.cam.x += (tx - this.cam.x) * 0.12;
      this.cam.y += (ty - this.cam.y) * 0.08;
      this.cam.h += (th - this.cam.h) * 0.05;
    }
    const hw = (this.cam.h * aspect) / 2;
    const hh = this.cam.h / 2;
    this.camera.left = -hw;
    this.camera.right = hw;
    this.camera.top = hh;
    this.camera.bottom = -hh;
    this.camera.position.x = this.cam.x;
    this.camera.position.y = this.cam.y;
    this.camera.updateProjectionMatrix();
    this.backdrop.position.x = this.cam.x * 0.5;
    this.backdrop.position.y = this.cam.y * 0.3;
  }

  /** World metres to CSS pixels on this canvas. */
  worldToScreen(x: number, y: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, 0).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - v.y) / 2) * this.canvas.clientHeight };
  }

  render(view: ViewPlayer[], followId: PlayerId, ghosts: ViewPlayer[] = []) {
    for (const [id, group] of this.players) {
      const p = view.find((v) => v.id === id);
      group.visible = !!p;
      if (!p) continue;
      group.position.x = p.x;
      group.position.y = p.y;
      group.scale.x = p.facing;
      group.getObjectByName("hitbox")!.visible = this.debug.hitboxes;
    }
    for (const [id, group] of this.ghosts) {
      const g = ghosts.find((v) => v.id === id);
      group.visible = !!g;
      if (g) group.position.set(g.x, g.y, 2);
    }
    this.updateCamera(view, followId);
    this.renderer.render(this.scene, this.camera);
  }
}
