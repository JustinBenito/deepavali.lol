import { ogResponse } from "@/lib/ogResponse";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  return ogResponse(req, (await params).file, "diwali");
}
