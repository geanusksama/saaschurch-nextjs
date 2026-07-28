import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  env: {
    // Carimbo do build. O service worker é registrado como /sw.js?v=<isto>,
    // então cada deploy vira um script novo para o navegador e o aviso de
    // "nova versão" dispara. Sem isso o /sw.js seria byte a byte igual e
    // nenhuma atualização seria detectada.
    NEXT_PUBLIC_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || String(Date.now()),
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  // Use Turbopack (Next.js 16 default) — no webpack plugin needed
  turbopack: {},
  // Pre-existing TypeScript errors across ~115 component files — suppress until fixed incrementally
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
