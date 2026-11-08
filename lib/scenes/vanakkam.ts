// /7: the vanakkam meme. He rises in with folded hands against a night sky of
// fireworks; "HAPPY DIWALI" slams in with a 💣 on each A (as in the original meme),
// the bombs go off one after the other, and the name lands in fire lettering.
// The hero is a cut-out (public/vanakkam/hero.webp) drawn over a painted sky.
import { ctxOf, easeInOut, easeOutBack, fitter, glows, H, img, nameLines, seeded, span, W, type Ctx, type MakeCanvas, type Off, type Scene } from "../kit";

export const VANAKKAM = { duration: 6.5, poster: 4.6, cta: 3.6, loopFrom: 4.3 };
export const VANAKKAM_HERO_URL = "/vanakkam/hero.webp";
export const FONT_HEAVY = "DeepHeavy";

// the cut-out is 1400x773; drawn anchored bottom-left so his arm runs off the edge
const HERO_SRC = { w: 1400, h: 773 };
const HERO_W = 1030;
const HERO_H = (HERO_W * HERO_SRC.h) / HERO_SRC.w;
const HERO_X = -24;
const HERO_Y = H - HERO_H + 6;
const HEAD = { x: HERO_X + 600 * (HERO_W / HERO_SRC.w), y: HERO_Y + 300 * (HERO_W / HERO_SRC.w) };

// text column on the right
const COL = { x: 1000, w: 500 };
const SKEW = -0.2; // italic slant, like the original poster
const T_HAPPY = 0.45;
const T_DIWALI = 0.7;
const T_NAME = 1.05;
const T_BOOM = [2.6, 2.9]; // the two bombs
const LIFE = 1.45; // seconds a firework spark lives
const PERIOD = VANAKKAM.duration - VANAKKAM.loopFrom; // the page loop

const COLORS = ["#ffd166", "#ff6b9a", "#7cf7ff", "#b6ff8a", "#ffffff", "#ff9a3c", "#c9a7ff"];

type Burst = { t0: number; x: number; y: number; color: string; color2: string; n: number; speed: number; rot: number; big: number };
type Palette = { stops: string[]; extrude: string; stroke: string };
const GOLD: Palette = { stops: ["#fff6c8", "#ffd84a", "#f4a300", "#d96a00"], extrude: "#5a2200", stroke: "#1a0900" };
const FIRE: Palette = { stops: ["#ffffff", "#fff176", "#ff9800", "#ff3d00"], extrude: "#5c0a0a", stroke: "#170000" };

