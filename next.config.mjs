/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  // Phase 0: no output:'export', no trailingSlash (server runtime now).
  // Phase 3 will add images.remotePatterns for Cloudinary.
  env: {
    NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'static',
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
  },
};

export default nextConfig;
