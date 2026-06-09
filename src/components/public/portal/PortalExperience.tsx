"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, X } from "lucide-react";
import { AppModeHome } from "./AppModeHome";
import { DepartmentMiniSite } from "./DepartmentMiniSite";
import type { DeptSlug } from "./departments/deptConfig";

type PortalView = "home" | "dept";

interface PortalState {
  view: PortalView;
  deptSlug?: DeptSlug;
}

interface PortalExperienceProps {
  onClose: () => void;
}

export function PortalExperience({ onClose }: PortalExperienceProps) {
  const [state, setState] = useState<PortalState>({ view: "home" });

  const openDept = useCallback((slug: DeptSlug) => {
    setState({ view: "dept", deptSlug: slug });
  }, []);

  const goHome = useCallback(() => {
    setState({ view: "home" });
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-hidden flex flex-col"
      style={{ background: "#0d0f17" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Subtle top gradient */}
      <div
        className="absolute inset-x-0 top-0 h-64 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(74,222,128,0.06) 0%, transparent 100%)",
        }}
      />

      {/* Top bar — same style as login header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-4 relative z-10"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <AnimatePresence mode="wait">
          {state.view === "dept" ? (
            <motion.button
              key="back"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              onClick={goHome}
              className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white/90 transition-colors"
            >
              <ArrowLeft size={15} />
              Voltar
            </motion.button>
          ) : (
            <motion.div
              key="brand"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black text-white"
                style={{ background: "#22c55e" }}
              >
                A
              </div>
              <span className="text-xs font-semibold tracking-widest text-white/30 uppercase">
                Portal Digital
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/80 hover:bg-white/5 transition-all"
        >
          <X size={15} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {state.view === "home" && (
            <motion.div
              key="home"
              className="absolute inset-0"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <AppModeHome onOpenDept={openDept} />
            </motion.div>
          )}

          {state.view === "dept" && state.deptSlug && (
            <motion.div
              key={`dept-${state.deptSlug}`}
              className="absolute inset-0"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <DepartmentMiniSite slug={state.deptSlug} onBack={goHome} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
