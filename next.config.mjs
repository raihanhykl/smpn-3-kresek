/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  // Phase 0: server runtime (no output:'export', no trailingSlash).
  // NEXT_PUBLIC_* env vars are validated by src/lib/env.ts and inlined
  // automatically by Next — no `env` block needed here.
  images: {
    // Phase 3: allow Cloudinary-hosted images so next/image can optimize them.
    // We host both image/upload/* (photos) and raw/upload/* (PDFs); next/image
    // only renders the image branch, but pathname is permissive so we don't
    // accidentally block valid Cloudinary URLs the URL allowlist already vets.
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

export default nextConfig;
