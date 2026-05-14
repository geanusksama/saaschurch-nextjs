"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const AppSPA = dynamic(() => import("@/spa/AppSPA"), { ssr: false });

export default function SpaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Carregando...</p>
        </div>
      </div>
    }>
      <AppSPA />
    </Suspense>
  );
}
