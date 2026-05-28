import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  // Use Turbopack (Next.js 16 default) — no webpack plugin needed
  turbopack: {},

};

export default nextConfig;
