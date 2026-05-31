/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lucide-react'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

module.exports = nextConfig;
