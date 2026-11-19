import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["dimensional-fiona-shaggily.ngrok-free.dev"],
  experimental: {
    agentUpgrade: "security",
  },
  output: "standalone",
  outputFileTracingRoot: resolve(currentDirectory, "../.."),
};

export default nextConfig;
