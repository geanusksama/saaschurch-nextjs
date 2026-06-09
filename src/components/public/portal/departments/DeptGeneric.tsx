"use client";

import { motion } from "motion/react";
import { CalendarDays, Image, Users, MessageCircle, ArrowRight } from "lucide-react";
import { DEPT_MAP, type DeptSlug } from "./deptConfig";

interface DeptGenericProps {
  slug: DeptSlug;
}

export function DeptGeneric({ slug }: DeptGenericProps) {
  const dept = DEPT_MAP[slug];
  if (!dept) return null;

  const FEATURES = [
    { icon: CalendarDays, label: "Agenda",  desc: "Próximos eventos" },
    { icon: Image,        label: "Galeria", desc: "Fotos e memórias" },
    { icon: Users,        label: "Equipe",  desc: "Nossa liderança" },
    { icon: MessageCircle,label: "Contato", desc: "Fale conosco" },
  ];

  return (
    <div className="p-6 space-y-6">

      {/* Identity block */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${dept.color}25`,
        }}
      >
        <div
          className="w-10 h-1 rounded-full mb-4"
          style={{ background: dept.color }}
        />
        <h2 className="text-2xl font-black text-white leading-tight">{dept.name}</h2>
        <p className="text-sm text-white/40 mt-1">{dept.description}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {dept.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: `${dept.color}15`,
                color: dept.iconColor,
                border: `1px solid ${dept.color}25`,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Features */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-3">Explore</p>
        <div className="space-y-2">
          {FEATURES.map((feat, i) => (
            <motion.div
              key={feat.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className="flex items-center gap-3 p-3.5 rounded-xl group cursor-pointer"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${dept.color}15` }}
              >
                <feat.icon size={14} style={{ color: dept.iconColor }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white/85">{feat.label}</p>
                <p className="text-[11px] text-white/35">{feat.desc}</p>
              </div>
              <ArrowRight size={13} className="text-white/15 group-hover:text-white/40 transition-colors" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="flex items-center justify-between p-4 rounded-xl"
        style={{ background: `${dept.color}12`, border: `1px solid ${dept.color}22` }}
      >
        <div>
          <p className="text-xs font-bold text-white/90">Faça parte deste ministério</p>
          <p className="text-[11px] text-white/35 mt-0.5">Entre em contato conosco</p>
        </div>
        <button
          className="px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0"
          style={{ background: dept.color, color: "#fff" }}
        >
          Entrar
        </button>
      </motion.div>
    </div>
  );
}
