"use client";

import { motion } from "motion/react";
import { BookOpen, Users, Mic, Heart } from "lucide-react";
import { DEPT_MAP } from "./deptConfig";

const dept = DEPT_MAP["cibe"];

const HIGHLIGHTS = [
  { icon: BookOpen, label: "Estudos Bíblicos", count: "12 séries" },
  { icon: Users,    label: "Grupos de Oração", count: "8 grupos" },
  { icon: Mic,      label: "Conferências",      count: "3 por ano" },
  { icon: Heart,    label: "Ações Sociais",     count: "Mensais" },
];

const AGENDA = [
  { dia: "QUA", title: "Culto da CIBE",      time: "19h30", tipo: "Culto" },
  { dia: "14",  title: "Tarde de Oração",    time: "15h00", tipo: "Oração" },
  { dia: "12",  title: "Congresso Regional", time: "08h00", tipo: "Congresso" },
];

export function DeptCIBE() {
  return (
    <div className="p-6 space-y-6">

      {/* Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative p-5 rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${dept.color}30`,
        }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
          style={{ background: dept.color }}
        />
        <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: dept.color }}>
          Tema 2026
        </p>
        <h2 className="text-base font-bold text-white leading-snug">
          "Mulheres que fazem a diferença"
        </h2>
        <p className="text-xs text-white/40 mt-1">
          Seja parte desta história
        </p>
        <button
          className="mt-3 px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide"
          style={{ background: dept.color, color: "#fff" }}
        >
          Saiba mais
        </button>
      </motion.div>

      {/* Highlights */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-3">Nosso ministério</p>
        <div className="grid grid-cols-2 gap-2">
          {HIGHLIGHTS.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <item.icon size={15} style={{ color: dept.iconColor }} />
              <div>
                <p className="text-[11px] font-semibold text-white/80">{item.label}</p>
                <p className="text-[10px] text-white/35">{item.count}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Agenda */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-3">Próximas programações</p>
        <div className="space-y-2">
          {AGENDA.map((ev, i) => (
            <motion.div
              key={ev.title}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.07 }}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="w-9 h-9 rounded-lg flex-shrink-0 flex flex-col items-center justify-center"
                style={{ background: `${dept.color}18`, border: `1px solid ${dept.color}28` }}
              >
                <span className="text-[11px] font-black" style={{ color: dept.color }}>{ev.dia}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white/85">{ev.title}</p>
                <p className="text-[11px] text-white/35">{ev.time}</p>
              </div>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${dept.color}18`, color: dept.iconColor }}
              >
                {ev.tipo}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Social */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex gap-2"
      >
        {["Instagram", "YouTube", "WhatsApp"].map((rede) => (
          <button
            key={rede}
            className="flex-1 py-2 rounded-xl text-[11px] font-semibold transition-colors"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {rede}
          </button>
        ))}
      </motion.div>
    </div>
  );
}
