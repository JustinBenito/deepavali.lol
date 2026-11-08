// /4: a sparkler writes "Happy Diwali" and the name in light, throwing sparks as
// it goes; the written trail keeps glowing.
import { ctxOf, easeInOut, fitter, glows, H, img, lerp, seeded, span, W, type Ctx, type MakeCanvas, type Off, type Scene } from "../kit";

export const SPARKLER = { duration: 6, poster: 5, cta: 4.4 };
export const FONT_SCRIPT = "DeepScript";

const LINE_H = 300;

type Line = {
  glowLayer: Off;
  coreLayer: Off;
  top: number; // y of the layer on screen
  x0: number; // ink extents
  x1: number;
  headY: Float32Array; // where the stroke is, per column
  t0: number;
  t1: number;
  ink: { x: number; y: number }[]; // sample points for twinkles
};

export function createSparklerScene(rawName: string, makeCanvas: MakeCanvas): Scene {
  const name = rawName.trim();
  const rand = seeded("sparkler:" + name.toLowerCase());
  const glow = glows(makeCanvas);
  const fit = fitter(makeCanvas);

  const bg = makeCanvas(W, H);
  {
    const x = ctxOf(bg);
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#03040f");
    g.addColorStop(0.7, "#0b0d2a");
    g.addColorStop(1, "#24123a");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      x.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.5})`;
      const r = 0.4 + rand() * 1.1;
      x.fillRect(rand() * W, rand() * H * 0.8, r, r);
    }
    // distant warm city lights along the bottom
    for (let i = 0; i < 40; i++) {
      const cx = rand() * W;
      const cy = H - rand() * 60;
      const r = 20 + rand() * 50;
      const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, `rgba(255,${150 + rand() * 60},80,${0.12 + rand() * 0.12})`);
      rg.addColorStop(1, "rgba(255,150,80,0)");
      x.fillStyle = rg;
      x.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }

  function makeLine(text: string, size: number, centerY: number, t0: number, t1: number): Line {
    const top = centerY - LINE_H / 2;
    const mask = makeCanvas(W, LINE_H);
    const m = ctxOf(mask);
    m.font = `${size}px ${FONT_SCRIPT}`;
    m.textAlign = "center";
    m.textBaseline = "middle";
    m.fillStyle = "#fff";
    m.fillText(text, W / 2, LINE_H / 2);
    const data = m.getImageData(0, 0, W, LINE_H).data;

    const headY = new Float32Array(W);
    const ink: { x: number; y: number }[] = [];
    let x0 = W;
    let x1 = 0;
    let last = LINE_H / 2;
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let n = 0;
      for (let y = 0; y < LINE_H; y += 2) {
        if (data[(y * W + x) * 4 + 3] > 120) {
          sum += y;
          n++;
          if (rand() < 0.02) ink.push({ x, y: y + top });
        }
      }
      if (n) {
        last = sum / n;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
      headY[x] = last + top;
    }
    // smooth the path so the sparkler glides instead of jittering
    for (let pass = 0; pass < 3; pass++)
      for (let x = 2; x < W - 2; x++) headY[x] = (headY[x - 2] + headY[x - 1] + headY[x] + headY[x + 1] + headY[x + 2]) / 5;

    const glowLayer = makeCanvas(W, LINE_H);
    {
      const g = ctxOf(glowLayer);
      g.font = m.font;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = "rgba(255,150,40,1)";
      g.shadowBlur = 28;
      g.fillStyle = "rgba(255,170,60,0.9)";
      g.fillText(text, W / 2, LINE_H / 2);
      g.fillText(text, W / 2, LINE_H / 2);
    }
    const coreLayer = makeCanvas(W, LINE_H);
    {
      const c = ctxOf(coreLayer);
      c.font = m.font;
      c.textAlign = "center";
      c.textBaseline = "middle";
      const gr = c.createLinearGradient(0, 40, 0, LINE_H - 40);
      gr.addColorStop(0, "#fffbe8");
      gr.addColorStop(1, "#ffd98a");
      c.fillStyle = gr;
      c.fillText(text, W / 2, LINE_H / 2);
    }
    return { glowLayer, coreLayer, top, x0, x1, headY, t0, t1, ink };
  }

  const s1 = fit("Happy Diwali", (s) => `${s}px ${FONT_SCRIPT}`, 170, 1000);
  const lines = [makeLine("Happy Diwali", s1, name ? 240 : 330, 0.45, 2.3)];
  if (name) {
    const s2 = fit(name, (s) => `${s}px ${FONT_SCRIPT}`, 190, 1080);
    lines.push(makeLine(name, s2, 455, 2.5, 4.0));
  }
  const WRITE_END = lines[lines.length - 1].t1;

  // sparkler head position over time
  function head(t: number) {
    for (const l of lines) {
      if (t < l.t0) {
        // gliding in to the start of this line
        const prev = lines[lines.indexOf(l) - 1];
        const from = prev ? { x: prev.x1, y: prev.headY[prev.x1] } : { x: l.x0 - 120, y: l.headY[l.x0] + 80 };
        const k = easeInOut(span(t, prev ? prev.t1 : 0, l.t0));
        return { x: lerp(from.x, l.x0, k), y: lerp(from.y, l.headY[l.x0], k), writing: false };
      }
      if (t <= l.t1) {
        const x = Math.round(lerp(l.x0, l.x1, span(t, l.t0, l.t1)));
        return { x, y: l.headY[x], writing: true };
      }
    }
    const l = lines[lines.length - 1];
    const k = easeInOut(span(t, WRITE_END, WRITE_END + 0.8));
    return { x: l.x1 + 60 * k, y: l.headY[l.x1] - 40 * k, writing: false };
  }

  // sparks are spawned along the head's path at fixed times, so any frame can be drawn on its own
  type Spark = { t0: number; x: number; y: number; vx: number; vy: number; life: number; c: string };
  const sparks: Spark[] = [];
  const BURN_OUT = WRITE_END + 1.0;
  for (let t = 0.2; t < BURN_OUT; t += 1 / 700) {
    const h = head(t);
    const a = rand() * Math.PI * 2;
    const v = 80 + rand() * 320;
    sparks.push({ t0: t, x: h.x, y: h.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.15 + rand() * 0.35, c: rand() < 0.5 ? "rgba(255,240,200,1)" : "rgba(255,190,90,1)" });
  }

  function draw(ctx: Ctx, t: number, scale = 1) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(img(bg), 0, 0);

    // the written trail
    for (const l of lines) {
      const k = span(t, l.t0, l.t1);
      if (k <= 0) continue;
      const edge = lerp(l.x0, l.x1, k) + 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, l.top, edge, LINE_H);
      ctx.clip();
      const pulse = t > l.t1 ? 0.85 + 0.15 * Math.sin(t * 2.2) : 1;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.8 * pulse;
      ctx.drawImage(img(l.glowLayer), 0, l.top);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.drawImage(img(l.coreLayer), 0, l.top);
      ctx.restore();
      // freshly written strokes are white-hot near the head
      if (k < 1) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.5;
        ctx.drawImage(glow("rgba(255,200,120,0.8)"), edge - 90, l.headY[Math.round(edge)] - 70, 140, 140);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }

    // twinkles along finished lines
    ctx.globalCompositeOperation = "lighter";
    for (const l of lines) {
      if (t < l.t1) continue;
      l.ink.forEach((p, i) => {
        const tw = Math.sin(t * 5 + i * 1.7);
        if (tw < 0.85) return;
        ctx.globalAlpha = (tw - 0.85) / 0.15;
        ctx.drawImage(glow("rgba(255,230,170,1)"), p.x - 7, p.y - 7, 14, 14);
      });
    }
    ctx.globalAlpha = 1;

    // the sparkler: wire, burning head, sparks
    if (t < BURN_OUT + 0.4) {
      const h = head(Math.min(t, BURN_OUT));
      const life = 1 - span(t, BURN_OUT, BURN_OUT + 0.4);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = life;
      ctx.strokeStyle = "#6b6f7a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(h.x + 260, h.y + 520);
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      const f = 1 + 0.2 * Math.sin(t * 60);
      ctx.drawImage(glow("rgba(255,170,60,0.9)"), h.x - 60 * f, h.y - 60 * f, 120 * f, 120 * f);
      ctx.drawImage(glow("rgba(255,250,230,1)"), h.x - 14, h.y - 14, 28, 28);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255,225,160,1)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (const s of sparks) {
      const dt = t - s.t0;
      if (dt < 0) break;
      if (dt > s.life) continue;
      const x = s.x + s.vx * dt;
      const y = s.y + s.vy * dt + 150 * dt * dt;
      // short streak, sometimes forking like a real sparkler
      ctx.moveTo(x - s.vx * 0.045, y - s.vy * 0.045);
      ctx.lineTo(x, y);
      if (dt > s.life * 0.6 && (s.t0 * 1000) % 3 < 1) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + s.vy * 0.04, y - s.vx * 0.04);
      }
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, name, textBottom: name ? 540 : 430 };
}
