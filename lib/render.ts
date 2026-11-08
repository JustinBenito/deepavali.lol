import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCanvas, GlobalFonts, loadImage, type Image } from "@napi-rs/canvas";
import ffmpegStatic from "ffmpeg-static";
import { createMemeScene, FONT_MEME, MEME_DURATION, MEME_POSTER_TIME } from "./meme";
import { createScene, DURATION, FONT_HEAVY, FONT_SEMI, FPS, H, POSTER_TIME, W } from "./scene";
import type { Variant } from "./variants";

export { VARIANTS, type Variant } from "./variants";

// Bump when the animation changes so stored renders are replaced.
export const RENDER_VERSION = "v11";

const TIMING: Record<Variant, { duration: number; poster: number }> = {
  diwali: { duration: DURATION, poster: POSTER_TIME },
  meme: { duration: MEME_DURATION, poster: MEME_POSTER_TIME },
};
export const totalFrames = (v: Variant) => Math.round(TIMING[v].duration * FPS);

// The video is rendered smaller than the scene's 1280x720 design size: previews
// are shown small, and it keeps encode time and file size down.
export const VIDEO_SCALE = 0.75;
export const VIDEO_W = W * VIDEO_SCALE;
export const VIDEO_H = H * VIDEO_SCALE;

let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  const dir = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "fonts");
  GlobalFonts.registerFromPath(path.join(dir, "Poppins-ExtraBold.ttf"), FONT_HEAVY);
  GlobalFonts.registerFromPath(path.join(dir, "Poppins-SemiBold.ttf"), FONT_SEMI);
  GlobalFonts.registerFromPath(path.join(dir, "Bungee-Regular.ttf"), FONT_MEME);
  fontsReady = true;
}

const images = new Map<string, Promise<Image>>();
function publicImage(...parts: string[]) {
  const file = path.join(/* turbopackIgnore: true */ process.cwd(), "public", ...parts);
  let img = images.get(file);
  if (!img) images.set(file, (img = loadImage(file)));
  return img as unknown as Promise<CanvasImageSource>;
}

async function makeScene(name: string, variant: Variant) {
  ensureFonts();
  const factory = (w: number, h: number) => createCanvas(w, h);
  if (variant === "meme") {
    const [hero, sky] = await Promise.all([publicImage("meme", "hero.png"), publicImage("meme", "sky.jpg")]);
    return createMemeScene(name, factory, hero, sky);
  }
  return createScene(name, factory, await publicImage("bg", "skyline.jpg"));
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
  scene.draw(canvas.getContext("2d") as unknown as CanvasRenderingContext2D, TIMING[variant].poster);
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
