/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@stoneway/shared", "@stoneway/database"],
  serverExternalPackages: ["@neondatabase/serverless"],
  async rewrites() {
    return [
      {
        source: "/@:username/raw",
        destination: "/profile/:username/raw",
      },
      {
        source: "/@:username",
        destination: "/profile/:username",
      },
    ];
  },
};

export default nextConfig;
