import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost:3001",
    "127.0.0.1:3001",
    "192.168.1.4:3001",
    "192.168.1.*:3001",
    "localhost",
    "127.0.0.1",
    "192.168.1.4",
  ],
};

export default nextConfig;
