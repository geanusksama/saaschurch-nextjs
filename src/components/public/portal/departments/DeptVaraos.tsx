"use client";

import { motion } from "motion/react";
import { Shield, BookOpen, Target, Users2 } from "lucide-react";
import { DEPT_MAP } from "./deptConfig";

const dept = DEPT_MAP["varaos"];

const AREAS = [
  { icon: BookOpen, label: "Estudos Bíblicos",  desc: "Toda terça, 20h" },
  { icon: Shield,   label: "Escalas de Serviço",desc: "Organizadas mensalmente" },
  { icon: Target,   label: "Retiros",           desc: "2× por ano" },
  { icon: Users2,   label: "Grupos de Apoio",   desc: "Por região" },
];

export function DeptVaraos() {
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 p-4 rounded-2xl"
        style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${dept.color}25` }}
      >
        <Shield size={32} style={{ color: dept.iconColor }} />
        <div>
          <h2 className="text-base font-black text-white">Varões de Valor</h2>
          <p className="text-xs text-white/35">Homens edificando com integridade</p>
        </div>
      </motion.div>

      {/* Areas */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-3">Áreas de atuação</p>
        <div className="space-y-2">
          {AREAS.map((area, i) => (
            <motion.div
              key={area.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${dept.color}15` }}
              >
                <area.icon size={14} style={{ color: dept.iconColor }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white/85">{area.label}</p>
                <p className="text-[11px] text-white/35">{area.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Versículo */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="p-4 rounded-xl"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <p className="text-xs italic text-white/50 leading-relaxed text-center">
          "Portai-vos como homens, sede fortes."
        </p>
        <p className="text-[10px] text-white/25 text-center mt-2">1 Coríntios 16:13</p>
      </motion.div>
    </div>
  );
}
