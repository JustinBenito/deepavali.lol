import { createHmac, timingSafeEqual } from "node:crypto";
import { headObject, putObject, storeConfigured } from "./store";
import { joinSegments, renderPoster, renderSegment, RENDER_VERSION, totalFrames, type Variant } from "./render";
import { slugify } from "./scene";
import { PREFIX } from "./variants";

// Rendered files live in R2 (lib/store.ts), so each name is rendered once ever and
// then served from R2's public URL (which also handles the byte-range requests
// iMessage and Safari make). If storage is missing or failing, we keep serving:
// render on demand, keep recent files in memory, and let the CDN cache responses.
const STORE = storeConfigured;
let storeDownUntil = 0;
const storeOn = () => STORE && Date.now() > storeDownUntil;
function storeFailed(err: unknown) {
  console.warn(`[og] storage unavailable, serving directly for 10 min: ${err instanceof Error ? err.message : err}`);
  storeDownUntil = Date.now() + 10 * 60_000;
}

// A cold video render is split across this many function invocations.
const CHUNKS = 12;

// The preview image is a JPEG (a fraction of a PNG's size); old .png links map to it.
export type Kind = "mp4" | "jpg";
export type Asset = { url: string; body?: Buffer } | { url?: undefined; body: Buffer };
export const CONTENT_TYPE: Record<Kind, string> = { mp4: "video/mp4", jpg: "image/jpeg" };

// The video doesn't contain the domain, so one render serves every host.
function storePath(kind: Kind, name: string, variant: Variant) {
  return `og/${RENDER_VERSION}/${PREFIX[variant] ? `${PREFIX[variant]}/` : ""}${slugify(name) || "_"}.${kind}`;
}

const known = new Map<string, string>();
const memory = new Map<string, Buffer>();
function remember(p: string, body: Buffer) {
  if (memory.size >= 40) memory.delete(memory.keys().next().value!);
  memory.set(p, body);
}

export async function storedUrl(kind: Kind, name: string, variant: Variant): Promise<string | null> {
  if (!storeOn()) return null;
  const p = storePath(kind, name, variant);
  const hit = known.get(p);
  if (hit) return hit;
  try {
    const url = await headObject(p);
    if (url) known.set(p, url);
    return url;
  } catch (err) {
    storeFailed(err);
    return null;
  }
}

const inflight = new Map<string, Promise<Asset>>();

export function ensure(kind: Kind, name: string, variant: Variant, origin: string): Promise<Asset> {
  const p = storePath(kind, name, variant);
  const existing = inflight.get(p);
  if (existing) return existing;
  const job = (async (): Promise<Asset> => {
    const url = await storedUrl(kind, name, variant);
    if (url) return { url };
    const cachedBody = memory.get(p);
    if (cachedBody) return { body: cachedBody };

    const t0 = performance.now();
    const body = kind === "jpg" ? await renderPoster(name, variant) : await renderVideo(name, variant, origin);
    console.log(`[og] rendered ${p} ${body.length}B in ${(performance.now() - t0) | 0}ms`);
    remember(p, body);

    if (!storeOn()) return { body };
    try {
      const url = await putObject(p, body, CONTENT_TYPE[kind]);
      known.set(p, url);
      return { url, body };
    } catch (err) {
      storeFailed(err);
      return { body };
    }
  })().finally(() => inflight.delete(p));
  inflight.set(p, job);
  return job;
}

// ---------- parallel video rendering ----------

function ranges(variant: Variant) {
  const total = totalFrames(variant);
  const size = Math.ceil(total / CHUNKS);
  const out: [number, number][] = [];
  for (let a = 0; a < total; a += size) out.push([a, Math.min(total, a + size)]);
  return out;
}

function secret() {
  return process.env.OG_CHUNK_SECRET ?? process.env.R2_SECRET_ACCESS_KEY ?? "local-dev";
}

function sign(name: string, variant: Variant, a: number, b: number) {
  return createHmac("sha256", secret()).update(`${RENDER_VERSION}|${variant}|${name}|${a}|${b}`).digest("hex");
}

export function verifyChunk(name: string, variant: Variant, a: number, b: number, sig: string) {
  const want = Buffer.from(sign(name, variant, a, b));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

async function fetchChunk(origin: string, name: string, variant: Variant, a: number, b: number) {
  const q = new URLSearchParams({ n: name, v: variant, a: String(a), b: String(b), sig: sign(name, variant, a, b) });
  const headers: Record<string, string> = {};
  // Lets chunk calls through Vercel Deployment Protection on preview deployments.
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET)
    headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const res = await fetch(`${origin}/api/chunk?${q}`, { headers, cache: "no-store", signal: AbortSignal.timeout(55_000) });
  if (!res.ok || res.headers.get("content-type") !== "video/mp4") throw new Error(`chunk ${a}-${b}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function renderVideo(name: string, variant: Variant, origin: string) {
  const parts = ranges(variant);
  // Fan out on Vercel (and locally when storage is configured, to exercise the path).
  const segments = process.env.VERCEL || STORE
    ? await Promise.all(
        parts.map(([a, b]) =>
          fetchChunk(origin, name, variant, a, b).catch((err) => {
            console.warn(`[og] ${err}; rendering locally`);
            return renderSegment(name, variant, a, b);
          }),
        ),
      )
    : [await renderSegment(name, variant, 0, totalFrames(variant))];
  return joinSegments(segments);
}
