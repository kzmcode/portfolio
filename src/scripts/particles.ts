/**
 * Hero パーティクル（Constellation Objects）
 * mockups/Main.dc.html の挙動を素の TypeScript に移植したもの。
 *
 * 使い方（Astro の <script> 内）:
 *   import { HeroParticles } from '../scripts/particles';
 *   const hero = document.querySelector<HTMLElement>('#top')!;
 *   const canvas = hero.querySelector<HTMLCanvasElement>('canvas')!;
 *   new HeroParticles(canvas, hero, { count: matchMedia('(max-width: 760px)').matches ? 360 : 720 });
 */

export type ShapeName = 'bulb' | 'robot' | 'globe' | 'icosa' | 'atom';

export interface HeroParticlesOptions {
  count?: number;
  density?: number;
  size?: number;
  speed?: number;
  shape?: ShapeName | 'auto';
  accent?: string;
  labels?: boolean;
  labelMap?: Partial<Record<ShapeName, string>>;
  order?: ShapeName[];
}

type Vec3 = [number, number, number];
interface Polyline { pts: Vec3[]; closed?: boolean; curve?: boolean }
interface Sample { x: number; y: number; z: number; next: number; corner: boolean }
interface Particle {
  x: number; y: number; vx: number; vy: number; dx: number; dy: number;
  s: number; a: number; near: number; slot: number; ramp: number; wait: number; jx: number; jy: number;
}

const DEFAULT_LABELS: Record<ShapeName, string> = {
  bulb: 'INSIGHT', robot: 'ROBOTICS', globe: 'REALITY', icosa: '3D / INTERACTIVE', atom: 'EXPERIMENTS',
};
const STEP = 1 / 60;
const STILL_FRAMES = 16;
const TOUCH_HOLD_MS = 4000;

export class HeroParticles {
  private ctx: CanvasRenderingContext2D;
  private opts: Required<Omit<HeroParticlesOptions, 'labelMap' | 'order'>>;
  private labels: Record<ShapeName, string>;
  private order: ShapeName[];
  private ps: Particle[] = [];
  private samples: Sample[] = [];
  private T = new Float32Array(0);
  private slotP: number[] = [];
  private ghost: { pairs: number[]; a: number } | null = null;
  private curShape: ShapeName | null = null;
  private shapeIdx = 0;
  private needAssign = false;
  private labelA = 0;
  private formed = 0;
  private mouse = { x: -9999, y: -9999, in: false };
  private f = { x: 0, y: 0, vx: 0, vy: 0 };
  private last = { x: 0, y: 0 };
  private mvx = 0; private mvy = 0;
  private still = 0;
  private t = 0;
  private w = 0; private h = 0; private dpr = 1;
  private raf = 0; private prevTime = 0; private acc = 0;
  private visible = true; private pageVisible = true;
  private reduce: boolean;
  private touchTimer = 0;
  private rgb = '141,134,216';
  private ro?: ResizeObserver;
  private io?: IntersectionObserver;
  private cleanup: Array<() => void> = [];

  constructor(private canvas: HTMLCanvasElement, private host: HTMLElement, options: HeroParticlesOptions = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    const cssAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    this.opts = {
      count: options.count ?? 720,
      density: options.density ?? 240,
      size: options.size ?? 130,
      speed: options.speed ?? 1,
      shape: options.shape ?? 'auto',
      accent: options.accent ?? (cssAccent || '#8D86D8'),
      labels: options.labels ?? true,
    };
    this.labels = { ...DEFAULT_LABELS, ...(options.labelMap ?? {}) };
    this.order = options.order ?? ['bulb', 'robot', 'globe', 'icosa', 'atom'];
    this.rgb = hexToRgb(this.opts.accent) ?? this.rgb;
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.resize();
    this.bind();
    if (this.reduce) { this.draw(); } else { this.start(); }
  }

  /* ---------- lifecycle ---------- */

