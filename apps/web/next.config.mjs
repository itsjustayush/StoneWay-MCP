/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@stoneway/shared", "@stoneway/database"],
  serverExternalPackages: ["@neondatabase/serverless"],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    webpackBuildWorker: false,
    cpus: 1,
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
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
