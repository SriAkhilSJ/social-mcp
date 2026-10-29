import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ["*.e2b.app", "*.e2b.dev", "localhost", "127.0.0.1"],
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@e2b/desktop",
    "postgres",
    "sharp",
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname),
    };
    return config;
  },
  experimental: {
    webpackMemoryOptimizations: true,
    cpus: 1,
    serverActions: {
      allowedOrigins: ["*.e2b.app", "*.e2b.dev", "localhost:3000", "127.0.0.1:3000"],
      bodySizeLimit: "10mb",
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
