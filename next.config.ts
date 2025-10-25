import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Allow cross-origin requests from localhost during development
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default nextConfig;
