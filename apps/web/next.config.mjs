/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@stoneway/shared", "@stoneway/database"],
  serverExternalPackages: ["@neondatabase/serverless"],
};

export default nextConfig;
