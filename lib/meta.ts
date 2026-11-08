import type { Metadata } from "next";
import { headers } from "next/headers";
import { storedUrl } from "./og";
import { requestOrigin } from "./origin";
import { H, W } from "./scene";
import { VIDEO_H, VIDEO_W } from "./render";
import { pathPrefix, type Variant } from "./variants";

export async function siteUrl() {
  const { origin, site } = requestOrigin(await headers());
  return { base: origin, site };
}

export async function greetingMetadata(name: string, slug: string, variant: Variant = "diwali"): Promise<Metadata> {
  const { base, site } = await siteUrl();
  const file = encodeURIComponent(slug || "everyone");
  const prefix = pathPrefix(variant);
  // Point straight at stored files (R2) when they exist (fast, CDN, range-capable);
  // otherwise at our route, which renders them on first request.
  const [videoStored, posterStored] = await Promise.all([storedUrl("mp4", name, variant), storedUrl("jpg", name, variant)]);
  const video = videoStored ?? `${base}/og${prefix}/${file}.mp4`;
  const poster = posterStored ?? `${base}/og${prefix}/${file}.jpg`;
  const title = `Happy Diwali${name ? ` ${name}` : ""}! ${variant === "meme" ? "💥🔥" : "🪔✨"}`;
  const description =
    variant === "meme"
      ? `Mass Diwali wishes, guns blazing. Send one to someone at ${site}`
      : `A little rocket, launched just for you. Send one to someone you love at ${site}`;

  return {
    metadataBase: new URL(base),
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${base}${prefix}/${slug}`,
      siteName: site,
      type: "video.other",
      images: [{ url: poster, width: W, height: H, alt: title }],
      videos: [{ url: video, secureUrl: video, type: "video/mp4", width: VIDEO_W, height: VIDEO_H }],
    },
    twitter: { card: "summary_large_image", title, description, images: [poster] },
  };
}
