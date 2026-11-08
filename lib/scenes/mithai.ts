// /5: a wreath of Diwali sweets pops in around the wish, on a subtle cream
// background. Sweets come from one atlas image (public/sweets/sweets.webp).
import { ctxOf, easeOut, easeOutBack, fitter, glows, H, img, seeded, span, W, type Ctx, type MakeCanvas, type Scene } from "../kit";

export const MITHAI = { duration: 6, poster: 4.8, cta: 3.6 };
export const SWEETS_URL = "/sweets/sweets.webp";
export const FONT_SCRIPT = "DeepScript";
export const FONT_HEAVY = "DeepHeavy";
export const FONT_SEMI = "DeepSemi";

// [x, y, w, h] of each sweet in the atlas
const RECTS = [
  [6, 20, 244, 216], [262, 13, 244, 229], [518, 24, 244, 208], [774, 36, 244, 184], [1030, 15, 244, 225],
  [6, 274, 244, 219], [262, 289, 244, 190], [518, 275, 244, 218], [774, 287, 244, 193], [1030, 280, 244, 207],
  [6, 538, 244, 203], [262, 549, 244, 182], [518, 544, 244, 191], [774, 531, 244, 217], [1030, 550, 244, 180],
  [6, 790, 244, 211], [262, 791, 244, 209], [518, 789, 244, 214], [774, 799, 244, 194], [1030, 798, 244, 196],
];
const SILVER = new Set([2, 10, 17]); // sweets with silver vark, which glint
// order around the wreath, chosen so colours and shapes alternate
const ORDER = [3, 0, 4, 2, 1, 13, 8, 18, 10, 7, 14, 12, 5, 16, 6, 19, 11, 17, 9, 15];

const C = { x: 640, y: 360 };
const RX = 548;
const RY = 286;
const SIZE = 122; // drawn size of a sweet's longer side

