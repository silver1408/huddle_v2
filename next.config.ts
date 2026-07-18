import type { NextConfig } from "next"

const isCapacitor = process.env.CAPACITOR === "true"

const nextConfig: NextConfig = {
  // Static export when building for Capacitor APK
  ...(isCapacitor ? { output: "export" } : {}),
  images: {
    // Allow remote images (Google profile photos, Gutenberg covers)
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "www.gutenberg.org" },
    ],
    ...(isCapacitor ? { unoptimized: true } : {}),
  },
}

export default nextConfig
