import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/foodapp",
  allowedDevOrigins: ["192.168.1.7"],
};

export default nextConfig;
