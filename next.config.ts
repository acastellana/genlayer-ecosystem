import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/genlayer-ecosystem",
  assetPrefix: "/genlayer-ecosystem/",
  images: { unoptimized: true },
  trailingSlash: true,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
