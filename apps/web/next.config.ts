import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/shared"],
  experimental: {
    turbo: {},
  },
};

export default nextConfig;
