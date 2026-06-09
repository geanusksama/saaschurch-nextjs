"use client";

// Standalone page for /portal — renders the full portal experience directly
// (not as an overlay, so it can be linked to and previewed directly)

import { useCallback } from "react";
import { ArrowLeft, Home } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { AppModeHome } from "./AppModeHome";
import { DepartmentMiniSite } from "./DepartmentMiniSite";
import type { DeptSlug } from "./departments/deptConfig";
import { DEPT_MAP } from "./departments/deptConfig";

/** /portal — shows the app-mode home grid */
export function PortalHomePage() {
  const navigate = useNavigate();

  const openDept = useCallback((slug: DeptSlug) => {
    navigate(`/portal/dept/${slug}`);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0d0f17" }}>
      {/* Top bar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black text-white"
            style={{ background: "#22c55e" }}
          >
            A
          </div>
          <span className="text-xs font-semibold tracking-widest text-white/30 uppercase">
            Portal Digital
          </span>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/70 transition-colors"
        >
          <Home size={13} />
          Início
        </button>
      </div>

      {/* Portal grid */}
      <div className="flex-1">
        <AppModeHome onOpenDept={openDept} />
      </div>
    </div>
  );
}

/** /portal/dept/:slug — standalone department mini-site */
export function PortalDeptPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const dept = slug ? DEPT_MAP[slug as DeptSlug] : null;

  if (!dept) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0f17" }}>
        <div className="text-center">
          <p className="text-white/30 text-sm">Departamento não encontrado</p>
          <button
            onClick={() => navigate("/portal")}
            className="mt-4 text-xs text-white/50 hover:text-white/80 underline"
          >
            Voltar ao portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0d0f17" }}>
      {/* Top bar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <button
          onClick={() => navigate("/portal")}
          className="flex items-center gap-2 text-sm font-medium text-white/40 hover:text-white/80 transition-colors"
        >
          <ArrowLeft size={15} />
          Voltar
        </button>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/60 transition-colors"
        >
          <Home size={12} />
          Início
        </button>
      </div>

      {/* Department mini-site */}
      <div className="flex-1" style={{ minHeight: 0 }}>
        <DepartmentMiniSite slug={slug as DeptSlug} onBack={() => navigate("/portal")} />
      </div>
    </div>
  );
}
