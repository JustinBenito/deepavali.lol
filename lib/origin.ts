import { cleanHost } from "./scene";

// Origin and display host of the incoming request; nothing is hardcoded so the
// same build works on localhost, previews and any custom domain.
export function requestOrigin(h: Headers) {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (local ? "http" : "https");
  return { origin: `${proto}://${host}`, site: cleanHost(host) };
}
