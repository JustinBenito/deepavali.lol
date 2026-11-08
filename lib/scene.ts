// Deterministic Diwali scene. Every particle position is an analytic function of
// time, so the server (frame-by-frame into ffmpeg, possibly split across several
// workers) and the browser (rAF loop) render identical frames for the same name.

export const W = 1280;
export const H = 720;
export const FPS = 24;
export const DURATION = 7.8;
export const POSTER_TIME = 7.3;

export const FONT_HEAVY = "DeepHeavy";
export const FONT_SEMI = "DeepSemi";

type Ctx = CanvasRenderingContext2D;
type OffCanvas = { width: number; height: number; getContext(type: "2d"): unknown };
export type CanvasFactory = (w: number, h: number) => OffCanvas;
type RGB = readonly [number, number, number];

// ---------- names ----------

export function formatName(raw: string): string {
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {}
  s = s
    .replace(/\.(mp4|png)$/i, "")
    .replace(/[-_+.]+/g, " ")
    .replace(/[^\p{L}\p{M}\s'&]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24)
    .trim();
  return s
    .split(" ")
    .map((w) => (w ? w[0].toLocaleUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

// Host the page is served from, safe to draw into the video ("" draws nothing).
export function cleanHost(host: string | null | undefined): string {
  return (host ?? "").toLowerCase().replace(/^www\./, "").replace(/[^a-z0-9.:-]/g, "").slice(0, 40);
}

// ---------- math ----------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// ---------- palette ----------

const WHITE_HOT: RGB = [255, 250, 235];
const EMBER: RGB = [190, 55, 20];
const GOLD: RGB = [255, 196, 90];
const SPARK_GOLD: RGB = [255, 214, 140];
const ORANGE: RGB = [255, 140, 50];
const MAGENTA: RGB = [255, 70, 150];
const ROSE: RGB = [255, 110, 120];
const GREEN: RGB = [80, 235, 140];
const TEAL: RGB = [70, 220, 230];
const BLUE: RGB = [110, 150, 255];
const VIOLET: RGB = [185, 120, 255];
const RED: RGB = [255, 60, 50];

const LINE1_COLORS: RGB[] = [ORANGE, ROSE, [255, 170, 80], [255, 120, 95]];
const LINE2_COLORS: RGB[] = [GOLD, [255, 236, 180], [255, 175, 70], [255, 222, 130]];

// ---------- timeline ----------

const T_FUSE = 0.18; // fuse lit
const T_LAUNCH = 1.05; // rocket leaves the bottle
const T_BURST = 2.45; // apex, burst
const T_ZOOM_START = 1.7;
const T_ZOOM_END = 2.55;
const T_SOLID_TEXT = 4.2;
// When the page reveals its "send one" form (the video itself has no CTA).
export const CTA_TIME = 5.3;
// On the page the scene keeps running past DURATION; ground crackers wind down.
const T_FOUNTAIN_END = DURATION + 2.6;
const T_CHAKRI_END = DURATION + 2.0;
const T_FOUNTAIN = 3.1;
const T_CHAKRI = 3.5;

const Z_CLOSE = 2.4;

// ---------- types ----------

type Star = {
  dx: number;
  dy: number;
  speed: number;
  life: number;
  c1: RGB; // colour after the white-hot flash
  c2: RGB; // colour it shifts to before cooling
  size: number;
  phase: number;
  crackle: number; // time (s after burst) it crackles, or -1
};

type Burst = {
  kind: "peony" | "willow" | "ring" | "crossette";
  x: number;
  y: number;
  t: number;
  drag: number;
  gravity: number;
  stars: Star[];
  light: number;
};

type Spark = {
  t0: number;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  life: number;
  g: number;
  drag: number;
  c: RGB;
  size: number;
  strobe: number;
};

type Puff = {
  t0: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r0: number;
  grow: number;
  life: number;
  a: number;
  warm: number;
};

type Shell = { x0: number; burst: Burst; sparks: Spark[] };

type TextParticle = {
  tx: number;
  ty: number;
  dx: number;
  dy: number;
  speed: number;
  morphStart: number;
  morphDur: number;
  c: RGB;
  phase: number;
  size: number;
};

// ---------- scene ----------

// ---------- layouts ----------
// The OG video is always landscape; phones viewing the page get a portrait scene.

export type Orientation = "landscape" | "portrait";

// Painted skyline backdrops; each image's rooftop line (`ground`) is pinned to GROUND_Y.
export const BACKDROPS: Record<Orientation, { url: string; w: number; h: number; ground: number }> = {
  landscape: { url: "/bg/skyline.jpg", w: 1691, h: 930, ground: 862 },
  portrait: { url: "/bg/skyline-portrait.jpg", w: 941, h: 1672, ground: 1562 },
};

type ShellDef = { kind: Burst["kind"]; x0: number; x1: number; y1: number; tL: number; tA: number; n: number; sp: number; colors: RGB[] };

function layoutFor(o: Orientation) {
  if (o === "portrait") {
    return {
      W: 720,
      H: 1280,
      GROUND_Y: 1195,
      BURST: { x: 360, y: 560 },
      FOUNTAINS: [70, 650],
      CHAKRI_X: 225,
      spread: 0.72, // bursts sized for the narrower frame
      starsMaxY: 900,
      diyaCount: 7,
      shells: [
        { kind: "willow", x0: 200, x1: 170, y1: 230, tL: 3.85, tA: 4.55, n: 150, sp: 380, colors: [GOLD, SPARK_GOLD] },
        { kind: "peony", x0: 520, x1: 560, y1: 330, tL: 4.5, tA: 5.15, n: 140, sp: 360, colors: [TEAL, MAGENTA, WHITE_HOT] },
        { kind: "ring", x0: 520, x1: 560, y1: 330, tL: 4.5, tA: 5.17, n: 44, sp: 270, colors: [GOLD] },
        { kind: "crossette", x0: 540, x1: 520, y1: 150, tL: 5.75, tA: 6.3, n: 26, sp: 280, colors: [RED, GOLD] },
        { kind: "peony", x0: 160, x1: 180, y1: 360, tL: 6.6, tA: 7.15, n: 130, sp: 300, colors: [GREEN, GOLD, BLUE] },
      ] as ShellDef[],
    };
  }
  return {
    W: 1280,
    H: 720,
    GROUND_Y: 650,
    BURST: { x: 640, y: 282 },
    FOUNTAINS: [150, 1130],
    CHAKRI_X: 455,
    spread: 1,
    starsMaxY: 380,
    diyaCount: 11,
    shells: [
      { kind: "willow", x0: 250, x1: 205, y1: 165, tL: 3.85, tA: 4.55, n: 150, sp: 420, colors: [GOLD, SPARK_GOLD] },
      { kind: "peony", x0: 1020, x1: 1075, y1: 170, tL: 4.5, tA: 5.15, n: 140, sp: 400, colors: [TEAL, MAGENTA, WHITE_HOT] },
      { kind: "ring", x0: 1020, x1: 1075, y1: 170, tL: 4.5, tA: 5.17, n: 44, sp: 300, colors: [GOLD] },
      { kind: "crossette", x0: 200, x1: 175, y1: 400, tL: 5.75, tA: 6.3, n: 26, sp: 300, colors: [RED, GOLD] },
      { kind: "peony", x0: 1120, x1: 1100, y1: 380, tL: 6.6, tA: 7.15, n: 130, sp: 330, colors: [GREEN, GOLD, BLUE] },
    ] as ShellDef[],
  };
}

export function sceneSize(o: Orientation) {
  const { W, H } = layoutFor(o);
  return { w: W, h: H };
}

export function createScene(rawName: string, makeCanvas: CanvasFactory, backdrop?: CanvasImageSource, orientation: Orientation = "landscape") {
  // These shadow the landscape module constants for everything drawn below.
  const { W, H, GROUND_Y, BURST, FOUNTAINS, CHAKRI_X, spread, starsMaxY, diyaCount, shells: shellDefs } = layoutFor(orientation);
  const ROCKET_START = { x: W / 2, y: GROUND_Y - 67 };
  const BACKDROP = BACKDROPS[orientation];
  const name = rawName.trim();
  const rand = mulberry32(hashString("diwali:" + name.toLowerCase()));
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  // --- sprite caches ---
  const sprites = new Map<string, OffCanvas>();
  const glow = (c: RGB) => {
    const q: RGB = [c[0] & 0xf0, c[1] & 0xf0, c[2] & 0xf0];
    const key = q.join(",");
    let s = sprites.get(key);
    if (!s) {
      s = makeCanvas(32, 32);
      const g2 = s.getContext("2d") as Ctx;
      const g = g2.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, "rgba(255,255,250,1)");
      g.addColorStop(0.12, rgba(mix(q, WHITE_HOT, 0.55), 1));
      g.addColorStop(0.3, rgba(q, 0.55));
      g.addColorStop(0.6, rgba(q, 0.12));
      g.addColorStop(1, rgba(q, 0));
      g2.fillStyle = g;
      g2.fillRect(0, 0, 32, 32);
      sprites.set(key, s);
    }
    return s as unknown as CanvasImageSource;
  };
  const smokeSprite = (warm: boolean) => {
    const key = warm ? "smoke-warm" : "smoke";
    let s = sprites.get(key);
    if (!s) {
      s = makeCanvas(64, 64);
      const g2 = s.getContext("2d") as Ctx;
      const c: RGB = warm ? [205, 140, 100] : [120, 110, 140];
      const g = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, rgba(c, 0.55));
      g.addColorStop(0.5, rgba(c, 0.25));
      g.addColorStop(1, rgba(c, 0));
      g2.fillStyle = g;
      g2.fillRect(0, 0, 64, 64);
      sprites.set(key, s);
    }
    return s as unknown as CanvasImageSource;
  };

  // --- text layout + sampling ---
  const line1 = "Happy Diwali";
  const lines = name ? [line1, name] : [line1];
  const measure = makeCanvas(8, 8).getContext("2d") as Ctx;
  const fit = (text: string, max: number, maxW: number) => {
    measure.font = `800 ${max}px ${FONT_HEAVY}`;
    const w = measure.measureText(text).width;
    return w > maxW ? Math.max(40, Math.floor((max * maxW) / w)) : max;
  };
  const sizes = name ? [fit(line1, 84, W * 0.78), fit(name, 140, W * 0.86)] : [fit(line1, 140, W * 0.86)];
  const gap = name ? sizes[0] * 0.18 : 0;
  const blockH = sizes.reduce((a, b) => a + b, 0) + gap;
  const top = BURST.y + 10 - blockH / 2;
  const layout = lines.map((text, i) => {
    const y = top + sizes.slice(0, i).reduce((a, b) => a + b, 0) + gap * i + sizes[i] / 2;
    return { text, size: sizes[i], y };
  });
  const textBottom = top + blockH;

  const points: { x: number; y: number; line: number }[] = [];
  layout.forEach((l, li) => {
    const c = makeCanvas(W, H);
    const cx = c.getContext("2d") as Ctx;
    cx.fillStyle = "#fff";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.font = `800 ${l.size}px ${FONT_HEAVY}`;
    cx.fillText(l.text, W / 2, l.y);
    const data = cx.getImageData(0, 0, W, H).data;
    const budget = li === 0 && name ? 560 : 780;
    let step = 3;
    let found: { x: number; y: number }[] = [];
    for (;;) {
      found = [];
      for (let y = 0; y < H; y += step)
        for (let x = (y / step) % 2 ? step / 2 : 0; x < W; x += step)
          if (data[(Math.floor(y) * W + Math.floor(x)) * 4 + 3] > 140) found.push({ x, y });
      if (found.length <= budget * 1.15 || step > 14) break;
      step += 0.5;
    }
    for (const p of found) points.push({ x: p.x + (rand() - 0.5) * 1.2, y: p.y + (rand() - 0.5) * 1.2, line: li });
  });

  const textParticles: TextParticle[] = points.map((p) => {
    const a = rand() * Math.PI * 2;
    const z = rand() * 2 - 1;
    const distFromCenter = Math.hypot(p.x - BURST.x, p.y - BURST.y) / 640;
    return {
      tx: p.x,
      ty: p.y,
      dx: Math.cos(a),
      dy: Math.sin(a),
      speed: (60 + 760 * Math.sqrt(1 - z * z)) * spread,
      morphStart: T_BURST + 0.6 + distFromCenter * 0.35 + rand() * 0.35,
      morphDur: 0.95 + rand() * 0.35,
      c: pick(p.line === 0 && name ? LINE1_COLORS : LINE2_COLORS),
      phase: rand() * Math.PI * 2,
      size: 4.5 + rand() * 3.5,
    };
  });

  // Solid glowing text, rendered once (shadowBlur is expensive per frame).
  const textLayer = makeCanvas(W, H);
  {
    const tc = textLayer.getContext("2d") as Ctx;
    tc.textAlign = "center";
    tc.textBaseline = "middle";
    layout.forEach((l, i) => {
      tc.font = `800 ${l.size}px ${FONT_HEAVY}`;
      const g = tc.createLinearGradient(0, l.y - l.size / 2, 0, l.y + l.size / 2);
      if (i === 0 && name) {
        g.addColorStop(0, "#ffd9b0");
        g.addColorStop(1, "#ff6f7d");
      } else {
        g.addColorStop(0, "#fff6d6");
        g.addColorStop(0.55, "#ffd36b");
        g.addColorStop(1, "#ff9a3c");
      }
      tc.shadowColor = i === 0 && name ? "rgba(255,110,90,0.85)" : "rgba(255,180,70,0.9)";
      tc.shadowBlur = 26;
      tc.fillStyle = g;
      tc.fillText(l.text, W / 2, l.y);
      tc.shadowBlur = 0;
      tc.fillText(l.text, W / 2, l.y);
    });
  }

  // --- shells ---
  function makeBurst(kind: Burst["kind"], x: number, y: number, t: number, n: number, speed: number, colors: RGB[], light: number): Burst {
    const stars: Star[] = [];
    for (let i = 0; i < n; i++) {
      let a = rand() * Math.PI * 2;
      let sp: number;
      if (kind === "ring") {
        a = (i / n) * Math.PI * 2;
        sp = speed * (0.97 + rand() * 0.06);
      } else {
        const z = rand() * 2 - 1;
        sp = speed * (0.25 + 0.75 * Math.sqrt(1 - z * z)) * (0.92 + rand() * 0.16);
      }
      const c1 = pick(colors);
      stars.push({
        dx: Math.cos(a),
        dy: Math.sin(a),
        speed: sp,
        life: kind === "willow" ? 2.4 + rand() * 1.0 : 1.3 + rand() * 0.7,
        c1,
        c2: kind === "peony" && rand() < 0.5 ? pick(colors) : c1,
        size: kind === "willow" ? 3.5 + rand() * 1.5 : 4.5 + rand() * 2.5,
        phase: rand() * 10,
        crackle: kind === "peony" && rand() < 0.35 ? 0.9 + rand() * 0.8 : -1,
      });
    }
    const drag = kind === "willow" ? 2.6 : 1.9;
    const gravity = kind === "willow" ? 70 : 110;
    return { kind, x, y, t, drag, gravity, stars, light };
  }

  function shellSparks(x0: number, x1: number, y1: number, tL: number, tA: number): Spark[] {
    const out: Spark[] = [];
    for (let t = tL; t < tA; t += 1 / 140) {
      const k = easeOutCubic((t - tL) / (tA - tL));
      const a = Math.PI / 2 + (rand() - 0.5) * 0.7;
      const v = 15 + rand() * 55;
      out.push({
        t0: t,
        x0: lerp(x0, x1, k),
        y0: lerp(H + 10, y1, k),
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.25 + rand() * 0.4,
        g: 160,
        drag: 0,
        c: SPARK_GOLD,
        size: 2 + rand() * 2.5,
        strobe: 0,
      });
    }
    return out;
  }

  const mainPeony = makeBurst("peony", BURST.x, BURST.y, T_BURST, 300, 1000 * spread, [MAGENTA, GOLD, GREEN, BLUE, VIOLET, ORANGE], 1);
  const mainWillow = makeBurst("willow", BURST.x, BURST.y, T_BURST + 0.05, 110, 520 * spread, [GOLD, SPARK_GOLD], 0);

  const shells: Shell[] = shellDefs.map((d) => ({
    x0: d.x0,
    burst: makeBurst(d.kind, d.x1, d.y1, d.tA, d.n, d.sp, d.colors, 0.45),
    sparks: shellSparks(d.x0, d.x1, d.y1, d.tL, d.tA),
  }));

  // --- sparks: fuse, rocket trail, fountains, chakri ---
  const sparks: Spark[] = [];
  const fuse = { x: ROCKET_START.x + 4, y: ROCKET_START.y + 28 };
  for (let t = T_FUSE; t < T_LAUNCH; t += 1 / 120) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 2.6;
    const v = 50 + rand() * 160;
    sparks.push({ t0: t, x0: fuse.x, y0: fuse.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.15 + rand() * 0.3, g: 420, drag: 0, c: pick([WHITE_HOT, SPARK_GOLD, GOLD]), size: 2.5 + rand() * 2.5, strobe: 0 });
  }
  // ignition spray out of the bottle mouth
  for (let i = 0; i < 70; i++) {
    const a = Math.PI / 2 + (rand() - 0.5) * 2.2;
    const v = 80 + rand() * 260;
    sparks.push({ t0: T_LAUNCH + rand() * 0.12, x0: ROCKET_START.x, y0: ROCKET_START.y + 20, vx: Math.cos(a) * v, vy: -Math.abs(Math.sin(a) * v) * 0.4, life: 0.3 + rand() * 0.4, g: 600, drag: 0, c: pick([WHITE_HOT, SPARK_GOLD]), size: 2.5 + rand() * 3, strobe: 0 });
  }
  for (let t = T_LAUNCH; t < T_BURST; t += 1 / 260) {
    const p = rocketPos(t);
    const ang = rocketAngle(t);
    const tail = { x: p.x - Math.sin(ang) * 24, y: p.y + Math.cos(ang) * 24 };
    const a = Math.PI / 2 + ang + (rand() - 0.5) * 0.8;
    const v = 30 + rand() * 150;
    sparks.push({ t0: t, x0: tail.x, y0: tail.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + rand() * 0.75, g: 240, drag: 1.2, c: pick([WHITE_HOT, SPARK_GOLD, GOLD, ORANGE]), size: 2.5 + rand() * 3.5, strobe: rand() < 0.15 ? 18 + rand() * 14 : 0 });
  }
  const fountainSparks: Spark[] = [];
  for (const fx of FOUNTAINS) {
    for (let t = T_FOUNTAIN; t < T_FOUNTAIN_END; t += 1 / 130) {
      const ramp = clamp((t - T_FOUNTAIN) / 0.6) * clamp((T_FOUNTAIN_END - t) / 1.2);
      const a = -Math.PI / 2 + (rand() - 0.5) * 0.55;
      const v = (170 + rand() * 230) * (0.5 + 0.5 * ramp);
      fountainSparks.push({ t0: t, x0: fx, y0: GROUND_Y - 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.55 + rand() * 0.6, g: 520, drag: 0.6, c: pick([WHITE_HOT, SPARK_GOLD, SPARK_GOLD, GOLD]), size: 2 + rand() * 2.5, strobe: rand() < 0.2 ? 22 + rand() * 20 : 0 });
    }
  }
  const chakriSparks: Spark[] = [];
  for (let t = T_CHAKRI; t < T_CHAKRI_END; t += 1 / 160) {
    const ang = chakriAngle(t);
    const r = 9;
    const px = CHAKRI_X + Math.cos(ang) * r;
    const py = GROUND_Y - 6 + Math.sin(ang) * r * 0.35;
    const v = 120 + rand() * 120;
    const ta = ang + Math.PI / 2;
    chakriSparks.push({ t0: t, x0: px, y0: py, vx: Math.cos(ta) * v, vy: Math.sin(ta) * v * 0.35 - 30, life: 0.2 + rand() * 0.3, g: 300, drag: 0.5, c: pick([[150, 255, 170] as RGB, SPARK_GOLD, WHITE_HOT]), size: 2 + rand() * 2, strobe: 0 });
  }

  for (const list of [sparks, fountainSparks, chakriSparks]) list.sort((a, b) => a.t0 - b.t0);

  // --- smoke ---
  const puffs: Puff[] = [];
  const puff = (t0: number, x: number, y: number, vx: number, vy: number, r0: number, grow: number, life: number, a: number, warm: number) =>
    puffs.push({ t0, x, y, vx, vy, r0, grow, life, a, warm });
  for (let t = T_FUSE + 0.1; t < T_LAUNCH; t += 0.07)
    puff(t, fuse.x, fuse.y - 4, (rand() - 0.5) * 10, -18 - rand() * 12, 3, 10, 1.6, 0.35, 0.7);
  for (let i = 0; i < 14; i++)
    puff(T_LAUNCH + rand() * 0.15, ROCKET_START.x + (rand() - 0.5) * 20, ROCKET_START.y + 15, (rand() - 0.5) * 90, -10 - rand() * 30, 10, 26, 2.8, 0.5, 0.8);
  for (let t = T_LAUNCH; t < T_BURST - 0.05; t += 0.028) {
    const p = rocketPos(t);
    puff(t, p.x, p.y + 26, (rand() - 0.5) * 8, 6 + rand() * 8, 3, 9 + rand() * 6, 2.6, 0.32, 0.9);
  }
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 120;
    puff(T_BURST + 0.05 + rand() * 0.3, BURST.x + Math.cos(a) * r, BURST.y + Math.sin(a) * r, Math.cos(a) * 10 + 4, Math.sin(a) * 10 + 4, 30, 22, 5.5, 0.16, 1);
  }
  for (const s of shells)
    for (let i = 0; i < 8; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * 60;
      puff(s.burst.t + rand() * 0.3, s.burst.x + Math.cos(a) * r, s.burst.y + Math.sin(a) * r, 5, 3, 20, 14, 4, 0.12, 0.6);
    }
  for (const fx of FOUNTAINS)
    for (let t = T_FOUNTAIN + 0.3; t < T_FOUNTAIN_END - 0.5; t += 0.16)
      puff(t, fx + (rand() - 0.5) * 10, GROUND_Y - 40 - rand() * 60, (rand() - 0.3) * 14, -22 - rand() * 14, 14, 20, 3.2, 0.3, 1);

  // --- background ---
  const stars = Array.from({ length: backdrop ? 70 : 190 }, () => ({ x: rand() * W, y: rand() * (backdrop ? starsMaxY : GROUND_Y - 130), r: 0.35 + rand() * 1.2, phase: rand() * 10, speed: 0.8 + rand() * 2.5 }));

  type Building = { x: number; w: number; h: number; kind: number; windows: { x: number; y: number; on: number; c: string }[] };
  const buildings: Building[] = [];
  for (let x = -20; x < W + 20; ) {
    const w = 55 + rand() * 95;
    const h = 40 + rand() * 95;
    const kind = rand();
    const windows: Building["windows"] = [];
    for (let wy = GROUND_Y - h + 12; wy < GROUND_Y - 10; wy += 15)
      for (let wx = x + 9; wx < x + w - 10; wx += 14)
        if (rand() < 0.38) windows.push({ x: wx, y: wy, on: rand(), c: pick(["#ffb347", "#ffcf7a", "#ff8a5c", "#ffe2a8", "#f7a1c4"]) });
    buildings.push({ x, w, h, kind, windows });
    x += w + 2 + rand() * 8;
  }
  // a temple shikhara silhouette among the rooftops
  const temple = { x: 880 + rand() * 60, base: GROUND_Y - 70 };

  // fairy-light strings between rooftop corners
  const strands: { pts: { x: number; y: number; c: RGB; ph: number }[] }[] = [];
  for (let i = 0; i < buildings.length - 1; i++) {
    if (rand() > 0.55) continue;
    const a = buildings[i];
    const b = buildings[i + 1];
    const x0 = a.x + a.w - 4;
    const y0 = GROUND_Y - a.h + 2;
    const x1 = b.x + 4;
    const y1 = GROUND_Y - b.h + 2;
    const span = Math.hypot(x1 - x0, y1 - y0);
    if (span < 10) continue;
    const sag = 10 + rand() * 16;
    const n = Math.max(3, Math.floor(span / 9));
    const cols: RGB[] = pick([[GOLD, ORANGE], [MAGENTA, GOLD, TEAL], [GOLD, [255, 240, 200] as RGB]]);
    strands.push({
      pts: Array.from({ length: n + 1 }, (_, j) => {
        const k = j / n;
        return { x: lerp(x0, x1, k), y: lerp(y0, y1, k) + Math.sin(k * Math.PI) * sag, c: cols[j % cols.length], ph: j * 0.9 };
      }),
    });
  }

  const diyas = Array.from({ length: diyaCount }, (_, i) => {
    let x = 60 + i * ((W - 120) / (diyaCount - 1));
    if (Math.abs(x - W / 2) < 40) x += 70; // leave room for the bottle
    return { x, phase: rand() * 10 };
  });

  // ---------- motion helpers ----------

  function rocketProgress(t: number) {
    const x = clamp((t - T_LAUNCH) / (T_BURST - T_LAUNCH));
    return 1 - Math.pow(1 - x, 2.1);
  }
  function rocketPos(t: number) {
    const k = rocketProgress(t);
    const x = clamp((t - T_LAUNCH) / (T_BURST - T_LAUNCH));
    const wob = Math.sin(x * Math.PI * 3.2) * 8 * (1 - k);
    return { x: lerp(ROCKET_START.x, BURST.x, k) + wob, y: lerp(ROCKET_START.y, BURST.y, k) };
  }
  function rocketAngle(t: number) {
    const a = rocketPos(t - 0.01);
    const b = rocketPos(t + 0.01);
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.01) return 0;
    return Math.atan2(b.x - a.x, -(b.y - a.y));
  }
  function chakriAngle(t: number) {
    const dt = Math.max(0, t - T_CHAKRI);
    return dt * 22 + dt * dt * 4;
  }

  function camera(t: number) {
    const zp = easeInOutCubic(clamp((t - T_ZOOM_START) / (T_ZOOM_END - T_ZOOM_START)));
    const push = lerp(0, 0.2, clamp(t / T_LAUNCH));
    const z = lerp(Z_CLOSE + push, 1, zp);
    const rp = rocketPos(Math.min(t, T_BURST));
    let fx = lerp(rp.x, W / 2, zp);
    let fy = lerp(rp.y - 20, H / 2, zp);
    const hw = W / 2 / z;
    const hh = H / 2 / z;
    fx = clamp(fx, hw, W - hw);
    fy = clamp(fy, hh, H - hh);
    const s = Math.max(0, 1 - (t - T_BURST) / 0.4);
    if (t > T_BURST && s > 0) {
      fx += Math.sin(t * 90) * 4 * s;
      fy += Math.cos(t * 77) * 4 * s;
    }
    return { z, fx, fy };
  }

  // how much the scene is lit by fireworks right now (0..~1.5)
  function sceneLight(t: number) {
    let L = 0;
    const dm = t - T_BURST;
    if (dm > 0) L += 1.3 * Math.exp(-dm * 6) + 0.35 * Math.exp(-dm * 1.3);
    for (const s of shells) {
      const d = t - s.burst.t;
      if (d > 0) L += s.burst.light * (Math.exp(-d * 6) + 0.25 * Math.exp(-d * 1.5));
    }
    L += 0.16 * clamp((t - T_FOUNTAIN) / 0.6) * clamp((T_FOUNTAIN_END - t) / 0.8);
    return L;
  }

  function starPos(b: Burst, s: Star, t: number) {
    const dt = t - b.t;
    const d = (1 - Math.exp(-b.drag * dt)) / b.drag;
    return { x: b.x + s.dx * s.speed * d, y: b.y + s.dy * s.speed * d + 0.5 * b.gravity * dt * dt };
  }

  function starColor(s: Star, k: number): RGB {
    if (k < 0.06) return mix(WHITE_HOT, s.c1, k / 0.06);
    if (k < 0.55) return mix(s.c1, s.c2, (k - 0.06) / 0.49);
    return mix(s.c2, EMBER, clamp((k - 0.55) / 0.45));
  }

  function textParticlePos(p: TextParticle, t: number) {
    const dt = t - T_BURST;
    const drag = 2.6;
    const d = (1 - Math.exp(-drag * dt)) / drag;
    const ex = BURST.x + p.dx * p.speed * d;
    const ey = BURST.y + p.dy * p.speed * d + 0.5 * 45 * dt * dt;
    const u = easeInOutCubic(clamp((t - p.morphStart) / p.morphDur));
    const swirl = Math.sin(u * Math.PI) * 26;
    return { x: lerp(ex, p.tx, u) - p.dy * swirl, y: lerp(ey, p.ty, u) + p.dx * swirl, u };
  }

  // ---------- drawing ----------

  function sprite(ctx: Ctx, c: RGB, x: number, y: number, size: number, alpha: number) {
    if (alpha <= 0.01 || size <= 0.2) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(glow(c), x - size, y - size, size * 2, size * 2);
  }

  function drawSparks(ctx: Ctx, list: Spark[], t: number, from = 0) {
    for (let i = from; i < list.length; i++) {
      const s = list[i];
      const dt = t - s.t0;
      if (dt < 0) break; // sorted by t0
      if (dt > s.life) continue;
      const k = dt / s.life;
      const d = s.drag ? (1 - Math.exp(-s.drag * dt)) / s.drag : dt;
      const x = s.x0 + s.vx * d;
      const y = s.y0 + s.vy * d + 0.5 * s.g * dt * dt;
      let a = 1 - k * k;
      if (s.strobe && k > 0.4) a *= Math.sin(dt * s.strobe) > 0.2 ? 1.3 : 0.15;
      const c = k < 0.15 ? s.c : mix(s.c, EMBER, (k - 0.15) / 0.85);
      sprite(ctx, c, x, y, s.size * (1 - k * 0.5), a);
    }
  }

  function firstAlive(list: Spark[], t: number, maxLife: number) {
    // binary search for the first spark that could still be alive
    let lo = 0;
    let hi = list.length;
    const t0 = t - maxLife;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (list[m].t0 < t0) lo = m + 1;
      else hi = m;
    }
    return lo;
  }

  function drawBurst(ctx: Ctx, b: Burst, t: number) {
    const dt = t - b.t;
    if (dt < 0) return;
    const ignite = 0.15 + 0.85 * clamp(dt / 0.25);
    const tailLen = b.kind === "willow" ? 0.32 : 0.09;
    ctx.lineCap = "round";
    for (const s of b.stars) {
      if (dt > s.life) continue;
      const k = dt / s.life;
      if (b.kind === "crossette" && dt > 0.55) {
        // each star splits into four
        const ts = 0.55;
        const base = starPos(b, s, b.t + ts);
        const d2 = dt - ts;
        const dd = (1 - Math.exp(-2.2 * d2)) / 2.2;
        for (let j = 0; j < 4; j++) {
          const a = Math.atan2(s.dy, s.dx) + Math.PI / 4 + (j * Math.PI) / 2;
          const x = base.x + Math.cos(a) * 150 * dd;
          const y = base.y + Math.sin(a) * 150 * dd + 0.5 * 120 * d2 * d2 + 0.5 * b.gravity * ts * ts * 0;
          const c = mix(s.c1, EMBER, clamp((k - 0.4) / 0.6));
          sprite(ctx, c, x, y, s.size * 0.8, 1 - k * k);
        }
        continue;
      }
      const pos = starPos(b, s, t);
      const c = starColor(s, k);
      let alpha = (1 - k * k) * ignite;
      if (b.kind === "willow" && k > 0.35) alpha *= 0.55 + 0.45 * Math.sin(t * 30 + s.phase);
      // comet tail
      const prev = starPos(b, s, Math.max(b.t, t - tailLen));
      ctx.globalAlpha = alpha * (b.kind === "willow" ? 0.45 : 0.35);
      ctx.strokeStyle = rgba(c, 1);
      ctx.lineWidth = b.kind === "willow" ? 1.4 : 2;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      sprite(ctx, c, pos.x, pos.y, s.size * (1 - k * 0.45), alpha);
      // crackle: a quick pop of white glitter
      if (s.crackle > 0 && dt > s.crackle && dt < s.crackle + 0.16) {
        const q = (dt - s.crackle) / 0.16;
        for (let j = 0; j < 4; j++) {
          const a = s.phase + j * 1.7;
          sprite(ctx, WHITE_HOT, pos.x + Math.cos(a) * 9 * q, pos.y + Math.sin(a) * 9 * q, 2.5, (1 - q) * 1.2);
        }
      }
    }
    if (dt < 0.35 && b.light > 0) {
      const k = dt / 0.35;
      const r = (40 + 260 * easeOutCubic(k)) * b.light;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      g.addColorStop(0, `rgba(255,248,225,${0.9 * (1 - k)})`);
      g.addColorStop(0.25, `rgba(255,190,110,${0.35 * (1 - k)})`);
      g.addColorStop(1, "rgba(255,140,60,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(b.x - r, b.y - r, r * 2, r * 2);
    }
  }

  function drawPuffs(ctx: Ctx, t: number, L: number) {
    ctx.globalCompositeOperation = "source-over";
    const cool = smokeSprite(false);
    const warm = smokeSprite(true);
    for (const p of puffs) {
      const dt = t - p.t0;
      if (dt < 0 || dt > p.life) continue;
      const k = dt / p.life;
      const r = p.r0 + p.grow * Math.sqrt(dt) * 3;
      const x = p.x + p.vx * dt + Math.sin(dt * 0.8 + p.r0) * 4;
      const y = p.y + p.vy * dt;
      const a = p.a * Math.sin(Math.min(1, k * 4) * Math.PI * 0.5) * (1 - k);
      const lit = clamp(p.warm * (Math.exp(-dt * 2.2) + L * 0.35));
      if (lit < 0.9) {
        ctx.globalAlpha = a * (1 - lit);
        ctx.drawImage(cool, x - r, y - r, r * 2, r * 2);
      }
      if (lit > 0.1) {
        ctx.globalAlpha = a * lit;
        ctx.drawImage(warm, x - r, y - r, r * 2, r * 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Full-frame gradients are slow to rasterise every frame, so they're baked
  // once into small canvases and stretched.
  let skyLayer: OffCanvas | null = null;
  let skyLight: OffCanvas | null = null;
  function drawSky(ctx: Ctx, L: number, s: number) {
    if (!skyLayer) {
      skyLayer = makeCanvas(4, 180);
      const c = skyLayer.getContext("2d") as Ctx;
      const g = c.createLinearGradient(0, 0, 0, 180);
      g.addColorStop(0, "#05041a");
      g.addColorStop(0.5, "#130a30");
      g.addColorStop(0.82, "#2c1240");
      g.addColorStop(1, "#4a1d3e");
      c.fillStyle = g;
      c.fillRect(0, 0, 4, 180);
      skyLight = makeCanvas(160, 90);
      const l = skyLight.getContext("2d") as Ctx;
      const lg = l.createRadialGradient(80, (BURST.y / H) * 90, 0, 80, (BURST.y / H) * 90, 120);
      lg.addColorStop(0, "rgba(255,160,90,1)");
      lg.addColorStop(1, "rgba(255,120,80,0.35)");
      l.fillStyle = lg;
      l.fillRect(0, 0, 160, 90);
    }
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(skyLayer as unknown as CanvasImageSource, 0, 0, W, H);
    if (L > 0.01) {
      ctx.globalAlpha = Math.min(0.3, L * 0.16);
      ctx.drawImage(skyLight as unknown as CanvasImageSource, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  function drawStars(ctx: Ctx, t: number, strength = 1) {
    ctx.fillStyle = "#fff";
    for (const s of stars) {
      ctx.globalAlpha = strength * (0.2 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase)));
      ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawCity(ctx: Ctx, t: number, L: number) {
    ctx.globalCompositeOperation = "source-over";
    // warm haze above the city
    const haze = ctx.createLinearGradient(0, GROUND_Y - 170, 0, GROUND_Y);
    haze.addColorStop(0, "rgba(255,120,80,0)");
    haze.addColorStop(1, "rgba(255,130,80,0.16)");
    ctx.fillStyle = haze;
    ctx.fillRect(-60, GROUND_Y - 170, W + 120, 170);

    const lit = clamp(L * 0.6);
    const face = rgba(mix([14, 7, 26], [62, 30, 48], lit), 1);
    const edge = rgba(mix([30, 16, 44], [120, 64, 70], lit), 1);
    // temple shikhara
    ctx.fillStyle = face;
    ctx.beginPath();
    const tx = temple.x;
    ctx.moveTo(tx - 46, GROUND_Y);
    ctx.lineTo(tx - 46, temple.base);
    for (let i = 0; i < 5; i++) {
      const w = 40 - i * 7;
      const y = temple.base - i * 18;
      ctx.lineTo(tx - w, y);
      ctx.lineTo(tx - w + 4, y - 14);
    }
    ctx.quadraticCurveTo(tx, temple.base - 125, tx + 8, temple.base - 104);
    for (let i = 4; i >= 0; i--) {
      const w = 40 - i * 7;
      const y = temple.base - i * 18;
      ctx.lineTo(tx + w - 4, y - 14);
      ctx.lineTo(tx + w, y);
    }
    ctx.lineTo(tx + 46, temple.base);
    ctx.lineTo(tx + 46, GROUND_Y);
    ctx.fill();
    ctx.fillRect(tx - 1, temple.base - 140, 2, 22); // kalasha spire
    // a small flag on top
    ctx.fillStyle = "#ff7a2f";
    ctx.beginPath();
    ctx.moveTo(tx + 1, temple.base - 140);
    ctx.lineTo(tx + 14 + Math.sin(t * 6) * 2, temple.base - 135);
    ctx.lineTo(tx + 1, temple.base - 130);
    ctx.fill();

    for (const b of buildings) {
      const top = GROUND_Y - b.h;
      ctx.fillStyle = face;
      ctx.fillRect(b.x, top, b.w, b.h + 2);
      ctx.fillStyle = edge;
      ctx.fillRect(b.x, top, b.w, 2.5);
      ctx.fillRect(b.x, top, 2, b.h);
      ctx.fillStyle = face;
      if (b.kind < 0.25) {
        // water tank on stilts
        ctx.fillRect(b.x + b.w * 0.6, top - 20, 22, 14);
        ctx.fillRect(b.x + b.w * 0.6 + 2, top - 6, 2, 6);
        ctx.fillRect(b.x + b.w * 0.6 + 18, top - 6, 2, 6);
      } else if (b.kind < 0.45) {
        // stair room
        ctx.fillRect(b.x + 8, top - 16, 26, 16);
      } else if (b.kind < 0.6) {
        // antenna
        ctx.fillRect(b.x + b.w * 0.3, top - 26, 1.5, 26);
        ctx.fillRect(b.x + b.w * 0.3 - 8, top - 20, 17, 1.5);
      }
      for (const w of b.windows) {
        const flick = w.on > 0.85 ? 0.7 + 0.3 * Math.sin(t * 3 + w.on * 40) : 1;
        ctx.globalAlpha = (0.45 + w.on * 0.45) * flick;
        ctx.fillStyle = w.c;
        ctx.fillRect(w.x, w.y, 6, 7);
        ctx.globalAlpha = 1;
      }
    }
    // fairy lights
    ctx.globalCompositeOperation = "lighter";
    for (const st of strands) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#3a2a2a";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      st.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      for (const p of st.pts) {
        const on = 0.55 + 0.45 * Math.sin(t * 4 - p.ph);
        sprite(ctx, p.c, p.x, p.y + 2, 4.5, on);
      }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  // Marigold garland along the parapet, drawn once at 3x (the camera zooms in on it).
  let garlandLayer: OffCanvas | null = null;
  function garland() {
    if (garlandLayer) return garlandLayer;
    garlandLayer = makeCanvas(1360 * 3, 50 * 3);
    const ctx = garlandLayer.getContext("2d") as Ctx;
    ctx.scale(3, 3);
    for (let seg = 0; seg < 4; seg++) {
      const x0 = seg * 340;
      for (let i = 0; i <= 26; i++) {
        const k = i / 26;
        const x = x0 + k * 340;
        const y = 10 + Math.sin(k * Math.PI) * 26;
        const r = 4.2 + ((i * 7) % 3) * 0.4;
        ctx.fillStyle = i % 3 === 2 ? "#ffcf3a" : "#ff8c1a";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(120,40,0,0.45)";
        ctx.beginPath();
        ctx.arc(x + 1, y + 1.5, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        if (i % 9 === 4) {
          ctx.fillStyle = "#2f7a3a";
          ctx.beginPath();
          ctx.ellipse(x, y + 8, 2.4, 6, 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    return garlandLayer;
  }

  function drawRooftop(ctx: Ctx, t: number, L: number) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(0, GROUND_Y, 0, H + 60);
    g.addColorStop(0, rgba(mix([22, 12, 30], [70, 38, 40], clamp(L * 0.5)), 1));
    g.addColorStop(0.3, "#0a0612");
    g.addColorStop(1, "#040208");
    ctx.fillStyle = g;
    ctx.fillRect(-60, GROUND_Y, W + 120, H - GROUND_Y + 60);
    ctx.fillStyle = rgba(mix([40, 22, 46], [140, 80, 70], clamp(L * 0.5)), 1);
    ctx.fillRect(-60, GROUND_Y, W + 120, 3);

    ctx.drawImage(garland() as unknown as CanvasImageSource, -20, GROUND_Y, 1360, 50);
    for (const d of diyas) drawDiya(ctx, d.x, GROUND_Y, t, d.phase);
  }

  function drawDiya(ctx: Ctx, x: number, y: number, t: number, phase: number) {
    ctx.globalCompositeOperation = "source-over";
    const g = ctx.createLinearGradient(x - 14, 0, x + 14, 0);
    g.addColorStop(0, "#7a2c10");
    g.addColorStop(0.45, "#d0612a");
    g.addColorStop(1, "#6a240c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 9);
    ctx.quadraticCurveTo(x - 6, y + 5, x + 8, y + 1);
    ctx.quadraticCurveTo(x + 16, y - 4, x + 18, y - 10); // spout
    ctx.lineTo(x + 10, y - 9);
    ctx.quadraticCurveTo(x, y - 5, x - 14, y - 9);
    ctx.fill();
    ctx.fillStyle = "#5a1d08";
    ctx.beginPath();
    ctx.ellipse(x, y - 9, 13, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    const f = 1 + 0.12 * Math.sin(t * 13 + phase) + 0.08 * Math.sin(t * 31 + phase * 2);
    const sway = Math.sin(t * 5 + phase) * 1.2;
    const fx = x + 13;
    const fy = y - 12;
    ctx.globalCompositeOperation = "lighter";
    sprite(ctx, ORANGE, fx, fy - 6, 24 * f, 0.42);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,170,60,0.95)";
    ctx.beginPath();
    ctx.moveTo(fx + sway, fy - 16 * f);
    ctx.quadraticCurveTo(fx + 5, fy - 4, fx, fy);
    ctx.quadraticCurveTo(fx - 5, fy - 4, fx + sway, fy - 16 * f);
    ctx.fill();
    ctx.fillStyle = "rgba(255,245,210,0.95)";
    ctx.beginPath();
    ctx.moveTo(fx + sway * 0.6, fy - 10 * f);
    ctx.quadraticCurveTo(fx + 2.5, fy - 3, fx, fy - 1);
    ctx.quadraticCurveTo(fx - 2.5, fy - 3, fx + sway * 0.6, fy - 10 * f);
    ctx.fill();
    ctx.fillStyle = "rgba(90,140,255,0.6)";
    ctx.beginPath();
    ctx.ellipse(fx, fy - 1, 1.6, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  function drawBottle(ctx: Ctx, t: number) {
    const x = ROCKET_START.x;
    const top = GROUND_Y - 54;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(x - 18, 0, x + 18, 0);
    g.addColorStop(0, "#0b2a1d");
    g.addColorStop(0.35, "#1f5a3e");
    g.addColorStop(0.6, "#14422d");
    g.addColorStop(1, "#071c13");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 6, top);
    ctx.lineTo(x + 6, top);
    ctx.lineTo(x + 6, top + 14);
    ctx.quadraticCurveTo(x + 18, top + 20, x + 18, top + 34);
    ctx.lineTo(x + 18, GROUND_Y);
    ctx.lineTo(x - 18, GROUND_Y);
    ctx.lineTo(x - 18, top + 34);
    ctx.quadraticCurveTo(x - 18, top + 20, x - 6, top + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0e3524";
    ctx.fillRect(x - 7, top - 3, 14, 4);
    // label + highlight
    ctx.fillStyle = "rgba(230,210,160,0.55)";
    ctx.fillRect(x - 17, top + 38, 34, 9);
    ctx.fillStyle = "rgba(190,255,220,0.28)";
    ctx.fillRect(x - 12, top + 22, 2.5, 30);
    // fuse light reflecting on the glass
    if (t < T_LAUNCH + 0.4) {
      const k = t < T_LAUNCH ? clamp((t - T_FUSE) / 0.1) : 1 - (t - T_LAUNCH) / 0.4;
      ctx.globalCompositeOperation = "lighter";
      sprite(ctx, ORANGE, x + 6, top + 10, 18, 0.35 * k);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function drawRocket(ctx: Ctx, t: number) {
    if (t >= T_BURST) return;
    const p = rocketPos(t);
    const ang = rocketAngle(t);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    // bamboo stick with nodes
    ctx.fillStyle = "#b58b52";
    ctx.fillRect(5, 6, 2.4, 62);
    ctx.fillStyle = "#8a6435";
    for (let y = 18; y < 66; y += 16) ctx.fillRect(4.6, y, 3.2, 1.4);
    // paper tube, shaded as a cylinder
    const body = ctx.createLinearGradient(-6.5, 0, 6.5, 0);
    body.addColorStop(0, "#6e1410");
    body.addColorStop(0.35, "#d8392c");
    body.addColorStop(0.55, "#f05a43");
    body.addColorStop(1, "#5a0f0c");
    ctx.fillStyle = body;
    ctx.fillRect(-6.5, -16, 13, 34);
    // spiral paper wrap
    ctx.save();
    ctx.beginPath();
    ctx.rect(-6.5, -16, 13, 34);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,220,180,0.18)";
    ctx.lineWidth = 1;
    for (let y = -26; y < 24; y += 5) {
      ctx.beginPath();
      ctx.moveTo(-7, y + 8);
      ctx.lineTo(7, y);
      ctx.stroke();
    }
    ctx.restore();
    // gold foil label with a tiny diya mark
    const foil = ctx.createLinearGradient(-6.5, 0, 6.5, 0);
    foil.addColorStop(0, "#8a6418");
    foil.addColorStop(0.5, "#ffe08a");
    foil.addColorStop(1, "#7a5512");
    ctx.fillStyle = foil;
    ctx.fillRect(-6.5, -4, 13, 9);
    ctx.fillStyle = "rgba(120,20,10,0.7)";
    ctx.fillRect(-6.5, -2, 13, 1);
    ctx.fillRect(-6.5, 2.5, 13, 1);
    // nose cone
    const cone = ctx.createLinearGradient(-7, 0, 7, 0);
    cone.addColorStop(0, "#7a5512");
    cone.addColorStop(0.5, "#ffd76a");
    cone.addColorStop(1, "#6a480e");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(-7, -16);
    ctx.lineTo(0, -31);
    ctx.lineTo(7, -16);
    ctx.closePath();
    ctx.fill();
    // fuse
    if (t < T_LAUNCH) {
      const burnt = clamp((t - T_FUSE) / (T_LAUNCH - T_FUSE));
      ctx.strokeStyle = "#4a3320";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.quadraticCurveTo(5, 22 + 6 * (1 - burnt), 4, 28 - 8 * burnt);
      ctx.stroke();
    }
    // exhaust
    if (t > T_LAUNCH) {
      ctx.globalCompositeOperation = "lighter";
      const f = 1 + 0.25 * Math.sin(t * 70) + 0.1 * Math.sin(t * 131);
      sprite(ctx, ORANGE, 0, 28, 26 * f, 0.8);
      sprite(ctx, SPARK_GOLD, 0, 23, 14 * f, 0.95);
      sprite(ctx, WHITE_HOT, 0, 20, 7 * f, 1);
    }
    ctx.restore();
  }

  function drawFountains(ctx: Ctx, t: number) {
    if (t < T_FOUNTAIN - 0.1) return;
    for (const fx of FOUNTAINS) {
      // clay anar pot
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      const g = ctx.createLinearGradient(fx - 12, 0, fx + 12, 0);
      g.addColorStop(0, "#5a200c");
      g.addColorStop(0.45, "#b8541f");
      g.addColorStop(1, "#4a1a0a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(fx - 4, GROUND_Y - 22);
      ctx.lineTo(fx + 4, GROUND_Y - 22);
      ctx.lineTo(fx + 13, GROUND_Y);
      ctx.lineTo(fx - 13, GROUND_Y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,210,120,0.35)";
      ctx.fillRect(fx - 9, GROUND_Y - 9, 18, 2);
      const on = clamp((t - T_FOUNTAIN) / 0.4) * clamp((T_FOUNTAIN_END - t) / 0.8);
      ctx.globalCompositeOperation = "lighter";
      sprite(ctx, ORANGE, fx, GROUND_Y - 10, 70 * on, 0.35 * on);
      sprite(ctx, WHITE_HOT, fx, GROUND_Y - 22, 10 * on, on);
    }
    drawSparks(ctx, fountainSparks, t, firstAlive(fountainSparks, t, 1.2));
  }

  function drawChakri(ctx: Ctx, t: number) {
    if (t < T_CHAKRI - 0.05) return;
    const on = clamp((t - T_CHAKRI) / 0.3) * clamp((T_CHAKRI_END - t) / 0.4);
    ctx.globalCompositeOperation = "lighter";
    sprite(ctx, [150, 255, 170], CHAKRI_X, GROUND_Y - 6, 38 * on, 0.35 * on);
    const a = chakriAngle(t);
    sprite(ctx, WHITE_HOT, CHAKRI_X + Math.cos(a) * 9, GROUND_Y - 6 + Math.sin(a) * 3, 7, on);
    drawSparks(ctx, chakriSparks, t, firstAlive(chakriSparks, t, 0.6));
  }

  function drawTextParticles(ctx: Ctx, t: number) {
    if (t < T_BURST) return;
    const dt = t - T_BURST;
    const solid = clamp((t - T_SOLID_TEXT) / 0.9);
    const ignite = 0.08 + 0.92 * clamp(dt / 0.3);
    const streaks = new Map<string, number[]>();
    const stride = solid >= 1 ? 3 : 1;
    for (let i = 0; i < textParticles.length; i += stride) {
      const p = textParticles[i];
      const pos = textParticlePos(p, t);
      let alpha: number;
      let c = p.c;
      if (pos.u < 1) {
        alpha = (1 - 0.45 * Math.sin(clamp(dt / 1.6) * Math.PI) * (1 - pos.u)) * ignite;
        if (dt < 0.12) c = mix(WHITE_HOT, p.c, dt / 0.12);
      } else {
        const tw = Math.sin(t * 5 + p.phase);
        alpha = (0.5 + 0.5 * tw * tw) * (1 - solid * 0.5);
      }
      const size = pos.u < 1 ? p.size * (1 - 0.35 * pos.u) : p.size * 0.6;
      sprite(ctx, c, pos.x, pos.y, size, alpha);
      if (pos.u < 0.98) {
        const prev = textParticlePos(p, t - 1 / 25);
        const key = rgba(p.c, 1);
        let arr = streaks.get(key);
        if (!arr) streaks.set(key, (arr = []));
        arr.push(prev.x, prev.y, pos.x, pos.y);
      }
    }
    ctx.lineWidth = 1.3;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.4 * ignite;
    for (const [color, segs] of streaks) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let i = 0; i < segs.length; i += 4) {
        ctx.moveTo(segs[i], segs[i + 1]);
        ctx.lineTo(segs[i + 2], segs[i + 3]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  let vignette: OffCanvas | null = null;
  function drawVignette(ctx: Ctx) {
    if (!vignette) {
      vignette = makeCanvas(W / 4, H / 4);
      const v = vignette.getContext("2d") as Ctx;
      const g = v.createRadialGradient(W / 8, H / 8, Math.min(W, H) / 10, W / 8, H / 8, Math.hypot(W, H) / 8);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.45)");
      v.fillStyle = g;
      v.fillRect(0, 0, W / 4, H / 4);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(vignette as unknown as CanvasImageSource, 0, 0, W, H);
  }

  // `scale` lets the server render at a smaller output size with the same framing.
  function draw(ctx: Ctx, t: number, scale = 1) {
    const L = sceneLight(t);
    drawSky(ctx, L, scale);

    const cam = camera(t);
    const z = cam.z * scale;
    ctx.setTransform(z, 0, 0, z, scale * (W / 2) - z * cam.fx, scale * (H / 2) - z * cam.fy);

    if (backdrop) {
      const k = W / BACKDROP.w;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(backdrop, 0, GROUND_Y - BACKDROP.ground * k, W, BACKDROP.h * k);
      // firework light washes over the painted sky and buildings
      if (L > 0.01 && skyLight) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(0.22, L * 0.12);
        ctx.drawImage(skyLight as unknown as CanvasImageSource, 0, 0, W, H);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }
    drawStars(ctx, t, backdrop ? 0.55 : 1);

    // distant shells go behind the skyline
    ctx.globalCompositeOperation = "lighter";
    for (const s of shells) {
      drawSparks(ctx, s.sparks, t);
      const sb = s.burst;
      if (t >= sb.t - 0.7 && t < sb.t) {
        const k = easeOutCubic((t - (sb.t - 0.7)) / 0.7);
        sprite(ctx, WHITE_HOT, lerp(s.x0, sb.x, k), lerp(H + 10, sb.y, k), 6, 1);
      }
      drawBurst(ctx, sb, t);
    }

    if (!backdrop) drawCity(ctx, t, L);
    drawPuffs(ctx, t, L);
    drawRooftop(ctx, t, L);
    drawBottle(ctx, t);

    ctx.globalCompositeOperation = "lighter";
    if (t > T_FUSE && t < T_LAUNCH + 0.1) {
      const pulse = 0.7 + 0.3 * Math.sin(t * 47) * Math.sin(t * 13);
      sprite(ctx, ORANGE, fuse.x, fuse.y, 24 * pulse, 0.7);
      sprite(ctx, WHITE_HOT, fuse.x, fuse.y, 5, 1);
    }
    drawSparks(ctx, sparks, t);
    drawRocket(ctx, t);
    drawFountains(ctx, t);
    drawChakri(ctx, t);

    ctx.globalCompositeOperation = "lighter";
    drawBurst(ctx, mainWillow, t);
    drawBurst(ctx, mainPeony, t);

    const solid = easeInOutCubic(clamp((t - T_SOLID_TEXT) / 0.9));
    if (solid > 0) {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = solid * 0.95;
      ctx.drawImage(textLayer as unknown as CanvasImageSource, 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "lighter";
    drawTextParticles(ctx, t);


    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawVignette(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  return { draw, name, textBottom };
}
