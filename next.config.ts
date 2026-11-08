import type { NextConfig } from "next";

// Every route that renders frames needs ffmpeg, the fonts and the backdrop.
const renderAssets = ["./node_modules/ffmpeg-static/ffmpeg", "./public/fonts/**", "./public/bg/**", "./public/meme/**", "./public/sweets/**"];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "ffmpeg-static"],
  outputFileTracingIncludes: {
    "/og/[...path]": renderAssets,
    "/api/chunk": renderAssets,
    "/api/prepare": renderAssets,
  },
};

export default nextConfig;
