import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  devIndicators: false,
  output: "standalone",
};


export default nextConfig;