  start() {
    if (this.raf || this.reduce) return;
    this.prevTime = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (!this.visible || !this.pageVisible) { this.prevTime = now; return; }
      this.acc += Math.min(0.1, (now - this.prevTime) / 1000);
      this.prevTime = now;
      while (this.acc >= STEP) { this.update(); this.acc -= STEP; }
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  destroy() {
    this.stop();
    this.ro?.disconnect();
    this.io?.disconnect();
    this.cleanup.forEach((fn) => fn());
  }

  private bind() {
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(type, fn as EventListener, { passive: true });
      this.cleanup.push(() => el.removeEventListener(type, fn as EventListener));
    };
    on(this.host, 'pointermove', (e) => { if (e.pointerType !== 'touch') this.pointerAt(e); });
    on(this.host, 'pointerleave', (e) => { if (e.pointerType !== 'touch') this.leave(); });
    on(this.host, 'pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        const formedHere = this.mouse.in && this.slotP.length > 0;
        const p = this.local(e);
        const sameSpot = Math.hypot(p.x - this.f.x, p.y - this.f.y) < this.opts.size;
        if (formedHere && sameSpot) this.nextShape();
        else { this.scatter(); this.mouse.in = false; this.pointerAt(e); this.still = STILL_FRAMES - 1; }
        clearTimeout(this.touchTimer);
        this.touchTimer = window.setTimeout(() => this.leave(), TOUCH_HOLD_MS);
      } else {
        this.nextShape();
      }
    });
    const onVis = () => { this.pageVisible = document.visibilityState === 'visible'; };
    document.addEventListener('visibilitychange', onVis);
    this.cleanup.push(() => document.removeEventListener('visibilitychange', onVis));

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
    this.io = new IntersectionObserver((entries) => { this.visible = entries[0]?.isIntersecting ?? true; });
    this.io.observe(this.host);
  }

  private local(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (this.w / r.width), y: (e.clientY - r.top) * (this.h / r.height) };
  }

  private pointerAt(e: PointerEvent) {
    const p = this.local(e);
    this.mouse.x = p.x; this.mouse.y = p.y;
    if (!this.mouse.in) {
      this.f.x = p.x; this.f.y = p.y; this.last.x = p.x; this.last.y = p.y;
      this.mouse.in = true; this.still = 0;
    }
  }

  private leave() { this.mvx = 0; this.mvy = 0; this.scatter(); this.mouse.in = false; }

  private nextShape() {
    if (this.opts.shape !== 'auto') return;
    this.shapeIdx = (this.shapeIdx + 1) % this.order.length;
    this.needAssign = true;
  }

  private shapeName(): ShapeName {
    return this.opts.shape === 'auto' ? this.order[this.shapeIdx] : this.opts.shape;
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    if (!this.ps.length) {
      this.w = w; this.h = h; this.init();
    } else {
      const sx = w / this.w, sy = h / this.h;
      for (const p of this.ps) { p.x *= sx; p.y *= sy; }
      this.w = w; this.h = h;
    }
    if (this.reduce) this.draw();
  }

  private init() {
    this.ps = [];
    for (let i = 0; i < this.opts.count; i++) {
      this.ps.push({
        x: Math.random() * this.w, y: Math.random() * this.h, vx: 0, vy: 0,
        dx: (Math.random() - 0.5) * 0.35, dy: (Math.random() - 0.5) * 0.35,
        s: 0.9 + Math.random() * 1.5, a: 0.28 + Math.random() * 0.45,
        near: 0, slot: -1, ramp: 0, wait: 0, jx: 0, jy: 0,
      });
    }
  }

  /* ---------- shapes ---------- */

  private polylines(name: ShapeName): Polyline[] {
    const P = (x: number, y: number, z = 0): Vec3 => [x, y, z];
    const ring3 = (r: number, n: number, tf: (a: number, b: number) => Vec3): Polyline => {
      const pts: Vec3[] = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push(tf(Math.cos(a) * r, Math.sin(a) * r)); }
      return { pts, closed: true, curve: true };
    };

    if (name === 'bulb') {
      const prof: [number, number][] = [];
      for (let i = 0; i <= 10; i++) { const th = (i / 10) * 0.75 * Math.PI; prof.push([0.62 * Math.sin(th), -0.3 - 0.62 * Math.cos(th)]); }
      prof.push([0.3, 0.3], [0.24, 0.46], [0.24, 0.56], [0.22, 0.66], [0.2, 0.76], [0.12, 0.85], [0.03, 0.9]);
      const out: Polyline[] = [];
      for (let k = 0; k < 8; k++) {
        const ph = (k / 8) * Math.PI * 2;
        out.push({ pts: prof.map(([r, y]) => P(r * Math.cos(ph), y, r * Math.sin(ph))), curve: true });
      }
      [2, 4, 6, 8, 12, 13, 14, 15].forEach((ix) => {
        const [r, y] = prof[ix];
        out.push(ring3(r, Math.max(12, Math.round(r * 48)), (a, b) => P(a, y, b)));
      });
      out.push({ pts: [P(-0.12, 0.46), P(-0.12, 0.05), P(-0.07, -0.08), P(0, 0.02), P(0.07, -0.08), P(0.12, 0.05), P(0.12, 0.46)] });
      out.push({ pts: [P(0, 0.46, -0.12), P(0, 0.05, -0.12), P(0, -0.08, -0.07), P(0, 0.02, 0), P(0, -0.08, 0.07), P(0, 0.05, 0.12), P(0, 0.46, 0.12)] });
      return out;
    }

    if (name === 'robot') {
      const out: Polyline[] = [];
      const cyl = (r: number, y0: number, y1: number, n: number) => {
        out.push(ring3(r, n, (a, b) => P(a, y0, b)), ring3(r, n, (a, b) => P(a, y1, b)));
        for (let k = 0; k < 4; k++) {
          const ph = (k / 4) * Math.PI * 2 + Math.PI / 4;
          out.push({ pts: [P(r * Math.cos(ph), y0, r * Math.sin(ph)), P(r * Math.cos(ph), y1, r * Math.sin(ph))] });
        }
      };
      const joint = (x: number, y: number, r: number, w: number) => {
        out.push(ring3(r, 16, (a, b) => P(x + a, y + b, w)), ring3(r, 16, (a, b) => P(x + a, y + b, -w)));
      };
      const box = (ax: number, ay: number, bx: number, by: number, t: number) => {
        const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), nx = (-dy / L) * t, ny = (dx / L) * t;
        const c = (x: number, y: number, s: number, z: number) => P(x + nx * s, y + ny * s, z);
        out.push({ pts: [c(ax, ay, 1, t), c(ax, ay, -1, t), c(ax, ay, -1, -t), c(ax, ay, 1, -t)], closed: true });
        out.push({ pts: [c(bx, by, 1, t), c(bx, by, -1, t), c(bx, by, -1, -t), c(bx, by, 1, -t)], closed: true });
        ([[1, t], [-1, t], [-1, -t], [1, -t]] as const).forEach(([s, z]) => out.push({ pts: [c(ax, ay, s, z), c(bx, by, s, z)] }));
      };
      cyl(0.46, 0.88, 0.78, 24);
      cyl(0.2, 0.78, 0.5, 14);
      joint(0, 0.4, 0.15, 0.12);
      box(0, 0.4, 0.42, -0.3, 0.09);
      joint(0.42, -0.3, 0.12, 0.1);
      box(0.42, -0.3, -0.2, -0.62, 0.07);
      joint(-0.2, -0.62, 0.08, 0.07);
      out.push({ pts: [P(-0.2, -0.62, 0.04), P(-0.36, -0.74, 0.04), P(-0.5, -0.68, 0.04)] });
      out.push({ pts: [P(-0.2, -0.62, -0.04), P(-0.36, -0.52, -0.04), P(-0.5, -0.56, -0.04)] });
      return out;
    }

    if (name === 'globe') {
      const out: Polyline[] = [], R = 0.95;
      [-0.62, -0.32, 0, 0.32, 0.62].forEach((y) => { const r = Math.sqrt(1 - y * y) * R; out.push(ring3(r, 28, (a, b) => P(a, y * R, b))); });
      [0, 45, 90, 135].forEach((deg) => { const t = (deg * Math.PI) / 180; out.push(ring3(R, 32, (a, b) => P(a * Math.cos(t), b, a * Math.sin(t)))); });
      return out;
    }

    if (name === 'icosa') {
      const g = (1 + Math.sqrt(5)) / 2, s = 0.95 / Math.sqrt(1 + g * g);
      const v: Vec3[] = [[0, 1, g], [0, 1, -g], [0, -1, g], [0, -1, -g], [1, g, 0], [1, -g, 0], [-1, g, 0], [-1, -g, 0], [g, 0, 1], [g, 0, -1], [-g, 0, 1], [-g, 0, -1]];
      const out: Polyline[] = [];
      for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
        const d = Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]);
        if (Math.abs(d - 2) < 0.01) out.push({ pts: [P(v[i][0] * s, v[i][1] * s, v[i][2] * s), P(v[j][0] * s, v[j][1] * s, v[j][2] * s)] });
      }
      return out;
    }

    // atom
    const out: Polyline[] = [];
    [0, 60, 120].forEach((deg) => {
      const t = (deg * Math.PI) / 180;
      out.push(ring3(1, 40, (a, b) => { const y = b * 0.34; return P(a * Math.cos(t) - y * Math.sin(t), a * Math.sin(t) + y * Math.cos(t), b * 0.94); }));
    });
    out.push(ring3(0.14, 10, (a, b) => P(a, b, 0)));
    return out;
  }

  private buildSamples(name: ShapeName, target: number): Sample[] {
    const lines = this.polylines(name);
    let total = 0;
    for (const pl of lines) {
      const n = pl.pts.length, m = pl.closed ? n : n - 1;
      for (let i = 0; i < m; i++) { const a = pl.pts[i], b = pl.pts[(i + 1) % n]; total += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }
    }
    const spacing = total / target;
    const S: Sample[] = [];
    for (const pl of lines) {
      const n = pl.pts.length, m = pl.closed ? n : n - 1;
      const first = S.length;
      let carry = 0;
      for (let i = 0; i < m; i++) {
        const a = pl.pts[i], b = pl.pts[(i + 1) % n];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const push = (t: number, corner: boolean) => S.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t, next: S.length + 1, corner });
        if (pl.curve) {
          let d = carry;
          while (d < len) { push(d / len, false); d += spacing; }
          carry = d - len;
        } else {
          const k = Math.max(1, Math.round(len / spacing));
          for (let j = 0; j < k; j++) push(j / k, j === 0);
        }
      }
      if (S.length === first) { const a = pl.pts[0]; S.push({ x: a[0], y: a[1], z: a[2], next: -1, corner: false }); }
      if (!pl.closed) { const e = pl.pts[n - 1]; S.push({ x: e[0], y: e[1], z: e[2], next: -1, corner: !pl.curve }); }
      else S[S.length - 1].next = first;
    }
    return S;
  }

  /* ---------- forming / scattering ---------- */

  private release() { for (const p of this.ps) p.slot = -1; this.slotP = []; }

  private scatter() {
    if (!this.slotP.length) return;
    const ps = this.ps, S = this.samples, pairs: number[] = [];
    for (let s = 0; s < S.length; s++) {
      const nx = S[s].next; if (nx < 0) continue;
      const ia = this.slotP[s], ib = this.slotP[nx];
      if (ia === undefined || ib === undefined) continue;
      const al = Math.min(ps[ia].ramp, ps[ib].ramp);
      if (al > 0.05) pairs.push(ia, ib, al);
    }
    if (pairs.length) this.ghost = { pairs, a: 1 };
    for (const p of ps) {
      if (p.slot < 0) continue;
      const ex = p.x - this.f.x, ey = p.y - this.f.y, d = Math.hypot(ex, ey) || 1;
      const imp = (1.5 + Math.random() * 3.5) * (0.4 + p.ramp * 0.6);
      const ang = (Math.random() - 0.5) * 0.8, ca = Math.cos(ang), sa = Math.sin(ang);
      const ux = (ex / d) * ca - (ey / d) * sa, uy = (ex / d) * sa + (ey / d) * ca;
      p.vx += ux * imp + this.mvx * 0.12; p.vy += uy * imp + this.mvy * 0.12;
      p.slot = -1;
    }
    this.slotP = [];
  }

  private assign() {
    const name = this.shapeName();
    this.samples = this.buildSamples(name, this.opts.density);
    this.T = new Float32Array(this.samples.length * 3);
    this.curShape = name;
    this.release();
    const ps = this.ps, size = this.opts.size;
    const used = new Uint8Array(ps.length);
    const order = this.samples.map((_, i) => i).sort(() => Math.random() - 0.5);
    for (let o = 0; o < order.length && o < ps.length; o++) {
      const s = order[o], sm = this.samples[s];
      const tx = this.f.x + sm.x * size, ty = this.f.y + sm.y * size;
      let best = -1, bd = 1e12;
      for (let i = 0; i < ps.length; i++) {
        if (used[i]) continue;
        const d = (ps[i].x - tx) ** 2 + (ps[i].y - ty) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) break;
      used[best] = 1;
      const p = ps[best];
      p.slot = s; p.ramp = 0;
      p.wait = Math.sqrt(bd) * 0.04 + Math.random() * 45;
      const ja = Math.random() * Math.PI * 2, jr = 30 + Math.random() * 70;
      p.jx = Math.cos(ja) * jr; p.jy = Math.sin(ja) * jr;
      this.slotP[s] = best;
    }
    this.labelA = 0;
  }

  /* ---------- simulation (fixed 60Hz) ---------- */

  private update() {
    const m = this.mouse, f = this.f, ps = this.ps;
    const { size, speed: sp } = this.opts;
    const R = size * 2;

    if (m.in && this.curShape && this.curShape !== this.shapeName()) this.needAssign = true;
    if (m.in) {
      this.mvx = m.x - this.last.x; this.mvy = m.y - this.last.y;
      this.last.x = m.x; this.last.y = m.y;
      if (Math.hypot(this.mvx, this.mvy) > 2.5) { this.still = 0; this.needAssign = false; this.scatter(); }
      else { this.still++; if (this.still === STILL_FRAMES) { f.x = m.x; f.y = m.y; this.needAssign = true; } }
    } else { this.mvx = 0; this.mvy = 0; }
    if (this.needAssign && m.in && this.still >= STILL_FRAMES) { this.assign(); this.needAssign = false; }

    this.t += STEP;
    const t = this.t;
    if (m.in) {
      const nx = f.x + (m.x - f.x) * 0.06, ny = f.y + (m.y - f.y) * 0.06;
      f.vx = nx - f.x; f.vy = ny - f.y; f.x = nx; f.y = ny;
    }

    // project shape samples
    const upright = this.curShape === 'bulb' || this.curShape === 'robot';
    const ry = t * 0.35;
    const rx = upright ? 0.16 + Math.sin(t * 0.3) * 0.06 : 0.35 + Math.sin(t * 0.3) * 0.15;
    const cY = Math.cos(ry), sY = Math.sin(ry), cX = Math.cos(rx), sX = Math.sin(rx);
    const S = this.samples, T = this.T;
    for (let s = 0; s < S.length; s++) {
      const sm = S[s];
      const x1 = sm.x * cY + sm.z * sY, z1 = -sm.x * sY + sm.z * cY;
      const y2 = sm.y * cX - z1 * sX, z2 = sm.y * sX + z1 * cX;
      const k = 2.6 / (2.6 + z2);
      T[s * 3] = f.x + x1 * size * k; T[s * 3 + 1] = f.y + y2 * size * k; T[s * 3 + 2] = k;
    }

    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.slot >= 0 && m.in) {
        if (p.wait > 0) p.wait -= sp; else p.ramp = Math.min(1, p.ramp + 0.006 * sp);
        const e = p.ramp * p.ramp * (3 - 2 * p.ramp);
        const j = 1 - e;
        const tx = T[p.slot * 3] + p.jx * j + Math.sin(t * 0.9 + i) * 6 * j;
        const ty = T[p.slot * 3 + 1] + p.jy * j + Math.cos(t * 0.8 + i) * 6 * j;
        const k = (0.002 + 0.03 * e) * sp;
        p.vx += (tx - p.x) * k; p.vy += (ty - p.y) * k;
        p.vx *= 0.88; p.vy *= 0.88;
        p.x += p.vx + p.dx * (1 - e); p.y += p.vy + p.dy * (1 - e);
        p.near += (1 - p.near) * 0.05;
        continue;
      }
      p.ramp *= 0.94;
      p.dx = clamp(p.dx + (Math.random() - 0.5) * 0.03, -0.35, 0.35);
      p.dy = clamp(p.dy + (Math.random() - 0.5) * 0.03, -0.35, 0.35);
      let k = 0;
      if (m.in) { const d = Math.hypot(p.x - f.x, p.y - f.y); if (d < R) k = (1 - d / R) * 0.5; }
      if (m.in && this.still < STILL_FRAMES) {
        const ex = p.x - m.x, ey = p.y - m.y, d = Math.hypot(ex, ey) || 1;
        if (d < R * 0.7) {
          const q = 1 - d / (R * 0.7);
          p.vx += ((ex / d) * 0.5 + this.mvx * 0.04) * q; p.vy += ((ey / d) * 0.5 + this.mvy * 0.04) * q;
        }
      }
      p.near += (k - p.near) * 0.08;
      p.vx *= 0.95; p.vy *= 0.95;
      p.x += p.dx + p.vx; p.y += p.dy + p.vy;
      if (p.x < -10) p.x = this.w + 10; else if (p.x > this.w + 10) p.x = -10;
      if (p.y < -10) p.y = this.h + 10; else if (p.y > this.h + 10) p.y = -10;
    }

    if (this.ghost) { this.ghost.a -= 0.035; if (this.ghost.a <= 0) this.ghost = null; }

    // formation progress → label
    let formed = 0, cnt = 0;
    if (m.in && this.slotP.length) {
      for (let s = 0; s < S.length; s++) {
        const nx = S[s].next; if (nx < 0) continue;
        const ia = this.slotP[s], ib = this.slotP[nx];
        if (ia === undefined || ib === undefined) continue;
        formed += Math.min(ps[ia].ramp, ps[ib].ramp); cnt++;
      }
    }
    this.formed = cnt ? formed / Math.max(1, S.length) : 0;
    this.labelA += ((m.in && this.formed > 0.8 ? 1 : 0) - this.labelA) * 0.04;
  }

  /* ---------- render ---------- */

  private draw() {
    const { ctx, ps, mouse: m, f } = this;
    const S = this.samples, T = this.T;
    const dc = `rgb(${this.rgb})`;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    // constellation lines among free particles near the cursor
    const near: number[] = [];
    for (let i = 0; i < ps.length; i++) if (!(ps[i].slot >= 0 && m.in) && ps[i].near > 0.03) near.push(i);
    ctx.strokeStyle = dc; ctx.lineWidth = 0.5;
    for (let a = 0; a < near.length; a++) {
      const p = ps[near[a]];
      for (let b = a + 1; b < near.length; b++) {
        const q = ps[near[b]];
        const ex = p.x - q.x; if (ex > 80 || ex < -80) continue;
        const d = Math.hypot(ex, p.y - q.y);
        if (d < 80) {
          ctx.globalAlpha = (1 - d / 80) * Math.min(p.near, q.near) * 0.45;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
    }

    // ghost lines (stretching while scattering)
    if (this.ghost) {
      const g = this.ghost;
      ctx.lineWidth = 0.6;
      for (let k = 0; k < g.pairs.length; k += 3) {
        const pa = ps[g.pairs[k]], pb = ps[g.pairs[k + 1]];
        if (!pa || !pb) continue;
        ctx.globalAlpha = g.a * g.a * g.pairs[k + 2] * 0.38;
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      }
    }

    // shape outline
    if (m.in && this.slotP.length) {
      ctx.lineCap = 'round';
      for (let s = 0; s < S.length; s++) {
        const nx = S[s].next; if (nx < 0) continue;
        const ia = this.slotP[s], ib = this.slotP[nx];
        if (ia === undefined || ib === undefined) continue;
        const al = Math.min(ps[ia].ramp, ps[ib].ramp);
        const depth = (T[s * 3 + 2] + T[nx * 3 + 2]) / 2;
        ctx.globalAlpha = al * al * (0.16 + (depth - 0.8) * 0.9);
        ctx.lineWidth = 0.5 + (depth - 0.8) * 1.1;
        ctx.beginPath(); ctx.moveTo(ps[ia].x, ps[ia].y); ctx.lineTo(ps[ib].x, ps[ib].y); ctx.stroke();
      }
    }

    // particles
    ctx.fillStyle = dc;
    for (const p of ps) {
      if (p.slot >= 0 && m.in) {
        const sm = S[p.slot];
        const depth = T[p.slot * 3 + 2];
        const s = (sm?.corner ? 2.6 : 1.9) * (0.7 + p.ramp * 0.3) * depth;
        ctx.globalAlpha = (0.4 + p.ramp * 0.45) * Math.min(1, 0.4 + (depth - 0.8) * 2);
        ctx.beginPath(); ctx.arc(p.x, p.y, s / 2 + 0.2, 0, Math.PI * 2); ctx.fill();
      } else {
        const s = p.s * (1 + p.near * 1.2);
        ctx.globalAlpha = Math.min(1, p.a + p.near * 0.5);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }

    // label
    if (this.opts.labels && this.labelA > 0.01 && this.curShape) {
      const cs = getComputedStyle(this.host);
      ctx.globalAlpha = this.labelA;
      ctx.fillStyle = cs.getPropertyValue('--text').trim() || '#171C28';
      ctx.font = '500 11px Jost, sans-serif';
      ctx.textAlign = 'center';
      const y = f.y + this.opts.size * 1.15 + 22;
      ctx.fillText(this.labels[this.curShape].split('').join(' '), f.x, y);
      if (this.opts.shape === 'auto') {
        ctx.globalAlpha = this.labelA * 0.8;
        ctx.fillStyle = cs.getPropertyValue('--text-2').trim() || '#616A7E';
        ctx.font = '400 10px Jost, sans-serif';
        ctx.fillText('CLICK TO CHANGE', f.x, y + 18);
      }
    }
    ctx.globalAlpha = 1;
  }
}

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
function hexToRgb(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
