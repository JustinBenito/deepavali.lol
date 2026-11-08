import { CONTENT_TYPE, ensure } from "./og";
import { requestOrigin } from "./origin";
import type { Variant } from "./render";
import { formatName } from "./scene";

// /og/justin.mp4, /og/1/justin.png, ...
// Already rendered: a cacheable redirect to the stored file (R2).
// Rendered just now: the bytes directly, so the first crawler doesn't need a second hop.
export async function ogResponse(req: Request, file: string, variant: Variant) {
  const match = /^(.*)\.(mp4|png|jpg)$/i.exec(decodeURIComponent(file));
  if (!match) return new Response("Not found", { status: 404 });

  // .png is what earlier links used; it gets the same JPEG.
  const kind = match[2].toLowerCase() === "mp4" ? "mp4" : "jpg";
  const name = formatName(match[1]);
  const { origin } = requestOrigin(req.headers);
  const asset = await ensure(kind, name, variant, origin);

  if (!asset.body && asset.url) {
    return new Response(null, {
      status: 308,
      headers: { Location: asset.url, "Cache-Control": "public, max-age=3600, s-maxage=31536000" },
    });
  }
  // Stored: don't cache this copy, the next request gets the redirect.
  // Not stored (storage unavailable): let the CDN cache it so we don't re-render.
  const cache = asset.url ? "no-store" : "public, max-age=86400, s-maxage=31536000";
  return bytes(req, asset.body!, CONTENT_TYPE[kind], cache);
}

function bytes(req: Request, body: Buffer, type: string, cache: string) {
  const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": cache };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range) {
    const size = body.length;
    const start = Math.max(0, range[1] ? Number(range[1]) : size - Number(range[2]));
    const end = Math.min(range[1] && range[2] ? Number(range[2]) : size - 1, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    return new Response(new Uint8Array(body.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(body), { headers: { ...headers, "Content-Length": String(body.length) } });
}
