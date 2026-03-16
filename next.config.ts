import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/genlayer-ecosystem",
  assetPrefix: "/genlayer-ecosystem/",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
