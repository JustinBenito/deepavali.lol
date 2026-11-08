// "/1/<name>" meme: the hero with a fan of guns on a blue-to-orange sunburst,
// poster lettering, and the guns firing festive tracer rounds. Like scene.ts,
// every frame is an analytic function of time so it can be rendered in chunks.

import type { CanvasFactory } from "./scene";

export const MEME_W = 1280;
export const MEME_H = 720;
export const MEME_DURATION = 5;
export const MEME_POSTER_TIME = 2.25;
export const MEME_CTA_TIME = 2.6;
export const FONT_MEME = "DeepMeme";
export const HERO_URL = "/meme/hero.png";
export const SKY_URL = "/meme/sky.jpg"; // pre-stretched to 1280x720

type Ctx = CanvasRenderingContext2D;
type Off = ReturnType<CanvasFactory>;

const W = MEME_W;
const H = MEME_H;
const HERO = { w: 1672, h: 941 };
const K = W / HERO.w; // hero image is drawn full-frame
const PIVOT = { x: 836 * K, y: 470 * K }; // barrels fan out from here

// Barrel ends, in hero-image pixels.
const MUZZLES: [number, number][] = [
  [30, 598], [28, 666], [100, 700], [128, 762], [228, 702], [380, 830], [530, 852], [560, 592],
  [785, 600], [762, 708], [905, 652], [965, 722], [1035, 600], [1105, 690], [1150, 842], [1245, 722],
  [1345, 860], [1405, 542], [1490, 782], [1560, 652], [1610, 802], [1645, 580], [1600, 692], [985, 868],
  [700, 860], [1310, 600], [455, 620], [640, 690], [1648, 665],
];

const T_FIRE = 0.95;
const TRACERS = ["#fff3b0", "#ffd166", "#ff8fab", "#9bf6ff", "#caffbf", "#ffd166"];

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOutBack = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

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

type Shot = { t0: number; x: number; y: number; dx: number; dy: number; color: string; rot: number; ejX: number; ejY: number; spin: number };

