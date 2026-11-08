// Small shared toolkit for the greeting scenes in lib/scenes/*.

export type Ctx = CanvasRenderingContext2D;
export type Off = { width: number; height: number; getContext(type: "2d"): unknown };
export type MakeCanvas = (w: number, h: number) => Off;
export type Scene = { draw(ctx: Ctx, t: number, scale?: number): void; name: string; textBottom: number };

export const W = 1280;
export const H = 720;

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const easeInOut = (x: number) => {
  x = clamp(x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOutBack = (x: number) => {
  x = clamp(x);
  return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
};
/** 0→1 over [a, b] */
export const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ctxOf = (c: Off) => c.getContext("2d") as Ctx;
export const img = (c: Off) => c as unknown as CanvasImageSource;

/** Soft radial glow sprites, cached per colour. */
export function glows(makeCanvas: MakeCanvas) {
  const cache = new Map<string, Off>();
  return (color: string, core = "rgba(255,255,255,1)") => {
    const key = color + core;
    let s = cache.get(key);
    if (!s) {
      s = makeCanvas(64, 64);
      const x = ctxOf(s);
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, core);
      g.addColorStop(0.22, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      cache.set(key, s);
    }
    return img(s);
  };
}

/** Largest font size ≤ max at which `text` fits in maxW. */
export function fitter(makeCanvas: MakeCanvas) {
  const m = ctxOf(makeCanvas(8, 8));
  return (text: string, font: (size: number) => string, max: number, maxW: number) => {
    m.font = font(max);
    const w = m.measureText(text).width;
    return w > maxW ? Math.max(24, Math.floor((max * maxW) / w)) : max;
  };
}

/** Splits a long name into two balanced lines when it would get too small on one. */
export function nameLines(name: string, fits: (line: string) => number, minSize: number) {
  const words = name.split(" ");
  if (words.length < 2 || fits(name) >= minSize) return [name];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}
