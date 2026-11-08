import { AwsClient } from "aws4fetch";

// Cloudflare R2 (S3 API) holds rendered files; they're served from its public URL,
// which caches and handles byte-range requests (iMessage, Safari).
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;

export const storeConfigured = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL);

const client = storeConfigured
  ? new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY!, service: "s3", region: "auto" })
  : null;

const objectUrl = (key: string) => `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
export const publicUrl = (key: string) => `${R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;

// Public URL if the object exists, null if it doesn't; throws if R2 itself is failing.
export async function headObject(key: string): Promise<string | null> {
  const res = await client!.fetch(objectUrl(key), { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 HEAD ${key}: ${res.status}`);
  return publicUrl(key);
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<string> {
  const res = await client!.fetch(objectUrl(key), {
    method: "PUT",
    body: new Uint8Array(body),
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
  if (!res.ok) throw new Error(`R2 PUT ${key}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return publicUrl(key);
}