export function createMithaiScene(rawName: string, makeCanvas: MakeCanvas, atlas?: CanvasImageSource): Scene {
  const name = rawName.trim();
  const rand = seeded("mithai:" + name.toLowerCase());
  const glow = glows(makeCanvas);
  const fit = fitter(makeCanvas);

  // subtle background: warm cream, a faint gold mandala watermark, soft vignette
  const bg = makeCanvas(W, H);
  {
    const x = ctxOf(bg);
    const g = x.createRadialGradient(C.x, C.y, 60, C.x, C.y, 820);
    g.addColorStop(0, "#fffaf2");
    g.addColorStop(1, "#f3dfc6");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    x.strokeStyle = "rgba(190,140,60,0.10)";
    x.lineWidth = 1.5;
    for (let r = 80; r < 760; r += 46) {
      x.beginPath();
      x.arc(C.x, C.y, r, 0, Math.PI * 2);
      x.stroke();
    }
    x.fillStyle = "rgba(190,140,60,0.10)";
    for (let r = 103; r < 760; r += 92)
      for (let i = 0, n = Math.round(r / 9); i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        x.beginPath();
        x.arc(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r, 2.4, 0, Math.PI * 2);
        x.fill();
      }
    // petals around the centre, very faint
    for (let i = 0; i < 16; i++) {
      x.save();
      x.translate(C.x, C.y);
      x.rotate((i / 16) * Math.PI * 2);
      x.strokeStyle = "rgba(190,140,60,0.08)";
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(140, 0);
      x.quadraticCurveTo(230, -40, 320, 0);
      x.quadraticCurveTo(230, 40, 140, 0);
      x.stroke();
      x.restore();
    }
  }

  const sweets = ORDER.map((ai, k) => {
    const a = -Math.PI / 2 + (k / ORDER.length) * Math.PI * 2;
    const [sx, sy, sw, sh] = RECTS[ai];
    const s = SIZE / Math.max(sw, sh);
    return {
      ai,
      rect: RECTS[ai],
      x: C.x + Math.cos(a) * RX,
      y: C.y + Math.sin(a) * RY,
      w: sw * s,
      h: sh * s,
      t0: 0.2 + k * 0.08,
      tilt: (rand() - 0.5) * 0.14,
      ph: rand() * 10,
      glint: { dx: (rand() - 0.5) * 0.5, dy: -0.15 - rand() * 0.2, every: 2.2 + rand() * 1.4, at: rand() },
    };
  });

  const dust = Array.from({ length: 34 }, () => ({ x: 140 + rand() * 1000, y: 120 + rand() * 480, ph: rand() * 10, s: 3 + rand() * 4 }));

  const scriptSize = fit("Happy Diwali", (s) => `${s}px ${FONT_SCRIPT}`, 124, 760);
  const nameSize = name ? fit(name, (s) => `800 ${s}px ${FONT_HEAVY}`, 116, 760) : 0;

  function drawSweet(ctx: Ctx, sw: (typeof sweets)[number], t: number) {
    const k = span(t, sw.t0, sw.t0 + 0.5);
    if (k <= 0 || !atlas) return;
    const s = easeOutBack(k);
    const bob = t > sw.t0 + 0.5 ? Math.sin(t * 1.6 + sw.ph) * 3 : 0;
    const drop = (1 - easeOut(k)) * -36;
    // soft shadow on the "table"
    ctx.globalAlpha = 0.22 * easeOut(k);
    ctx.fillStyle = "#7a3d12";
    ctx.beginPath();
    ctx.ellipse(sw.x, sw.y + sw.h * 0.42, sw.w * 0.42 * s, sw.h * 0.1 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(sw.x, sw.y + drop + bob);
    ctx.rotate(sw.tilt);
    ctx.scale(s, s);
    const [ax, ay, aw, ah] = sw.rect;
    ctx.drawImage(atlas, ax, ay, aw, ah, -sw.w / 2, -sw.h / 2, sw.w, sw.h);
    ctx.restore();
    // silver vark catches the light now and then
    if (SILVER.has(sw.ai) && k >= 1) {
      const g = ((t / sw.glint.every + sw.glint.at) % 1) * 4;
      if (g < 1) {
        const a = Math.sin(g * Math.PI);
        const gx = sw.x + sw.glint.dx * sw.w;
        const gy = sw.y + sw.glint.dy * sw.h + bob;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a;
        ctx.drawImage(glow("rgba(255,255,255,0.9)"), gx - 16, gy - 16, 32, 32);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 ? 2 : 13 * a;
          const ang = (i / 8) * Math.PI * 2;
          ctx.lineTo(gx + Math.cos(ang) * r, gy + Math.sin(ang) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }

  function draw(ctx: Ctx, t: number, scale = 1) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(img(bg), 0, 0);

    // faint sugar sparkle
    ctx.globalCompositeOperation = "lighter";
    for (const d of dust) {
      const tw = Math.sin(t * 2 + d.ph);
      if (tw < 0.6) continue;
      ctx.globalAlpha = ((tw - 0.6) / 0.4) * 0.6 * easeOut(span(t, 1, 2));
      ctx.drawImage(glow("rgba(255,200,90,0.9)"), d.x - d.s, d.y - d.s, d.s * 2, d.s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // back of the wreath first, so lower sweets overlap the ones behind them
    for (const sw of [...sweets].sort((a, b) => a.y - b.y)) drawSweet(ctx, sw, t);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const a = easeOut(span(t, 1.4, 2.2));
    ctx.globalAlpha = a;
    ctx.font = `${scriptSize}px ${FONT_SCRIPT}`;
    ctx.fillStyle = "#8a1538";
    ctx.fillText("Happy Diwali", C.x, 255 + (1 - a) * 14);
    if (name) {
      const b = span(t, 1.9, 2.5);
      ctx.globalAlpha = Math.min(1, b * 3);
      ctx.save();
      ctx.translate(C.x, 372);
      const s = 0.85 + 0.15 * easeOutBack(b);
      ctx.scale(s, s);
      ctx.font = `800 ${nameSize}px ${FONT_HEAVY}`;
      const g = ctx.createLinearGradient(0, -nameSize / 2, 0, nameSize / 2);
      g.addColorStop(0, "#d81b60");
      g.addColorStop(1, "#ef6c00");
      ctx.fillStyle = g;
      ctx.fillText(name, 0, 0);
      ctx.restore();
    }
    const c = easeOut(span(t, 2.6, 3.3));
    ctx.globalAlpha = c;
    ctx.font = `600 24px ${FONT_SEMI}`;
    ctx.fillStyle = "#8a5a44";
    ctx.fillText("May your Diwali be as sweet as you", C.x, 460);
    for (let i = -4; i <= 4; i++) {
      ctx.fillStyle = i % 2 ? "#e6a23c" : "#d81b60";
      ctx.beginPath();
      ctx.arc(C.x + i * 16, 497, 3.2 * c, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, name, textBottom: 510 };
}
