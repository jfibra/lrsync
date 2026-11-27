/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000, // 30 days edge cache for immutable S3 attachments
    imageSizes: [128, 256, 384, 480, 640],
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "leuteriorealty.com" },
      { protocol: "https", hostname: "**.leuteriorealty.com" },
    ],
  },
}

export default nextConfig
