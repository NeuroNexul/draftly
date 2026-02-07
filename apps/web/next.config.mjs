/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  allowedDevOrigins: ["codex.nexul.in", "localhost:3000"],
};

export default nextConfig;
