import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: "/rep",
  assetPrefix: "/rep",
};

export default nextConfig;