export function createMemeScene(rawName: string, makeCanvas: CanvasFactory, hero?: CanvasImageSource, sky?: CanvasImageSource) {
  const name = rawName.trim();
  const rand = mulberry32(7 + name.length * 131);
  const ctxOf = (c: Off) => c.getContext("2d") as Ctx;

  // --- poster lettering, rendered once ---
  const measure = ctxOf(makeCanvas(8, 8));
  const fit = (text: string, max: number, maxW: number) => {
    measure.font = `${max}px ${FONT_MEME}`;
    const w = measure.measureText(text).width;
    return w > maxW ? Math.floor((max * maxW) / w) : max;
  };

  type Palette = { stops: string[]; extrude: string; stroke: string };
  const GOLD: Palette = { stops: ["#fffbe0", "#ffe066", "#ffb300", "#ff7a00"], extrude: "#7a1f00", stroke: "#1b0a00" };
  const FIRE: Palette = { stops: ["#ffffff", "#fff176", "#ff9800", "#ff3d00"], extrude: "#5c0a0a", stroke: "#170000" };

  function block(lines: string[], maxW: number, maxSize: number, pal: Palette) {
    const sizes = lines.map((l) => fit(l, maxSize, maxW));
    const pad = 40;
    const lh = (s: number) => s * 1.02;
    const h = sizes.reduce((a, s) => a + lh(s), 0) + pad * 2;
    const c = makeCanvas(maxW + pad * 2, Math.ceil(h));
    const x = ctxOf(c);
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.lineJoin = "round";
    let y = pad;
    lines.forEach((text, i) => {
      const s = sizes[i];
      const cy = y + lh(s) / 2;
      const cx = c.width / 2;
      x.font = `${s}px ${FONT_MEME}`;
      // 3D extrusion
      const depth = Math.max(5, Math.round(s * 0.09));
      x.fillStyle = pal.extrude;
      for (let d = depth; d > 0; d--) x.fillText(text, cx + d * 0.55, cy + d);
      x.strokeStyle = pal.stroke;
      x.lineWidth = s * 0.14;
      x.strokeText(text, cx + depth * 0.55, cy + depth);
      x.strokeText(text, cx, cy);
      const g = x.createLinearGradient(0, cy - s / 2, 0, cy + s / 2);
      pal.stops.forEach((col, j) => g.addColorStop(j / (pal.stops.length - 1), col));
      x.fillStyle = g;
      x.fillText(text, cx, cy);
      // glossy highlight on the top half
      x.save();
      x.beginPath();
      x.rect(0, cy - s / 2, c.width, s * 0.42);
      x.clip();
      x.fillStyle = "rgba(255,255,255,0.28)";
      x.fillText(text, cx, cy);
      x.restore();
      y += lh(s);
    });
    return c;
  }

  const upper = name.toLocaleUpperCase();
  const words = upper.split(" ");
  let nameLines = [upper];
  if (words.length > 1 && fit(upper, 120, 470) < 70) {
    const mid = Math.ceil(words.length / 2);
    nameLines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }
  const left = block(["HAPPY", "DIWALI"], 470, 104, GOLD);
  const right = name ? block(nameLines, 470, 124, FIRE) : null;
  const LEFT_C = { x: 270, y: 178 };
  const RIGHT_C = { x: 1010, y: 178 };

  // --- sprites ---
  const glowCache = new Map<string, Off>();
  const glow = (color: string) => {
    let s = glowCache.get(color);
    if (!s) {
      s = makeCanvas(64, 64);
      const x = ctxOf(s);
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.2, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      glowCache.set(color, s);
    }
    return s as unknown as CanvasImageSource;
  };

  // background baked once; rays are drawn live so they can turn
  const bg = makeCanvas(W / 4, H / 4);
  {
    const x = ctxOf(bg);
    const g = x.createLinearGradient(0, 0, W / 8, H / 4);
    g.addColorStop(0, "#0b1f6b");
    g.addColorStop(0.45, "#2f5fd0");
    g.addColorStop(0.62, "#ff9a3c");
    g.addColorStop(1, "#ff5e1a");
    x.fillStyle = g;
    x.fillRect(0, 0, W / 4, H / 4);
  }

  // --- gunfire timeline ---
  const shots: Shot[] = [];
  let last = -1;
  for (let t = T_FIRE; t < MEME_DURATION + 3; t += 0.012 + rand() * 0.02) {
    let m = Math.floor(rand() * MUZZLES.length);
    if (m === last) m = (m + 7) % MUZZLES.length;
    last = m;
    const x = MUZZLES[m][0] * K;
    const y = MUZZLES[m][1] * K;
    let dx = x - PIVOT.x;
    let dy = y - PIVOT.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    shots.push({
      t0: t,
      x,
      y,
      dx,
      dy,
      color: TRACERS[Math.floor(rand() * TRACERS.length)],
      rot: rand() * Math.PI,
      ejX: (dx >= 0 ? 1 : -1) * (120 + rand() * 180),
      ejY: -(260 + rand() * 200),
      spin: (rand() - 0.5) * 30,
    });
  }

  function shake(t: number) {
    let a = 0;
    for (const s of shots) {
      const dt = t - s.t0;
      if (dt < 0) break;
      if (dt < 0.08) a += 1 - dt / 0.08;
    }
    // the lettering slamming in
    for (const ts of [0.5, 0.8]) if (t > ts && t < ts + 0.15) a += 4 * (1 - (t - ts) / 0.15);
    a = Math.min(a, 5) * 1.3;
    return { x: Math.sin(t * 97) * a, y: Math.cos(t * 83) * a };
  }

  function drawRays(ctx: Ctx, t: number) {
    const cx = 650;
    const cy = 150;
    const n = 18;
    const r = 1600;
    const turn = t * 0.12;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    for (let i = 0; i < n; i += 2) {
      const a0 = turn + (i / n) * Math.PI * 2;
      const a1 = turn + ((i + 1) / n) * Math.PI * 2;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
      ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
      ctx.closePath();
    }
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(glow("rgba(255,210,140,0.9)"), cx - 380, cy - 380, 760, 760);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function slam(ctx: Ctx, layer: Off, c: { x: number; y: number }, t0: number, t: number, tilt: number) {
    const k = clamp((t - t0) / 0.32);
    if (k <= 0) return;
    const s = 2.3 - 1.3 * easeOutBack(k);
    ctx.save();
    ctx.globalAlpha = clamp((t - t0) / 0.12);
    ctx.translate(c.x, c.y);
    ctx.rotate(tilt);
    ctx.scale(s, s);
    const lw = layer.width;
    const lh = layer.height;
    ctx.drawImage(layer as unknown as CanvasImageSource, -lw / 2, -lh / 2);
    ctx.restore();
    // impact flash
    const f = (t - t0 - 0.3) / 0.2;
    if (f > 0 && f < 1) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (1 - f) * 0.7;
      ctx.drawImage(glow("rgba(255,240,200,1)"), c.x - 260, c.y - 140, 520, 280);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function drawFire(ctx: Ctx, t: number, layer: "behind" | "front") {
    for (const s of shots) {
      const dt = t - s.t0;
      if (dt < 0) break;
      if (dt > 1.6) continue;
      if (layer === "behind") {
        // brass casings and smoke sit behind the muzzle flashes
        if (dt < 1.1) {
          const x = s.x + s.ejX * dt * 0.6;
          const y = s.y - 10 + s.ejY * dt + 0.5 * 1400 * dt * dt;
          if (y < H + 20) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(s.spin * dt);
            ctx.fillStyle = "#c99a2e";
            ctx.fillRect(-6, -2.5, 12, 5);
            ctx.fillStyle = "#ffe08a";
            ctx.fillRect(-6, -2.5, 12, 1.6);
            ctx.restore();
          }
        }
        if (dt < 1.6 && s.spin > 0) {
          const k = dt / 1.6;
          const r = 14 + 60 * Math.sqrt(k);
          ctx.globalAlpha = 0.16 * (1 - k);
          ctx.drawImage(glow("rgba(200,200,210,0.8)"), s.x + s.dx * 20 - r, s.y + s.dy * 20 - r - 40 * k, r * 2, r * 2);
          ctx.globalAlpha = 1;
        }
        continue;
      }
      // tracer round, growing as it flies toward the viewer
      if (dt < 0.9) {
        const v = 1500;
        const grow = 1 + dt * 4;
        const hx = s.x + s.dx * v * dt * grow * 0.6;
        const hy = s.y + s.dy * v * dt * grow * 0.6 + 120 * dt * dt * 0;
        if (hx > -200 && hx < W + 200 && hy > -200 && hy < H + 200) {
          const tail = 110 * grow;
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = s.color;
          ctx.lineCap = "round";
          ctx.globalAlpha = 0.9;
          ctx.lineWidth = 3.5 * grow;
          ctx.beginPath();
          ctx.moveTo(hx - s.dx * tail, hy - s.dy * tail);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.drawImage(glow(s.color), hx - 10 * grow, hy - 10 * grow, 20 * grow, 20 * grow);
          ctx.globalCompositeOperation = "source-over";
        }
      }
      // muzzle flash
      if (dt < 0.1) {
        const k = dt / 0.1;
        const r = 38 + 34 * (1 - k);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 1 - k;
        ctx.drawImage(glow("rgba(255,170,60,1)"), s.x - r * 1.6, s.y - r * 1.6, r * 3.2, r * 3.2);
        ctx.fillStyle = "rgba(255,240,190,0.95)";
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = s.rot + (i / 12) * Math.PI * 2;
          const rr = i % 2 ? r * 0.3 : r * (0.8 + 0.4 * ((i * 7) % 3) / 2);
          const px = s.x + Math.cos(a) * rr;
          const py = s.y + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }

  function draw(ctx: Ctx, t: number, scale = 1) {
    const sh = shake(t);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (sky) {
      // the photo sky, with a soft glow behind the hero
      ctx.drawImage(sky, 0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.35;
      ctx.drawImage(glow("rgba(255,230,190,0.9)"), 650 - 360, 150 - 360, 720, 720);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.drawImage(bg as unknown as CanvasImageSource, 0, 0, W, H);
      drawRays(ctx, t);
    }

    ctx.setTransform(scale, 0, 0, scale, sh.x * scale, sh.y * scale);
    drawFire(ctx, t, "behind");
    // hero rises in
    const rise = clamp(t / 0.45);
    if (hero) {
      ctx.globalAlpha = rise;
      ctx.drawImage(hero, 0, (1 - rise) * 30, W, HERO.h * K);
      ctx.globalAlpha = 1;
    }
    drawFire(ctx, t, "front");
    slam(ctx, left, LEFT_C, 0.2, t, -0.06);
    if (right) slam(ctx, right, RIGHT_C, 0.5, t, 0.05);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, name, textBottom: MEME_H };
}
