/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pg-boss / pg are server-only; keep them external so Next doesn't try to
  // bundle the Postgres driver.
  experimental: {
    serverComponentsExternalPackages: ["pg-boss", "pg"],
  },
};

export default nextConfig;
