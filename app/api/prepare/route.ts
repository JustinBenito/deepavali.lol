import { ensure } from "@/lib/og";
import { requestOrigin } from "@/lib/origin";
import { VARIANTS, type Variant } from "@/lib/render";
import { formatName } from "@/lib/scene";

export const runtime = "nodejs";
export const maxDuration = 60;

// Called by the page right after a link is made, so the preview video exists
// before anyone pastes the link into a chat.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; variant?: string };
  const name = formatName(String(body.name ?? ""));
  const variant: Variant = VARIANTS.includes(body.variant as Variant) ? (body.variant as Variant) : "diwali";
  const { origin } = requestOrigin(req.headers);
  await Promise.all([ensure("jpg", name, variant, origin), ensure("mp4", name, variant, origin)]);
  return Response.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
}
