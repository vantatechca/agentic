/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // BullMQ / ioredis are server-only; keep them out of the client bundle and
  // let Next treat them as external native modules on the server.
  experimental: {
    serverComponentsExternalPackages: ["bullmq", "ioredis"],
  },
};

export default nextConfig;
