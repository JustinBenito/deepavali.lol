// A short firework launched from an element: a spray of sparks out of it, then a
// few rockets that streak up and burst. Runs on a temporary full-screen canvas.

type P = { x: number; y: number; vx: number; vy: number; life: number; age: number; color: string; size: number; drag: number; g: number };
type Rocket = { x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; burst: boolean; colors: string[] };

const SPARK = ["#fff6d8", "#ffd27a", "#ffb04a"];
const SHELLS = [
  ["#ff4d8d", "#ffd166", "#fff2c2"],
  ["#4cc9f0", "#c77dff", "#fff2c2"],
  ["#06d6a0", "#ffd166", "#ff8a3d"],
  ["#ffd166", "#ff8a3d", "#fff6d8"],
];

export function celebrate(from: DOMRect) {
  if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  const w = innerWidth;
  const h = innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "50" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const sprites = new Map<string, HTMLCanvasElement>();
  const sprite = (color: string) => {
    let s = sprites.get(color);
    if (!s) {
      s = document.createElement("canvas");
      s.width = s.height = 32;
      const c = s.getContext("2d")!;
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.2, color);
      g.addColorStop(1, "transparent");
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
      sprites.set(color, s);
    }
    return s;
  };

  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  const parts: P[] = [];
  const add = (x: number, y: number, a: number, v: number, color: string, life: number, size: number, drag: number, g: number) =>
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, age: 0, color, size, drag, g });

  // spray out of the button
  for (let i = 0; i < 110; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
    add(cx + (Math.random() - 0.5) * from.width * 0.7, from.top + 4, a, 220 + Math.random() * 480, SPARK[i % 3], 0.5 + Math.random() * 0.7, 3 + Math.random() * 3, 1.2, 900);
  }

  const reach = Math.min(cy - 40, 340);
  const rockets: Rocket[] = [0, 1, 2].map((i) => ({
    x0: cx + (i - 1) * from.width * 0.25,
    y0: from.top,
    x1: cx + (i - 1) * Math.min(220, w * 0.28) + (Math.random() - 0.5) * 40,
    y1: cy - reach * (0.7 + Math.random() * 0.3),
    t0: 0.05 + i * 0.16,
    dur: 0.5 + Math.random() * 0.12,
    burst: false,
    colors: SHELLS[Math.floor(Math.random() * SHELLS.length)],
  }));

  const start = performance.now();
  let last = start;
  const frame = (now: number) => {
    const t = (now - start) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    for (const r of rockets) {
      const k = (t - r.t0) / r.dur;
      if (k < 0) continue;
      if (k < 1) {
        const e = 1 - Math.pow(1 - k, 2);
        const x = r.x0 + (r.x1 - r.x0) * e;
        const y = r.y0 + (r.y1 - r.y0) * e;
        add(x, y, Math.PI / 2 + (Math.random() - 0.5) * 0.8, 40 + Math.random() * 80, SPARK[Math.floor(Math.random() * 3)], 0.3 + Math.random() * 0.3, 2.5, 1, 300);
        ctx.globalAlpha = 1;
        ctx.drawImage(sprite("#fff6d8"), x - 8, y - 8, 16, 16);
      } else if (!r.burst) {
        r.burst = true;
        for (let i = 0; i < 90; i++) {
          const a = Math.random() * Math.PI * 2;
          const z = Math.random() * 2 - 1;
          add(r.x1, r.y1, a, (90 + 200 * Math.sqrt(1 - z * z)) * (0.9 + Math.random() * 0.2), r.colors[i % 3], 1 + Math.random() * 0.6, 3 + Math.random() * 2.5, 2.2, 140);
        }
        ctx.globalAlpha = 0.9;
        ctx.drawImage(sprite("#fff2c2"), r.x1 - 60, r.y1 - 60, 120, 120);
      }
    }

    for (const p of parts) {
      if (p.age > p.life) continue;
      p.age += dt;
      const px = p.x;
      const py = p.y;
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy = p.vy * damp + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = Math.min(1, p.age / p.life);
      ctx.globalAlpha = (1 - k * k) * 0.5;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.globalAlpha = 1 - k * k;
      const s = p.size * (1 - k * 0.5);
      ctx.drawImage(sprite(p.color), p.x - s, p.y - s, s * 2, s * 2);
    }

    if (t < 2.6) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
