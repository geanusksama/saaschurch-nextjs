"use client";

import { motion } from "motion/react";
import { Zap, Music2, Globe, HeartHandshake } from "lucide-react";
import { DEPT_MAP } from "./deptConfig";

const dept = DEPT_MAP["jovens"];

const PILLARS = [
  { icon: Zap,           label: "Movimento",  desc: "Uma geração em chamas" },
  { icon: Music2,        label: "Louvor",     desc: "Adoração autêntica" },
  { icon: Globe,         label: "Missões",    desc: "Além das fronteiras" },
  { icon: HeartHandshake,label: "Cuidado",    desc: "Comunidade real" },
];

export function DeptJovens() {
  return (
    <div className="p-6 space-y-6">

      {/* Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-2xl relative overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${dept.color}30`,
        }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
          style={{ background: dept.color }}
        />
        <Zap size={22} className="mb-2" style={{ color: dept.color }} />
        <h2 className="text-xl font-black text-white tracking-tight">
          FRENTE JOVEM
        </h2>
        <p className="text-xs text-white/40 mt-1">Uma geração. Um propósito.</p>
      </motion.div>

      {/* Pillars */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-3">Nossos pilares</p>
        <div className="grid grid-cols-2 gap-2">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className="p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p.icon size={16} className="mb-2" style={{ color: dept.iconColor }} />
              <p className="text-xs font-bold text-white/90">{p.label}</p>
              <p className="text-[10px] text-white/35 mt-0.5">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Próximo evento */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex items-start justify-between p-4 rounded-xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded tracking-widest"
            style={{ background: dept.color, color: "#fff" }}
          >
            EM BREVE
          </span>
          <h3 className="text-sm font-black text-white mt-2">Congresso Jovem 2026</h3>
          <p className="text-xs text-white/35 mt-0.5">Agosto 15–17 · Sede Central</p>
        </div>
        <button
          className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
          style={{ background: dept.color, color: "#fff" }}
        >
          Inscrever
        </button>
      </motion.div>

      {/* Spotify */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
        className="flex items-center gap-3 p-4 rounded-xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#1DB954" }}>
          <Music2 size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-white/90">Playlist Frente Jovem</p>
          <p className="text-[10px] text-white/35">32 músicas · Spotify</p>
        </div>
        <button className="text-[11px] font-bold px-3 py-1.5 rounded-lg" style={{ background: "#1DB954", color: "#fff" }}>
          Ouvir
        </button>
      </motion.div>
    </div>
  );
}
