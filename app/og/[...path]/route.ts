import { ogResponse } from "@/lib/ogResponse";
import { variantForPrefix } from "@/lib/variants";

export const runtime = "nodejs";
export const maxDuration = 60;

// /og/justin.mp4 → the default greeting; /og/2/justin.mp4 → the type at /2.
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.length === 1) return ogResponse(req, path[0], "diwali");
  const variant = path.length === 2 ? variantForPrefix(path[0]) : undefined;
  if (!variant) return new Response("Not found", { status: 404 });
  return ogResponse(req, path[1], variant);
}
