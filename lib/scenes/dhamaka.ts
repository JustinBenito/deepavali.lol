// /6: comic-book dhamaka. A ladi of crackers goes off one by one along its fuse,
// with BOOM!/PATAKA! bubbles, then the wish slams in.
import { ctxOf, easeOutBack, fitter, H, img, seeded, span, W, type Ctx, type MakeCanvas, type Scene } from "../kit";

export const DHAMAKA = { duration: 6, poster: 4.6, cta: 4 };
export const FONT_COMIC = "DeepComic";

const N = 18; // crackers on the ladi
const FUSE = { t0: 0.5, t1: 2.6 };
const SFX = ["BOOM!", "DHAM!", "PATAKA!", "BANG!", "DHISHUM!", "KABOOM!"];
const FLOOR = 680; // where confetti comes to rest

export function createDhamakaScene(rawName: string, makeCanvas: MakeCanvas): Scene {
  const name = rawName.trim();
  const rand = seeded("dhamaka:" + name.toLowerCase());
  const fit = fitter(makeCanvas);

  // sunburst + halftone, baked
  const bg = makeCanvas(W, H);
  {
    const x = ctxOf(bg);
    const g = x.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, 820);
    g.addColorStop(0, "#fff36b");
    g.addColorStop(0.45, "#ffb02e");
    g.addColorStop(1, "#e3261b");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    // halftone dots, bigger toward the edges
    for (let y = 0; y < H; y += 16)
      for (let i = 0; i < W / 16 + 1; i++) {
        const px = i * 16 + ((y / 16) % 2 ? 8 : 0);
        const d = Math.hypot(px - W / 2, y - H * 0.42) / 760;
        x.fillStyle = "rgba(120,0,0,0.16)";
        x.beginPath();
        x.arc(px, y, 1 + d * 4.5, 0, Math.PI * 2);
        x.fill();
      }
  }

  // the ladi hangs in a shallow curve across the lower third
  const ladiPoint = (k: number) => ({ x: 110 + k * (W - 220), y: 560 + Math.sin(k * Math.PI) * 50 });
  const crackers = Array.from({ length: N }, (_, i) => {
    const k = (i + 0.5) / N;
    const p = ladiPoint(k);
    return {
      ...p,
      k,
      side: i % 2 ? 1 : -1,
      tBoom: FUSE.t0 + k * (FUSE.t1 - FUSE.t0),
      bits: Array.from({ length: 12 }, () => ({ a: -Math.PI / 2 + (rand() - 0.5) * 3, v: 180 + rand() * 380, spin: (rand() - 0.5) * 20, c: rand() < 0.75 ? "#d81b1b" : "#ffd23f", w: 6 + rand() * 6 })),
      rot: rand() * Math.PI,
    };
  });
  const bubbles = crackers
    .filter((_, i) => i % 3 === 1)
    .map((c, j) => ({ x: c.x + (rand() - 0.5) * 60, y: c.y - 130 - rand() * 50, t0: c.tBoom, text: SFX[j % SFX.length], rot: (rand() - 0.5) * 0.4, r: 82 + rand() * 18 }));
  bubbles.push({ x: 1090, y: 150, t0: 4.3, text: "PATAKA!", rot: 0.15, r: 100 });

  const s1 = fit("HAPPY DIWALI", (s) => `${s}px ${FONT_COMIC}`, 140, 1000);
  const s2 = name ? fit(name.toLocaleUpperCase(), (s) => `${s}px ${FONT_COMIC}`, 190, 1080) : 0;
  const T1 = 2.7;
  const T2 = 3.0;

  function starburst(ctx: Ctx, x: number, y: number, r: number, spikes: number, rot: number) {
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = rot + (i / (spikes * 2)) * Math.PI * 2;
      const rr = i % 2 ? r * 0.62 : r * (0.95 + 0.1 * ((i * 7) % 3) / 2);
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  function comicText(ctx: Ctx, text: string, x: number, y: number, size: number, fill: string, shadow: string) {
    ctx.font = `${size}px ${FONT_COMIC}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.fillStyle = shadow;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = size * 0.12;
    ctx.strokeText(text, x + size * 0.06, y + size * 0.06);
    ctx.fillText(text, x + size * 0.06, y + size * 0.06);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  function slam(ctx: Ctx, t: number, t0: number, draw: () => void) {
    const k = span(t, t0, t0 + 0.3);
    if (k <= 0) return;
    const s = 2.2 - 1.2 * easeOutBack(k);
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 4);
    ctx.translate(W / 2, 0);
    ctx.scale(s, s);
    ctx.translate(-W / 2, 0);
    draw();
    ctx.restore();
  }

  function draw(ctx: Ctx, t: number, scale = 1) {
    // shake on every bang and on the slams
    let shake = 0;
    for (const c of crackers) if (t > c.tBoom && t < c.tBoom + 0.12) shake += 3 * (1 - (t - c.tBoom) / 0.12);
    for (const ts of [T1 + 0.25, T2 + 0.25]) if (t > ts && t < ts + 0.2) shake += 9 * (1 - (t - ts) / 0.2);
    const sx = Math.sin(t * 91) * shake;
    const sy = Math.cos(t * 79) * shake;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(img(bg), 0, 0);
    // turning speed lines
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    for (let i = 0; i < 24; i += 2) {
      const a0 = t * 0.1 + (i / 24) * Math.PI * 2;
      const a1 = a0 + Math.PI / 24;
      ctx.moveTo(W / 2, H * 0.42);
      ctx.lineTo(W / 2 + Math.cos(a0) * 1500, H * 0.42 + Math.sin(a0) * 1500);
      ctx.lineTo(W / 2 + Math.cos(a1) * 1500, H * 0.42 + Math.sin(a1) * 1500);
    }
    ctx.fill();

    ctx.setTransform(scale, 0, 0, scale, sx * scale, sy * scale);

    // the string and the fuse spark running along it
    const burnt = span(t, FUSE.t0, FUSE.t1);
    ctx.strokeStyle = "#3a2a1a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let k = Math.max(burnt, 0); k <= 1.0001; k += 0.02) {
      const p = ladiPoint(Math.min(k, 1));
      if (k === Math.max(burnt, 0)) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    if (burnt > 0 && burnt < 1) {
      const p = ladiPoint(burnt);
      starburst(ctx, p.x, p.y, 16 + Math.sin(t * 50) * 4, 8, t * 9);
      ctx.fillStyle = "#fff6b0";
      ctx.fill();
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (const c of crackers) {
      const dt = t - c.tBoom;
      if (dt < 0) {
        // the cracker, hanging off the string
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.side * 0.5 + Math.sin(t * 3 + c.k * 10) * 0.08);
        ctx.fillStyle = "#d81b1b";
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-8, 2, 16, 40, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ffd23f";
        ctx.fillRect(-7, 10, 14, 4);
        ctx.fillRect(-7, 28, 14, 4);
        ctx.restore();
        continue;
      }
      // paper bits
      // paper bits fly, then settle on the ground and stay
      for (const b of c.bits) {
        const fly = Math.min(dt, 1.2);
        const x = c.x + Math.cos(b.a) * b.v * fly * 0.8;
        const y = Math.min(c.y + Math.sin(b.a) * b.v * fly * 0.8 + 600 * fly * fly, FLOOR - b.w * 0.2);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(b.spin * fly);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.w / 2, -3, b.w, 6);
        ctx.restore();
      }
      // comic smoke cloud
      if (dt < 1.2) {
        const k = dt / 1.2;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = "#f4f1ea";
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 3;
        for (let j = 0; j < 4; j++) {
          const a = c.rot + j * 1.6;
          const r = 14 + 26 * Math.sqrt(k);
          ctx.beginPath();
          ctx.arc(c.x + Math.cos(a) * r * 0.8, c.y - 20 * k + Math.sin(a) * r * 0.5, r * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // the flash
      if (dt < 0.14) {
        const k = dt / 0.14;
        starburst(ctx, c.x, c.y, 30 + 40 * k, 10, c.rot);
        ctx.fillStyle = k < 0.5 ? "#ffffff" : "#ffe14d";
        ctx.fill();
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    for (const b of bubbles) {
      const dt = t - b.t0;
      if (dt < 0 || dt > 0.9) continue;
      const s = easeOutBack(span(dt, 0, 0.18)) * (1 - span(dt, 0.7, 0.9) * 0.3);
      ctx.save();
      ctx.globalAlpha = 1 - span(dt, 0.7, 0.9);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.scale(s, s);
      starburst(ctx, 0, 0, b.r, 12, 0.2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 4;
      ctx.stroke();
      comicText(ctx, b.text, 0, 4, fit(b.text, (s) => `${s}px ${FONT_COMIC}`, b.r * 0.55, b.r * 1.25), "#e3261b", "#ffd23f");
      ctx.restore();
    }

    slam(ctx, t, T1, () => comicText(ctx, "HAPPY DIWALI", W / 2, 150, s1, "#ffe14d", "#e3261b"));
    if (name) slam(ctx, t, T2, () => comicText(ctx, name.toLocaleUpperCase(), W / 2, 315, s2, "#ffffff", "#1e88e5"));

    // comic panel border
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 28;
    ctx.strokeRect(0, 0, W, H);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 7;
    ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, name, textBottom: 420 };
}