export function createVanakkamScene(rawName: string, makeCanvas: MakeCanvas, hero?: CanvasImageSource): Scene {
  const name = rawName.trim();
  const rand = seeded("vanakkam:" + name.toLowerCase());
  const glow = glows(makeCanvas);
  const fit = fitter(makeCanvas);
  const font = (s: number) => `${s}px ${FONT_HEAVY}`;

  // ---------- night sky, baked ----------
  const bg = makeCanvas(W, H);
  {
    const x = ctxOf(bg);
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#03031a");
    g.addColorStop(0.5, "#120a3d");
    g.addColorStop(1, "#2c0b45");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    // warm city glow along the bottom
    const c = x.createRadialGradient(W * 0.7, H + 120, 40, W * 0.7, H + 120, 760);
    c.addColorStop(0, "rgba(255,70,140,0.38)");
    c.addColorStop(1, "rgba(255,70,140,0)");
    x.fillStyle = c;
    x.fillRect(0, 0, W, H);
  }
  const stars = Array.from({ length: 90 }, () => ({
    x: rand() * W,
    y: rand() * H * 0.75,
    r: 0.6 + rand() * 1.4,
    a: 0.25 + rand() * 0.6,
    k: 1 + Math.floor(rand() * 3), // whole cycles per loop, so the loop is seamless
    ph: rand() * Math.PI * 2,
  }));
  const vignette = makeCanvas(W, H);
  {
    const x = ctxOf(vignette);
    const g = x.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 820);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }

  // ---------- the hero, plus a rim-light ring and a flat silhouette for flashes ----------
  let rim: Off | null = null;
  let flat: Off | null = null;
  if (hero) {
    const silhouette = (color: string) => {
      const c = makeCanvas(Math.ceil(HERO_W) + 40, Math.ceil(HERO_H) + 40);
      const x = ctxOf(c);
      x.drawImage(hero, 20, 20, HERO_W, HERO_H);
      x.globalCompositeOperation = "source-in";
      x.fillStyle = color;
      x.fillRect(0, 0, c.width, c.height);
      return c;
    };
    flat = silhouette("#ffc58a");
    const gold = silhouette("#ffcf7a");
    rim = makeCanvas(gold.width, gold.height);
    const x = ctxOf(rim);
    x.globalAlpha = 0.16;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      for (const r of [4, 9]) x.drawImage(img(gold), Math.cos(a) * r, Math.sin(a) * r);
    }
  }

  // ---------- poster lettering, baked ----------
  type Block = { c: Off; letterX: number[]; size: number };
  function letters(text: string, size: number, pal: Palette): Block {
    const m = ctxOf(makeCanvas(8, 8));
    m.font = font(size);
    const widths = [...text].map((ch) => m.measureText(ch).width);
    const textW = widths.reduce((a, b) => a + b, 0);
    const depth = Math.max(5, Math.round(size * 0.08));
    const pad = Math.ceil(size * 0.5);
    const c = makeCanvas(Math.ceil(textW + pad * 2 + size * 0.3), Math.ceil(size * 1.3 + pad));
    const x = ctxOf(c);
    const cx = c.width / 2;
    const cy = c.height / 2;
    x.setTransform(1, 0, SKEW, 1, -SKEW * cy, 0);
    x.font = font(size);
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.lineJoin = "round";
    x.fillStyle = pal.extrude;
    for (let d = depth; d > 0; d--) x.fillText(text, cx + d * 0.6, cy + d);
    x.strokeStyle = pal.stroke;
    x.lineWidth = size * 0.13;
    x.strokeText(text, cx + depth * 0.6, cy + depth);
    x.strokeText(text, cx, cy);
    const g = x.createLinearGradient(0, cy - size * 0.42, 0, cy + size * 0.42);
    pal.stops.forEach((col, j) => g.addColorStop(j / (pal.stops.length - 1), col));
    x.fillStyle = g;
    x.fillText(text, cx, cy);
    x.save();
    x.beginPath();
    x.rect(-c.width, cy - size * 0.42, c.width * 3, size * 0.36);
    x.clip();
    x.fillStyle = "rgba(255,255,255,0.3)";
    x.fillText(text, cx, cy);
    x.restore();
    // centre x of each letter, relative to the block centre (before slant)
    let run = -textW / 2;
    const letterX = widths.map((w) => {
      const mid = run + w / 2;
      run += w;
      return mid;
    });
    return { c, letterX, size };
  }

  const titleSize = Math.min(fit("HAPPY", font, 118, COL.w - 40), fit("DIWALI", font, 118, COL.w - 40));
  const happy = letters("HAPPY", titleSize, GOLD);
  const diwali = letters("DIWALI", titleSize, GOLD);
  const HAPPY_Y = 150;
  const DIWALI_Y = HAPPY_Y + titleSize * 1.02;

  const upper = name.toLocaleUpperCase();
  const nameFits = (line: string) => fit(line, font, 165, COL.w + 10);
  const lines = name ? nameLines(upper, nameFits, 70) : [];
  const nameSize = lines.length ? Math.min(...lines.map(nameFits)) : 0;
  const nameBlocks = lines.map((l) => letters(l, nameSize, FIRE));
  const NAME_Y = DIWALI_Y + titleSize * 0.55 + nameSize * 0.72;

  // 💣 on the A of each word; cap-height top of the letter, with the slant applied
  const bombAt = (b: Block, i: number, cy: number) => {
    const capTop = b.size * 0.36;
    return { x: COL.x + b.letterX[i] - SKEW * capTop, y: cy - capTop - 26 };
  };
  const bombs = [
    { ...bombAt(happy, 1, HAPPY_Y), t0: T_HAPPY + 0.25, tBoom: T_BOOM[0], rot: -0.35 },
    { ...bombAt(diwali, 3, DIWALI_Y), t0: T_DIWALI + 0.25, tBoom: T_BOOM[1], rot: 0.3 },
  ];

  // ---------- fireworks timeline ----------
  // Bursts in the loop window repeat every PERIOD, and copies shifted one period
  // back cover the moment the page loop wraps, so the loop has no jump.
  const burst = (t0: number, big = 0): Burst => ({
    t0,
    x: 70 + rand() * (W - 140),
    y: 50 + rand() * 230,
    color: COLORS[Math.floor(rand() * COLORS.length)],
    color2: COLORS[Math.floor(rand() * COLORS.length)],
    n: 44 + Math.floor(rand() * 16),
    speed: 230 + rand() * 130,
    rot: rand() * Math.PI,
    big,
  });
  const bursts: Burst[] = [];
  for (let t = 1.0 + rand() * 0.2; t < VANAKKAM.loopFrom - LIFE; t += 0.32 + rand() * 0.3) bursts.push(burst(t));
  const loopBursts: Burst[] = [];
  for (let t = VANAKKAM.loopFrom; t < VANAKKAM.duration; t += 0.28 + rand() * 0.26) loopBursts.push(burst(t));
  for (const b of loopBursts) {
    bursts.push(b);
    if (b.t0 - PERIOD > VANAKKAM.loopFrom - LIFE - 0.05) bursts.push({ ...b, t0: b.t0 - PERIOD });
  }
  // the bombs: big gold bursts in front of everything
  const booms: Burst[] = bombs.map((b) => ({ t0: b.tBoom, x: b.x, y: b.y, color: "#ffd166", color2: "#ff7a3c", n: 72, speed: 470, rot: rand(), big: 1 }));

  // embers rising from the bottom; whole cycles per loop
  const embers = Array.from({ length: 26 }, () => ({ x: rand() * W, cycles: 1 + Math.floor(rand() * 2), ph: rand(), sway: 10 + rand() * 30, size: 2 + rand() * 3 }));

  function sparkPos(b: Burst, i: number, dt: number) {
    const a = b.rot + (i / b.n) * Math.PI * 2 + Math.sin(i * 12.9898 + b.t0) * 0.12;
    const v = b.speed * (i % 2 ? 0.55 : 1) * (0.8 + 0.2 * Math.abs(Math.sin(i * 78.233 + b.t0 * 3)));
    const k = 1.9; // drag
    const d = (1 - Math.exp(-k * dt)) / k;
    return { x: b.x + Math.cos(a) * v * d, y: b.y + Math.sin(a) * v * d + 70 * dt * dt };
  }

  function drawBurst(ctx: Ctx, b: Burst, t: number) {
    const dt = t - b.t0;
    if (dt < 0 || dt > LIFE) return;
    const life = dt / LIFE;
    ctx.globalCompositeOperation = "lighter";
    // the pop
    if (dt < 0.18) {
      ctx.globalAlpha = 1 - dt / 0.18;
      const r = (b.big ? 260 : 110) * (0.6 + dt * 3);
      ctx.drawImage(glow(b.color), b.x - r, b.y - r, r * 2, r * 2);
    }
    ctx.strokeStyle = b.color;
    ctx.lineCap = "round";
    ctx.lineWidth = b.big ? 4 : 3;
    const hs = b.big ? 22 : 15;
    for (let i = 0; i < b.n; i++) {
      // crackle: sparks flicker as they die
      const crackle = life > 0.6 ? 0.55 + 0.45 * Math.sin(dt * 70 + i * 2.3) : 1;
      const a = (1 - life * life) * crackle;
      if (a <= 0.02) continue;
      const p = sparkPos(b, i, dt);
      const q = sparkPos(b, i, Math.max(0, dt - 0.2));
      const col = i % 2 ? b.color2 : b.color;
      ctx.strokeStyle = col;
      ctx.globalAlpha = a * 0.75;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.drawImage(glow(col), p.x - hs / 2, p.y - hs / 2, hs, hs);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // how much the fireworks are lighting him up right now
  function flash(t: number) {
    let f = 0;
    for (const b of bursts) {
      const dt = t - b.t0;
      if (dt >= 0 && dt < 0.6) f += 0.22 * Math.exp(-dt * 6);
    }
    for (const b of booms) {
      const dt = t - b.t0;
      if (dt >= 0 && dt < 0.8) f += 0.9 * Math.exp(-dt * 5);
    }
    return Math.min(f, 1);
  }

  function shake(t: number) {
    let a = 0;
    for (const ts of [T_HAPPY + 0.28, T_DIWALI + 0.28, T_NAME + 0.28]) if (t > ts && t < ts + 0.16) a += 5 * (1 - (t - ts) / 0.16);
    for (const ts of T_BOOM) if (t > ts && t < ts + 0.4) a += 13 * (1 - (t - ts) / 0.4);
    return { x: Math.sin(t * 97) * a, y: Math.cos(t * 83) * a };
  }

  function slam(ctx: Ctx, b: Block, cy: number, t0: number, t: number, tilt: number) {
    const k = span(t, t0, t0 + 0.32);
    if (k <= 0) return;
    const s = 2.3 - 1.3 * easeOutBack(k);
    ctx.save();
    ctx.globalAlpha = span(t, t0, t0 + 0.12);
    ctx.translate(COL.x, cy);
    ctx.rotate(tilt);
    ctx.scale(s, s);
    ctx.drawImage(img(b.c), -b.c.width / 2, -b.c.height / 2);
    ctx.restore();
    const f = (t - t0 - 0.3) / 0.22;
    if (f > 0 && f < 1) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (1 - f) * 0.6;
      ctx.drawImage(glow("rgba(255,230,180,1)"), COL.x - 280, cy - 120, 560, 240);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function drawBomb(ctx: Ctx, b: (typeof bombs)[number], t: number) {
    if (t < b.t0 || t >= b.tBoom) return;
    const k = easeOutBack(span(t, b.t0, b.t0 + 0.3));
    // swells just before it goes
    const swell = 1 + 0.25 * span(t, b.tBoom - 0.35, b.tBoom) + 0.04 * Math.sin(t * 40) * span(t, b.tBoom - 0.6, b.tBoom);
    ctx.save();
    ctx.translate(b.x, b.y - (1 - k) * 60);
    ctx.rotate(b.rot);
    ctx.scale(1.45 * k * swell, 1.45 * k * swell);
    // body
    const g = ctx.createRadialGradient(-7, -7, 2, 0, 0, 24);
    g.addColorStop(0, "#5a5f6e");
    g.addColorStop(0.5, "#1d2029");
    g.addColorStop(1, "#07080c");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(-8, -9, 6, 3.5, -0.6, 0, Math.PI * 2);
    ctx.fill();
    // cap and fuse
    ctx.fillStyle = "#2a2d36";
    ctx.fillRect(-7, -28, 14, 9);
    ctx.strokeStyle = "#c9a26b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.quadraticCurveTo(4, -40, 13, -42);
    ctx.stroke();
    ctx.restore();
    // the lit fuse spark (in screen space so it stays round)
    const z = 1.45 * k * swell;
    const fx = b.x + Math.cos(b.rot) * 13 * z - Math.sin(b.rot) * -42 * z;
    const fy = b.y - (1 - k) * 60 + Math.sin(b.rot) * 13 * z + Math.cos(b.rot) * -42 * z;
    ctx.globalCompositeOperation = "lighter";
    const fl = 1 + 0.35 * Math.sin(t * 53) + 0.2 * Math.sin(t * 31);
    ctx.drawImage(glow("rgba(255,170,60,1)"), fx - 26 * fl, fy - 26 * fl, 52 * fl, 52 * fl);
    ctx.strokeStyle = "#fff3b0";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = t * 9 + i * 1.05;
      const r = 8 + 6 * Math.abs(Math.sin(t * 27 + i));
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(a) * r, fy + Math.sin(a) * r);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  function drawSmoke(ctx: Ctx, b: (typeof bombs)[number], t: number) {
    const dt = t - b.tBoom;
    if (dt < 0 || dt > 1.4) return;
    const k = dt / 1.4;
    ctx.globalAlpha = 0.35 * (1 - k);
    for (let j = 0; j < 5; j++) {
      const a = j * 1.26 + b.rot;
      const r = 30 + 70 * Math.sqrt(k);
      ctx.drawImage(glow("rgba(190,180,200,0.9)", "rgba(220,210,230,1)"), b.x + Math.cos(a) * r * 0.6 - r, b.y - 40 * k + Math.sin(a) * r * 0.4 - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx: Ctx, t: number, scale = 1) {
    const sh = shake(t);
    const fl = flash(t);
    const loopPhase = ((t - VANAKKAM.loopFrom) / PERIOD) * Math.PI * 2;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(img(bg), 0, 0);
    ctx.fillStyle = "#fff";
    for (const s of stars) {
      ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(loopPhase * s.k + s.ph));
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // fireworks in the sky behind him
    for (const b of bursts) drawBurst(ctx, b, t);

    ctx.setTransform(scale, 0, 0, scale, sh.x * scale, sh.y * scale);

    // warm halo behind his head, breathing with the light
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (0.35 + 0.4 * fl) * span(t, 0.2, 0.9);
    ctx.drawImage(glow("rgba(255,150,70,0.8)", "rgba(255,210,150,1)"), HEAD.x - 420, HEAD.y - 420, 840, 840);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // the hero: rises in with a bounce, then a slow push-in that settles before the loop
    if (hero) {
      const rise = easeOutBack(span(t, 0, 0.6));
      const push = 1 + 0.045 * easeInOut(span(t, 0.6, VANAKKAM.loopFrom));
      const bob = Math.sin(loopPhase) * 3 * span(t, 0.6, 1.2);
      ctx.save();
      // scale about his bottom-left corner so the arm stays on the edge
      ctx.translate(HERO_X, H);
      ctx.scale(push, push);
      ctx.translate(-HERO_X, -H + (1 - rise) * 260 + bob);
      ctx.globalAlpha = span(t, 0, 0.25);
      if (rim) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, 0.45 + fl * 1.2) * span(t, 0.3, 0.9);
        ctx.drawImage(img(rim), HERO_X - 20, HERO_Y - 20);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = span(t, 0, 0.25);
      }
      ctx.drawImage(hero, HERO_X, HERO_Y, HERO_W, HERO_H);
      if (flat && fl > 0.01) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = fl * 0.2;
        ctx.drawImage(img(flat), HERO_X - 20, HERO_Y - 20);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // lettering
    slam(ctx, happy, HAPPY_Y, T_HAPPY, t, -0.04);
    slam(ctx, diwali, DIWALI_Y, T_DIWALI, t, 0.02);
    nameBlocks.forEach((b, i) => slam(ctx, b, NAME_Y + i * nameSize * 1.05, T_NAME + i * 0.12, t, -0.03));

    for (const b of bombs) drawSmoke(ctx, b, t);
    for (const b of bombs) drawBomb(ctx, b, t);
    for (const b of booms) drawBurst(ctx, b, t);

    // embers drifting up
    ctx.globalCompositeOperation = "lighter";
    for (const e of embers) {
      const k = (((t - VANAKKAM.loopFrom) / PERIOD) * e.cycles + e.ph) % 1;
      const p = k < 0 ? k + 1 : k;
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.7 * span(t, 0.8, 1.6);
      const x = e.x + Math.sin(p * 6.283 + e.ph * 9) * e.sway;
      const y = H + 20 - p * 420;
      ctx.drawImage(glow("rgba(255,180,80,1)"), x - e.size * 2, y - e.size * 2, e.size * 4, e.size * 4);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img(vignette), 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  const last = nameBlocks.length ? NAME_Y + (nameBlocks.length - 1) * nameSize * 1.05 + nameSize * 0.6 : DIWALI_Y + titleSize * 0.6;
  return { draw, name, textBottom: Math.min(H, last) };
}
