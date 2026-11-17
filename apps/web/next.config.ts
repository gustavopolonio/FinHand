import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["dimensional-fiona-shaggily.ngrok-free.dev"],
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
