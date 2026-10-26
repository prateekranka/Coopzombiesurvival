import * as THREE from "three/webgpu";
import type { Level } from "@lifeline/content";
import { HOSE_NODE_COUNT, PLAYER_HEIGHT, PLAYER_WIDTH, type HoseState, type PlayerId } from "@lifeline/sim";
import type { ViewPlayer } from "./session";

// Art style: flat shapes with ink outlines, in the Ink Wobble palette. GAME.md section 8.
// Uses WebGPU renderer, with automatic fallback to WebGL2.

export const PALETTE = {
  sky: 0xcfc09a,
  shallow: 0x78a39c,
  deep: 0x263c3e,
  waterTint: 0x1d4e56,
  brass: 0xd8a048,
  brassGlow: 0xffd166,
  zombie: 0x8fa58a,
  ink: 0x1d1712,
  snagRed: 0xef476f,
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

const basic = (color: number, opacity = 1, transparent = false) =>
  new THREE.MeshBasicNodeMaterial({ color, opacity, transparent });

export class Renderer {
  private readonly renderer: THREE.WebGPURenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private readonly players = new Map<PlayerId, THREE.Group>();
  private readonly playerHelmets = new Map<PlayerId, THREE.Group>();
  private readonly ghosts = new Map<PlayerId, THREE.Group>();
  /** Debug mode switches. */
  readonly debug = { hitboxes: false, zoom: 1 };
  private readonly backdrop = new THREE.Group();
  private cam = { x: 0, y: 0, h: VIEW_HEIGHT };
  private hasCam = false;

  // Hose and water rendering components
  private hoseLine!: THREE.Line;
  private hoseBackLine!: THREE.Line;
  private hoseGeo!: THREE.BufferGeometry;
  private hoseBackGeo!: THREE.BufferGeometry;
  private hoseSignalMesh!: THREE.Mesh;
  private snagMarkers: THREE.Mesh[] = [];
  private waterSurfaceLine?: THREE.Line;
  private waterOverlay?: THREE.Mesh;
  private bubbles: { mesh: THREE.Mesh; vx: number; vy: number; baseLife: number; life: number }[] = [];
  private bubbleGroup = new THREE.Group();

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
    this.buildWater();
    this.buildHose();

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
    const [w] = this.level.size;
    let x = -10;
    let i = 0;
    while (x < w + 20) {
      const bw = 3 + ((i * 7) % 5);
      const bh = 3.5 + ((i * 13) % 9) / 2;
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
      x += bw + 0.2 + ((i * 5) % 3) * 0.6;
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

  private buildWater() {
    if (!this.level.water) return;
    const [w] = this.level.size;
    const wl = this.level.water.level;

    // Underwater volumetric tint plane
    const planeGeo = new THREE.PlaneGeometry(w + 20, wl);
    const planeMat = basic(PALETTE.waterTint, 0.38, true);
    this.waterOverlay = new THREE.Mesh(planeGeo, planeMat);
    this.waterOverlay.position.set(w / 2, wl / 2, 4);
    this.scene.add(this.waterOverlay);

    // Glowing waterline
    const surfacePts = [new THREE.Vector3(-10, wl, 4.1), new THREE.Vector3(w + 10, wl, 4.1)];
    const surfaceGeo = new THREE.BufferGeometry().setFromPoints(surfacePts);
    this.waterSurfaceLine = new THREE.Line(surfaceGeo, new THREE.LineBasicNodeMaterial({ color: PALETTE.shallow }));
    this.scene.add(this.waterSurfaceLine);

    // Underwater bubbles pool
    for (let i = 0; i < 20; i++) {
      const r = 0.04 + Math.random() * 0.05;
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 8), basic(0xdcf8f6, 0.6, true));
      mesh.visible = false;
      this.bubbleGroup.add(mesh);
      this.bubbles.push({
        mesh,
        vx: (Math.random() - 0.5) * 0.4,
        vy: 1.0 + Math.random() * 1.5,
        baseLife: 2.0 + Math.random() * 2.0,
        life: Math.random() * 2.0,
      });
    }
    this.bubbleGroup.position.z = 4.05;
    this.scene.add(this.bubbleGroup);
  }

  private buildHose() {
    const pts = Array.from({ length: HOSE_NODE_COUNT }, () => new THREE.Vector3(0, 0, 0.8));
    this.hoseGeo = new THREE.BufferGeometry().setFromPoints(pts);
    this.hoseLine = new THREE.Line(this.hoseGeo, new THREE.LineBasicNodeMaterial({ color: PALETTE.brassGlow }));

    const backPts = Array.from({ length: HOSE_NODE_COUNT }, () => new THREE.Vector3(0, 0, 0.79));
    this.hoseBackGeo = new THREE.BufferGeometry().setFromPoints(backPts);
    this.hoseBackLine = new THREE.Line(this.hoseBackGeo, new THREE.LineBasicNodeMaterial({ color: PALETTE.ink }));

    // Signal pulse indicator
    this.hoseSignalMesh = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), basic(0x00f5d4));
    this.hoseSignalMesh.position.z = 0.85;
    this.hoseSignalMesh.visible = false;

    // Snag corner markers pool (up to 3)
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.18, 4), basic(PALETTE.snagRed));
      m.rotation.z = Math.PI / 4; // diamond shape
      m.position.z = 0.86;
      m.visible = false;
      this.snagMarkers.push(m);
      this.scene.add(m);
    }

    this.scene.add(this.hoseBackLine, this.hoseLine, this.hoseSignalMesh);
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

    // Diving Gear (Brass Helmet & Boots) for Diver (id 0)
    const helmetGroup = new THREE.Group();
    const brassDome = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16), basic(PALETTE.brass));
    brassDome.position.set(0, PLAYER_HEIGHT - 0.3, 0.03);
    const glassFace = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), basic(0x6ee7b7, 0.85, true));
    glassFace.position.set(0.12, PLAYER_HEIGHT - 0.3, 0.04);
    const bootLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.22), basic(PALETTE.brass));
    bootLeft.position.set(-0.16, 0.1, 0.03);
    const bootRight = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.22), basic(PALETTE.brass));
    bootRight.position.set(0.16, 0.1, 0.03);

    helmetGroup.add(brassDome, glassFace, bootLeft, bootRight);
    helmetGroup.visible = false;
    this.playerHelmets.set(id, helmetGroup);

    group.add(outline, body, eye, helmetGroup, this.hitbox(0xff2bd6));
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
    if (!this.hasCam) {
      this.cam = { x: tx, y: ty, h: th };
      this.hasCam = true;
    } else {
      this.cam.x += (tx - this.cam.x) * 0.12;
      this.cam.y += (ty - this.cam.y) * 0.08;
      this.cam.h += (th - this.cam.h) * 0.05;
    }
    const [lw, lh] = this.level.size;
    const halfW = (this.cam.h * aspect) / 2;
    this.cam.x = halfW * 2 >= lw ? lw / 2 : Math.min(Math.max(this.cam.x, halfW), lw - halfW);
    this.cam.y = Math.min(Math.max(this.cam.y, this.cam.h / 2), Math.max(this.cam.h / 2, lh - this.cam.h / 2));
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

  private updateHose(hose?: HoseState) {
    if (!hose || !hose.nodes || hose.nodes.length !== HOSE_NODE_COUNT) return;

    const pos = this.hoseGeo.attributes.position as THREE.BufferAttribute;
    const backPos = this.hoseBackGeo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < HOSE_NODE_COUNT; i++) {
      const n = hose.nodes[i]!;
      pos.setXYZ(i, n.x, n.y, 0.8);
      backPos.setXYZ(i, n.x, n.y - 0.03, 0.79);
    }
    pos.needsUpdate = true;
    backPos.needsUpdate = true;

    // Line signal pulse animation
    if (hose.signal) {
      this.hoseSignalMesh.visible = true;
      const idxF = hose.signal.progress * (HOSE_NODE_COUNT - 1);
      const i0 = Math.floor(idxF);
      const i1 = Math.min(HOSE_NODE_COUNT - 1, i0 + 1);
      const frac = idxF - i0;
      const n0 = hose.nodes[i0]!;
      const n1 = hose.nodes[i1]!;
      this.hoseSignalMesh.position.set(n0.x + (n1.x - n0.x) * frac, n0.y + (n1.y - n0.y) * frac, 0.85);
    } else {
      this.hoseSignalMesh.visible = false;
    }

    // Snag markers
    for (let i = 0; i < this.snagMarkers.length; i++) {
      const marker = this.snagMarkers[i]!;
      if (hose.snagPoints && i < hose.snagPoints.length) {
        const pt = hose.snagPoints[i]!;
        marker.position.set(pt.x, pt.y, 0.86);
        marker.visible = true;
      } else {
        marker.visible = false;
      }
    }
  }

  private updateBubbles(view: ViewPlayer[], dt: number) {
    if (!this.level.water) return;
    const wl = this.level.water.level;
    const diver = view.find((p) => p.id === 0);

    for (const b of this.bubbles) {
      b.life -= dt;
      if (b.life <= 0 && diver && (diver.underwater || diver.y < wl)) {
        b.life = b.baseLife;
        b.mesh.position.set(diver.x + (Math.random() - 0.5) * 0.3, diver.y + PLAYER_HEIGHT - 0.2, 4.05);
        b.mesh.visible = true;
      }
      if (b.mesh.visible) {
        b.mesh.position.x += b.vx * dt;
        b.mesh.position.y += b.vy * dt;
        if (b.mesh.position.y >= wl) {
          b.mesh.visible = false;
        }
      }
    }
  }

  render(view: ViewPlayer[], followId: PlayerId, ghosts: ViewPlayer[] = [], hose?: HoseState, dt = 0.016) {
    for (const [id, group] of this.players) {
      const p = view.find((v) => v.id === id);
      group.visible = !!p;
      if (!p) continue;
      group.position.x = p.x;
      group.position.y = p.y;
      group.scale.x = p.facing;
      group.getObjectByName("hitbox")!.visible = this.debug.hitboxes;

      // Show brass diving helmet on Wren (id 0) when diving or underwater
      const helmet = this.playerHelmets.get(id);
      if (helmet) {
        helmet.visible = id === 0 && (p.underwater || (this.level.water !== undefined && p.y < this.level.water.level + 1.0));
      }
    }

    for (const [id, group] of this.ghosts) {
      const g = ghosts.find((v) => v.id === id);
      group.visible = !!g;
      if (g) group.position.set(g.x, g.y, 2);
    }

    this.updateHose(hose);
    this.updateBubbles(view, dt);
    this.updateCamera(view, followId);
    this.renderer.render(this.scene, this.camera);
  }
}
