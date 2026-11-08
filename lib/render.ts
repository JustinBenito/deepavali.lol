import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCanvas, GlobalFonts, loadImage, type Image } from "@napi-rs/canvas";
import ffmpegStatic from "ffmpeg-static";
import { FPS, H, W } from "./scene";
import { SCENES } from "./scenes";
import type { Variant } from "./variants";

export { VARIANTS, type Variant } from "./variants";

// Bump when a scene changes so stored renders are replaced.
export const RENDER_VERSION = "v14";

export const totalFrames = (v: Variant) => Math.round(SCENES[v].duration * FPS);

// The video is rendered smaller than the scene's 1280x720 design size: previews
// are shown small, and it keeps encode time and file size down.
export const VIDEO_SCALE = 0.75;
export const VIDEO_W = W * VIDEO_SCALE;
export const VIDEO_H = H * VIDEO_SCALE;

const publicFile = (...parts: string[]) => path.join(/* turbopackIgnore: true */ process.cwd(), "public", ...parts);

const registered = new Set<string>();
const images = new Map<string, Promise<Image>>();
function publicImage(url: string) {
  let img = images.get(url);
  if (!img) images.set(url, (img = loadImage(publicFile(...url.split("/").filter(Boolean)))));
  return img as unknown as Promise<CanvasImageSource>;
}

async function makeScene(name: string, variant: Variant) {
  const def = SCENES[variant];
  for (const [family, file] of def.fonts) {
    if (registered.has(family)) continue;
    GlobalFonts.registerFromPath(publicFile("fonts", file), family);
    registered.add(family);
  }
  const imgs = await Promise.all(def.images("landscape").map(publicImage));
  return def.create(name, (w, h) => createCanvas(w, h), imgs, "landscape");
}

function ffmpegBinary() {
  const bundled = ffmpegStatic as unknown as string | null;
  if (bundled && existsSync(bundled)) return bundled;
  return "ffmpeg";
}

function ffmpeg(args: string[], feed?: (write: (b: Buffer) => Promise<void>) => Promise<void>) {
  const ff = spawn(/* turbopackIgnore: true */ ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    stdio: [feed ? "pipe" : "ignore", "ignore", "pipe"],
  });
  let stderr = "";
  ff.stderr!.on("data", (d) => (stderr += d));
  const done = new Promise<void>((resolve, reject) => {
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr}`))));
  });
  if (!feed) return done;
  // Swallow EPIPE here; the close handler reports the real failure.
  ff.stdin!.on("error", () => {});
  const write = (b: Buffer) =>
    ff.stdin!.write(b) ? Promise.resolve() : new Promise<void>((r) => ff.stdin!.once("drain", () => r()));
  return feed(write).then(() => {
    ff.stdin!.end();
    return done;
  });
}

async function withTmp<T>(fn: (dir: string) => Promise<T>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "og-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function renderPoster(name: string, variant: Variant) {
  const scene = await makeScene(name, variant);
  const canvas = createCanvas(W, H);
  scene.draw(canvas.getContext("2d") as unknown as CanvasRenderingContext2D, SCENES[variant].poster);
  return canvas.encode("jpeg", 86);
}

// Frames [from, to) as a standalone H.264 MP4 segment. Every segment starts on a
// keyframe with identical settings, so segments join without re-encoding.
export async function renderSegment(name: string, variant: Variant, from: number, to: number) {
  const scene = await makeScene(name, variant);
  const canvas = createCanvas(VIDEO_W, VIDEO_H);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  return withTmp(async (dir) => {
    const out = path.join(dir, "seg.mp4");
    const t0 = performance.now();
    await ffmpeg(
      [
        "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${VIDEO_W}x${VIDEO_H}`, "-r", String(FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-profile:v", "high",
        "-g", "48", "-f", "mp4", out,
      ],
      async (write) => {
        for (let i = from; i < to; i++) {
          scene.draw(ctx, i / FPS, VIDEO_SCALE);
          // Raw RGBA straight from Skia (premultiplied, but every frame is opaque);
          // ~14x faster than getImageData. Copied because the canvas reuses it.
          await write(Buffer.from(canvas.data()));
        }
      },
    );
    console.log(`[og] segment ${variant} ${JSON.stringify(name)} ${from}-${to} ${(performance.now() - t0) | 0}ms`);
    return readFile(out);
  });
}

export async function joinSegments(segments: Buffer[]) {
  return withTmp(async (dir) => {
    const list = await Promise.all(
      segments.map(async (seg, i) => {
        const file = path.join(dir, `s${i}.mp4`);
        await writeFile(file, seg);
        return `file '${file}'`;
      }),
    );
    await writeFile(path.join(dir, "list.txt"), list.join("\n"));
    const out = path.join(dir, "out.mp4");
    await ffmpeg(["-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-c", "copy", "-movflags", "+faststart", out]);
    return readFile(out);
  });
}
