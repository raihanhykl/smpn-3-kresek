/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  // Phase 0: server runtime (no output:'export', no trailingSlash).
  // Phase 3 will add images.remotePatterns for Cloudinary.
  // NEXT_PUBLIC_* env vars are validated by src/lib/env.ts and inlined
  // automatically by Next — no `env` block needed here.
};

export default nextConfig;
