/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@stoneway/shared", "@stoneway/database"],
  experimental: {
    serverComponentsExternalPackages: ["@neondatabase/serverless"],
  },
};

export default nextConfig;
