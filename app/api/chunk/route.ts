import { renderSegment, totalFrames, VARIANTS, type Variant } from "@/lib/render";
import { verifyChunk } from "@/lib/og";

export const runtime = "nodejs";
export const maxDuration = 60;

// Internal: renders one slice of a video. Only callable with a signature from lib/og.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const name = q.get("n") ?? "";
  const variant = q.get("v") as Variant;
  const a = Number(q.get("a"));
  const b = Number(q.get("b"));
  if (
    !VARIANTS.includes(variant) ||
    !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b > totalFrames(variant) || a >= b ||
    !verifyChunk(name, variant, a, b, q.get("sig") ?? "")
  ) {
    return new Response("Forbidden", { status: 403 });
  }
  const seg = await renderSegment(name, variant, a, b);
  return new Response(new Uint8Array(seg), { headers: { "Content-Type": "video/mp4", "Cache-Control": "no-store" } });
}
