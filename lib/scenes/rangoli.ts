// /3: a rangoli mandala pours itself ring by ring, in coloured powder, beside the
// wish. Clean and bright.
import { ctxOf, easeOut, easeOutBack, fitter, H, img, seeded, span, W, type Ctx, type MakeCanvas, type Off, type Scene } from "../kit";

export const RANGOLI = { duration: 6, poster: 5.2, cta: 3.8 };
export const FONT_SCRIPT = "DeepScript";
export const FONT_HEAVY = "DeepHeavy";
export const FONT_SEMI = "DeepSemi";

const C = { x: 975, y: 360 }; // mandala centre
const SIZE = 720; // ring layer canvas size

type Ring = { layer: Off; t0: number; t1: number };

export function createRangoliScene(rawName: string, makeCanvas: MakeCanvas): Scene {
  const name = rawName.trim();
  const rand = seeded("rangoli:" + name.toLowerCase());
  const fit = fitter(makeCanvas);

  // background: warm paper with a soft vignette
  const bg = makeCanvas(W, H);
  {
    const x = ctxOf(bg);
    x.fillStyle = "#fff4e4";
    x.fillRect(0, 0, W, H);
    const g = x.createRadialGradient(C.x, C.y, 100, C.x, C.y, 900);
    g.addColorStop(0, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(214,150,100,0.35)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 2500; i++) {
      x.fillStyle = `rgba(150,90,40,${0.03 + rand() * 0.04})`;
      x.fillRect(rand() * W, rand() * H, 1.5, 1.5);
    }
  }

  // --- the mandala, one pre-drawn layer per ring ---
  const ring = (t0: number, t1: number, paint: (x: Ctx) => void): Ring => {
    const layer = makeCanvas(SIZE, SIZE);
    const x = ctxOf(layer);
    x.translate(SIZE / 2, SIZE / 2);
    paint(x);
    return { layer, t0, t1 };
  };
  // powder texture: a sprinkle of grains over and just around each shape
  const grains = (x: Ctx, cx: number, cy: number, r: number, color: string, n = 40) => {
    x.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r;
      x.globalAlpha = 0.25 + rand() * 0.5;
      x.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.6, 1.6);
    }
    x.globalAlpha = 1;
  };
  const petal = (x: Ctx, a: number, r0: number, len: number, wid: number, fill: string, edge: string) => {
    x.save();
    x.rotate(a);
    x.translate(r0, 0);
    x.fillStyle = fill;
    x.beginPath();
    x.moveTo(0, 0);
    x.quadraticCurveTo(len * 0.45, -wid, len, 0);
    x.quadraticCurveTo(len * 0.45, wid, 0, 0);
    x.fill();
    x.strokeStyle = edge;
    x.lineWidth = 2.5;
    x.beginPath();
    x.moveTo(len * 0.15, 0);
    x.quadraticCurveTo(len * 0.45, -wid * 0.45, len * 0.82, 0);
    x.quadraticCurveTo(len * 0.45, wid * 0.45, len * 0.15, 0);
    x.stroke();
    grains(x, len * 0.5, 0, wid * 1.1, fill);
    x.restore();
  };
  const dotRing = (x: Ctx, r: number, n: number, size: number, colors: string[]) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      x.fillStyle = colors[i % colors.length];
      x.beginPath();
      x.arc(Math.cos(a) * r, Math.sin(a) * r, size, 0, Math.PI * 2);
      x.fill();
      grains(x, Math.cos(a) * r, Math.sin(a) * r, size * 1.6, colors[i % colors.length], 8);
    }
  };

  const rings: Ring[] = [
    ring(0.2, 0.7, (x) => {
      x.fillStyle = "#c2185b";
      x.beginPath();
      x.arc(0, 0, 30, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = "#ffc93c";
      x.lineWidth = 6;
      x.beginPath();
      x.arc(0, 0, 38, 0, Math.PI * 2);
      x.stroke();
      dotRing(x, 14, 6, 4, ["#fff"]);
    }),
    ring(0.5, 1.1, (x) => {
      for (let i = 0; i < 8; i++) petal(x, (i / 8) * Math.PI * 2, 42, 78, 30, "#e91e63", "#ffd6e5");
    }),
    ring(1.0, 1.4, (x) => dotRing(x, 132, 32, 6, ["#ffc93c", "#fff3c4"])),
    ring(1.2, 1.9, (x) => {
      for (let i = 0; i < 12; i++) petal(x, ((i + 0.5) / 12) * Math.PI * 2, 140, 74, 26, "#ff7b00", "#ffe0b2");
    }),
    ring(1.6, 2.2, (x) => {
      for (let i = 0; i < 12; i++) petal(x, (i / 12) * Math.PI * 2, 150, 46, 14, "#00a6a6", "#c8fff4");
    }),
    ring(2.0, 2.7, (x) => {
      for (let i = 0; i < 16; i++) petal(x, (i / 16) * Math.PI * 2, 222, 82, 24, "#6a1b9a", "#e9d0ff");
    }),
    ring(2.5, 3.0, (x) => dotRing(x, 318, 40, 7, ["#ffffff", "#ffc93c", "#e91e63"])),
    ring(2.8, 3.5, (x) => {
      // scalloped border
      const n = 30;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        x.strokeStyle = "#c2185b";
        x.lineWidth = 6;
        x.beginPath();
        x.arc(Math.cos(a) * 340, Math.sin(a) * 340, 22, a - Math.PI / 2, a + Math.PI / 2);
        x.stroke();
      }
    }),
  ];

  // marigold petals drifting down
  const petals = Array.from({ length: 22 }, () => ({ x: rand() * W, y0: -40 - rand() * H, v: 30 + rand() * 40, spin: (rand() - 0.5) * 3, c: rand() < 0.6 ? "#ff8c1a" : "#ffc21a", s: 5 + rand() * 5 }));

  // --- lettering ---
  const scriptSize = fit("Happy Diwali", (s) => `${s}px ${FONT_SCRIPT}`, 116, 470);
  const nameSize = fit(name || " ", (s) => `800 ${s}px ${FONT_HEAVY}`, 116, 500);
  const TEXT_X = 300;

  function drawText(ctx: Ctx, t: number) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const a = easeOut(span(t, 0.7, 1.5));
    ctx.globalAlpha = a;
    ctx.font = `${scriptSize}px ${FONT_SCRIPT}`;
    ctx.fillStyle = "#8a1538";
    ctx.fillText("Happy Diwali", TEXT_X, 255 + (1 - a) * 16);
    const b = easeOut(span(t, 1.3, 2.1));
    if (name) {
      ctx.globalAlpha = b;
      ctx.font = `800 ${nameSize}px ${FONT_HEAVY}`;
      const g = ctx.createLinearGradient(0, 330, 0, 450);
      g.addColorStop(0, "#e91e63");
      g.addColorStop(1, "#ff7b00");
      ctx.fillStyle = g;
      ctx.fillText(name, TEXT_X, 385 + (1 - b) * 16);
    }
    const c = easeOut(span(t, 2.1, 2.9));
    ctx.globalAlpha = c;
    ctx.font = `600 22px ${FONT_SEMI}`;
    ctx.fillStyle = "#8a5a44";
    ctx.fillText("Wishing you light, love & laddoos", TEXT_X, 475);
    // small dotted rule
    for (let i = -6; i <= 6; i++) {
      ctx.fillStyle = i % 2 ? "#ffc93c" : "#e91e63";
      ctx.beginPath();
      ctx.arc(TEXT_X + i * 14, 512, 3 * c, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx: Ctx, t: number, scale = 1) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(img(bg), 0, 0);

    const spin = t * 0.05;
    for (const r of rings) {
      const k = span(t, r.t0, r.t1);
      if (k <= 0) continue;
      ctx.save();
      ctx.translate(C.x, C.y);
      ctx.rotate(spin);
      // poured around the circle: a growing wedge, with a little settle
      if (k < 1) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, SIZE, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * easeOut(k));
        ctx.closePath();
        ctx.clip();
      }
      const s = 0.92 + 0.08 * easeOutBack(span(t, r.t0, r.t1 + 0.3));
      ctx.scale(s, s);
      ctx.drawImage(img(r.layer), -SIZE / 2, -SIZE / 2);
      ctx.restore();
    }

    for (const p of petals) {
      const fall = p.y0 + p.v * t;
      if (fall < -40) continue; // not in view yet
      const y = ((fall + 40) % (H + 80)) - 40;
      ctx.save();
      ctx.translate(p.x + Math.sin(t + p.x) * 20, y);
      ctx.rotate(t * p.spin);
      ctx.fillStyle = p.c;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    drawText(ctx, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, name, textBottom: 530 };
}
