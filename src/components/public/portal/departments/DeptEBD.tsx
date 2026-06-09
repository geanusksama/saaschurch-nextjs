"use client";

import { motion } from "motion/react";
import { GraduationCap, FileText, Download } from "lucide-react";
import { DEPT_MAP } from "./deptConfig";

const dept = DEPT_MAP["ebd"];

const CLASSES = [
  { name: "Maternal",     count: "18",  professor: "Irmã Maria" },
  { name: "Primários",    count: "24",  professor: "Ir. João" },
  { name: "Juniores",     count: "21",  professor: "Ir. Ana" },
  { name: "Adolescentes", count: "19",  professor: "Ir. Paulo" },
  { name: "Adultos 1",    count: "35",  professor: "Ir. Luiz" },
  { name: "Adultos 2",    count: "28",  professor: "Ir. Ruth" },
];

const MATERIALS = [
  { label: "Revista Lição EBD – Jun/2026", type: "PDF" },
  { label: "Calendário letivo 2026",        type: "PDF" },
  { label: "Guia do professor – Trimestre", type: "DOC" },
];

export function DeptEBD() {
  return (
    <div className="p-6 space-y-6">

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-3 gap-2"
      >
        {[
          { label: "Classes",    value: "12" },
          { label: "Alunos",     value: "195" },
          { label: "Professores",value: "14" },
        ].map((s) => (
          <div
            key={s.label}
            className="text-center p-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-2xl font-black text-white">{s.value}</p>
            <p className="text-[10px] text-white/35 mt-0.5 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Classes */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-3 flex items-center gap-1.5">
          <GraduationCap size={11} /> Classes
        </p>
        <div className="space-y-1.5">
          {CLASSES.map((cls, i) => (
            <motion.div
              key={cls.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.05 }}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.035)" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: dept.color }} />
                <span className="text-xs font-medium text-white/80">{cls.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/30">{cls.count} alunos</span>
                <span className="text-[10px] text-white/20">·</span>
                <span className="text-[10px]" style={{ color: dept.iconColor }}>{cls.professor}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Materials */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-3 flex items-center gap-1.5">
          <FileText size={11} /> Materiais
        </p>
        <div className="space-y-2">
          {MATERIALS.map((mat, i) => (
            <motion.div
              key={mat.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.07 }}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={13} style={{ color: dept.iconColor }} className="flex-shrink-0" />
                <span className="text-xs text-white/70 truncate">{mat.label}</span>
              </div>
              <button
                className="flex items-center gap-1 text-[10px] font-bold flex-shrink-0 ml-3 px-2 py-1 rounded"
                style={{ background: `${dept.color}20`, color: dept.iconColor }}
              >
                <Download size={10} /> {mat.type}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
