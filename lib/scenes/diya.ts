// /2: a single diya lights up in a dark warm room; the wish is revealed in gold
// script by a sweep of light. Clean and calm.
import { ctxOf, easeOut, fitter, glows, H, img, lerp, seeded, span, W, type Ctx, type MakeCanvas, type Scene } from "../kit";

export const DIYA = { duration: 6, poster: 5, cta: 3.9 };
export const FONT_SCRIPT = "DeepScript";
export const FONT_SEMI = "DeepSemi";

const DIYA_POS = { x: 620, y: 600 };

export function createDiyaScene(rawName: string, makeCanvas: MakeCanvas): Scene {
  const name = rawName.trim();
  const rand = seeded("diya:" + name.toLowerCase());
  const glow = glows(makeCanvas);
  const fit = fitter(makeCanvas);

  // background, baked once
  const bg = makeCanvas(W, H);
  {
    const x = ctxOf(bg);
    const g = x.createRadialGradient(640, 520, 20, 640, 520, 900);
    g.addColorStop(0, "#3d0d16");
    g.addColorStop(0.45, "#16040b");
    g.addColorStop(1, "#050104");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }

  const bokeh = Array.from({ length: 26 }, () => ({
    x: rand() * W,
    y: rand() * H * 0.85,
    r: 20 + rand() * 60,
    a: 0.05 + rand() * 0.1,
    c: ["rgba(255,179,107,1)", "rgba(255,122,89,1)", "rgba(255,210,122,1)"][Math.floor(rand() * 3)],
    ph: rand() * 10,
  }));
  const embers = Array.from({ length: 34 }, () => ({ period: 2.2 + rand() * 1.8, ph: rand(), sway: 20 + rand() * 50, size: 2 + rand() * 3 }));
  const dots = Array.from({ length: 40 }, (_, i) => {
    const a = Math.PI * (i / 39);
    // a shallow arc in front of the diya
    return { x: 640 + Math.cos(a) * 330, y: 640 + 34 * Math.sin(a), c: ["#ffd36b", "#ff6f91", "#fff3d6"][i % 3], i };
  });

  // "Happy Diwali" in gold script, baked with its glow
  const scriptSize = fit("Happy Diwali", (s) => `${s}px ${FONT_SCRIPT}`, 168, 980);
  const script = makeCanvas(W, 260);
  {
    const x = ctxOf(script);
    x.font = `${scriptSize}px ${FONT_SCRIPT}`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    const g = x.createLinearGradient(0, 40, 0, 220);
    g.addColorStop(0, "#fff4d0");
    g.addColorStop(0.5, "#ffd36b");
    g.addColorStop(1, "#c8862a");
    x.shadowColor = "rgba(255,190,90,0.7)";
    x.shadowBlur = 30;
    x.fillStyle = g;
    x.fillText("Happy Diwali", W / 2, 130);
    x.shadowBlur = 0;
    x.fillText("Happy Diwali", W / 2, 130);
  }
  const SCRIPT_Y = 205; // centre of the script line on screen

  // the name, letter-spaced capitals
  const upper = name.toLocaleUpperCase();
  const nameSize = fit(upper.split("").join("  "), (s) => `600 ${s}px ${FONT_SEMI}`, 56, 820);
  const measure = ctxOf(makeCanvas(8, 8));
  measure.font = `600 ${nameSize}px ${FONT_SEMI}`;
  const tracking = nameSize * 0.32;
  const chars = [...upper].map((ch) => ({ ch, w: measure.measureText(ch).width }));
  const nameW = chars.reduce((a, c) => a + c.w, 0) + tracking * Math.max(0, chars.length - 1);
  const NAME_Y = 335;

  function drawDiya(ctx: Ctx, t: number) {
    const { x, y } = DIYA_POS;
    const s = 4.2;
    const lit = easeOut(span(t, 0.55, 1.35));
    // pool of light on the floor
    if (lit > 0) {
      ctx.globalCompositeOperation = "lighter";
      const f = 1 + 0.06 * Math.sin(t * 9) + 0.04 * Math.sin(t * 23);
      ctx.globalAlpha = 0.55 * lit;
      ctx.drawImage(glow("rgba(255,140,50,0.8)", "rgba(255,200,120,1)"), x - 520 * f, y - 330 * f, 1040 * f, 660 * f);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const g = ctx.createLinearGradient(-16, 0, 18, 0);
    g.addColorStop(0, "#5a1d0a");
    g.addColorStop(0.45, "#c45a25");
    g.addColorStop(1, "#4a1608");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-16, -9);
    ctx.quadraticCurveTo(-7, 7, 9, 2);
    ctx.quadraticCurveTo(17, -3, 20, -11);
    ctx.lineTo(11, -9);
    ctx.quadraticCurveTo(0, -5, -16, -9);
    ctx.fill();
    ctx.fillStyle = "#3a1206";
    ctx.beginPath();
    ctx.ellipse(1, -9, 15, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,190,90,0.5)";
    ctx.fillRect(-11, -4, 18, 0.8); // painted band
    ctx.restore();

    // flame on the wick at the spout
    const fx = x + 15 * s;
    const fy = y - 13 * s;
    if (lit > 0) {
      const fl = lit * (1 + 0.1 * Math.sin(t * 13) + 0.07 * Math.sin(t * 29));
      const sway = Math.sin(t * 4.3) * 3 * lit;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.9 * lit;
      ctx.drawImage(glow("rgba(255,150,50,0.9)"), fx - 70 * fl, fy - 95 * fl, 140 * fl, 140 * fl);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      const layer = (h: number, w: number, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(fx + sway, fy - h * fl);
        ctx.quadraticCurveTo(fx + w, fy - h * 0.3 * fl, fx, fy);
        ctx.quadraticCurveTo(fx - w, fy - h * 0.3 * fl, fx + sway, fy - h * fl);
        ctx.fill();
      };
      layer(62, 17, "rgba(255,140,40,0.95)");
      layer(46, 11, "rgba(255,210,110,1)");
      layer(28, 6, "rgba(255,250,225,1)");
      ctx.fillStyle = "rgba(110,150,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(fx, fy - 3, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // the moment it catches
    const k = span(t, 0.5, 0.75);
    if (k > 0 && k < 1) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - k;
      ctx.drawImage(glow("rgba(255,240,200,1)"), fx - 60, fy - 60, 120, 120);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    return { fx, fy, lit };
  }

  function draw(ctx: Ctx, t: number, scale = 1) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(img(bg), 0, 0);

    // drifting bokeh
    ctx.globalCompositeOperation = "lighter";
    const warm = easeOut(span(t, 0.6, 2));
    for (const b of bokeh) {
      ctx.globalAlpha = b.a * (0.35 + 0.65 * warm) * (0.7 + 0.3 * Math.sin(t * 0.8 + b.ph));
      const dx = Math.sin(t * 0.15 + b.ph) * 20;
      ctx.drawImage(glow(b.c, b.c), b.x + dx - b.r, b.y - t * 4 - b.r, b.r * 2, b.r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // rangoli dots on the floor around the diya
    for (const d of dots) {
      const k = easeOut(span(t, 1.5 + Math.abs(d.i - 19.5) * 0.035, 1.9 + Math.abs(d.i - 19.5) * 0.035));
      if (k <= 0) continue;
      ctx.globalAlpha = k * 0.9;
      ctx.fillStyle = d.c;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 3.5 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const { fx, fy, lit } = drawDiya(ctx, t);

    // embers drifting up from the flame
    if (lit > 0.5) {
      ctx.globalCompositeOperation = "lighter";
      for (const e of embers) {
        const k = ((t - 1.2) / e.period + e.ph) % 1;
        if (t < 1.2 + e.ph * e.period * 0.2) continue;
        const ex = fx + Math.sin(k * 6 + e.ph * 9) * e.sway * k;
        const ey = fy - 60 - k * 150;
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8;
        ctx.drawImage(glow("rgba(255,180,80,1)"), ex - e.size * 2, ey - e.size * 2, e.size * 4, e.size * 4);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // "Happy Diwali": revealed left to right by a band of light
    const r = span(t, 1.3, 2.7);
    if (r > 0) {
      const edge = lerp(140, 1140, easeOut(r));
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, edge, H);
      ctx.clip();
      ctx.drawImage(img(script), 0, SCRIPT_Y - 130);
      ctx.restore();
      // the sweep band, and a slow shimmer that returns every few seconds
      const shimmer = r < 1 ? edge : lerp(100, 1180, ((t - 2.7) / 3.2) % 1);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = r < 1 ? 0.9 : 0.35;
      ctx.drawImage(glow("rgba(255,235,190,0.8)"), shimmer - 60, SCRIPT_Y - 110, 120, 220);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // the name with gold rules either side
    const n = easeOut(span(t, 2.5, 3.3));
    if (n > 0 && name) {
      ctx.globalAlpha = n;
      ctx.font = `600 ${nameSize}px ${FONT_SEMI}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillStyle = "#fff1d6";
      let x = W / 2 - nameW / 2;
      const y = NAME_Y + (1 - n) * 14;
      for (const c of chars) {
        ctx.fillText(c.ch, x, y);
        x += c.w + tracking;
      }
      const rule = 140 * easeOut(span(t, 2.8, 3.6));
      ctx.strokeStyle = "rgba(255,205,120,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W / 2 - nameW / 2 - 30, NAME_Y);
      ctx.lineTo(W / 2 - nameW / 2 - 30 - rule, NAME_Y);
      ctx.moveTo(W / 2 + nameW / 2 + 30, NAME_Y);
      ctx.lineTo(W / 2 + nameW / 2 + 30 + rule, NAME_Y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, name, textBottom: NAME_Y + 40 };
}
