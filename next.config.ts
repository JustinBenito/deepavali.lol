import type { NextConfig } from "next";

// Every route that renders frames needs ffmpeg, the fonts and the backdrop.
const renderAssets = ["./node_modules/ffmpeg-static/ffmpeg", "./public/fonts/**", "./public/bg/**", "./public/meme/**"];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "ffmpeg-static"],
  outputFileTracingIncludes: {
    "/og/[file]": renderAssets,
    "/og/1/[file]": renderAssets,
    "/api/chunk": renderAssets,
    "/api/prepare": renderAssets,
  },
};

export default nextConfig;
