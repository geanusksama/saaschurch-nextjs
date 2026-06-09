"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Home, Calendar, Newspaper, Image, Users, Mail,
} from "lucide-react";
import { DEPT_MAP, type DeptSlug, type DeptConfig } from "./departments/deptConfig";
import { DeptCIBE }    from "./departments/DeptCIBE";
import { DeptJovens }  from "./departments/DeptJovens";
import { DeptVaraos }  from "./departments/DeptVaraos";
import { DeptEBD }     from "./departments/DeptEBD";
import { DeptGeneric } from "./departments/DeptGeneric";

type DeptTab = "home" | "agenda" | "noticias" | "galeria" | "equipe" | "contato";

const TABS: { key: DeptTab; label: string; Icon: React.ElementType }[] = [
  { key: "home",     label: "Início",   Icon: Home },
  { key: "agenda",   label: "Agenda",   Icon: Calendar },
  { key: "noticias", label: "Notícias", Icon: Newspaper },
  { key: "galeria",  label: "Galeria",  Icon: Image },
  { key: "equipe",   label: "Equipe",   Icon: Users },
  { key: "contato",  label: "Contato",  Icon: Mail },
];

interface DepartmentMiniSiteProps {
  slug: DeptSlug;
  onBack: () => void;
}

export function DepartmentMiniSite({ slug }: DepartmentMiniSiteProps) {
  const [activeTab, setActiveTab] = useState<DeptTab>("home");
  const dept = DEPT_MAP[slug];
  if (!dept) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "#0d0f17" }}>

      {/* Department header */}
      <div
        className="flex-shrink-0 px-6 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          {/* Accent dot */}
          <div
            className="w-1.5 h-8 rounded-full flex-shrink-0"
            style={{ background: dept.color }}
          />
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">{dept.name}</h1>
            <p className="text-xs text-white/35 mt-0.5">{dept.description}</p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-3 ml-5">
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
      </div>

      {/* Tabs */}
      <div
        className="flex-shrink-0 flex overflow-x-auto px-4"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          scrollbarWidth: "none",
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap flex-shrink-0 relative transition-colors"
              style={{ color: isActive ? dept.color : "rgba(255,255,255,0.3)" }}
            >
              <tab.Icon size={12} />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId={`dept-underline-${slug}`}
                  className="absolute bottom-0 left-2 right-2 h-px rounded-full"
                  style={{ background: dept.color }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {activeTab === "home"     && <HomeTab slug={slug} dept={dept} />}
            {activeTab === "agenda"   && <AgendaTab   dept={dept} />}
            {activeTab === "noticias" && <NoticiasTab dept={dept} />}
            {activeTab === "galeria"  && <GaleriaTab  dept={dept} />}
            {activeTab === "equipe"   && <EquipeTab   dept={dept} />}
            {activeTab === "contato"  && <ContatoTab  dept={dept} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function HomeTab({ slug, dept }: { slug: DeptSlug; dept: DeptConfig }) {
  switch (slug) {
    case "cibe":   return <DeptCIBE />;
    case "jovens": return <DeptJovens />;
    case "varaos": return <DeptVaraos />;
    case "ebd":    return <DeptEBD />;
    default:       return <DeptGeneric slug={slug} />;
  }
}

// ── Generic tab content ───────────────────────────────────────────────────────

function AgendaTab({ dept }: { dept: DeptConfig }) {
  const items = [
    { date: "Jun 15", dia: "15", mes: "JUN", title: "Reunião de Liderança", time: "19h00" },
    { date: "Jun 22", dia: "22", mes: "JUN", title: "Encontro Mensal",      time: "18h30" },
    { date: "Jul 05", dia: "05", mes: "JUL", title: "Retiro Anual",         time: "08h00" },
    { date: "Jul 19", dia: "19", mes: "JUL", title: "Culto Especial",       time: "19h30" },
  ];
  return (
    <div className="p-6 space-y-3">
      <p className="text-xs text-white/30 uppercase tracking-widest font-semibold mb-4">Próximas programações</p>
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="flex items-center gap-4 p-4 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 flex flex-col items-center justify-center"
            style={{ background: `${dept.color}20`, border: `1px solid ${dept.color}30` }}
          >
            <span className="text-[10px] font-bold" style={{ color: dept.color }}>{item.mes}</span>
            <span className="text-sm font-black text-white leading-none">{item.dia}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white/90">{item.title}</p>
            <p className="text-xs text-white/35 mt-0.5">{item.time}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function NoticiasTab({ dept }: { dept: DeptConfig }) {
  const items = [
    { title: "Grande conquista do departamento",   date: "08 Jun", read: "3 min" },
    { title: "Novidades para o segundo semestre",  date: "01 Jun", read: "2 min" },
    { title: "Programação de julho confirmada",    date: "25 Mai", read: "1 min" },
  ];
  return (
    <div className="p-6 space-y-3">
      <p className="text-xs text-white/30 uppercase tracking-widest font-semibold mb-4">Últimas notícias</p>
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="p-4 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="w-full h-20 rounded-lg mb-3"
            style={{ background: `${dept.color}18` }}
          />
          <p className="text-sm font-semibold text-white/90">{item.title}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] text-white/30">{item.date}</span>
            <span className="text-white/15 text-[11px]">·</span>
            <span className="text-[11px] text-white/30">{item.read} de leitura</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function GaleriaTab({ dept }: { dept: DeptConfig }) {
  return (
    <div className="p-6">
      <p className="text-xs text-white/30 uppercase tracking-widest font-semibold mb-4">Fotos e vídeos</p>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className="aspect-square rounded-xl"
            style={{
              background: i === 0 ? `${dept.color}25` : "rgba(255,255,255,0.05)",
              border: `1px solid ${i === 0 ? dept.color + "30" : "rgba(255,255,255,0.07)"}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function EquipeTab({ dept }: { dept: DeptConfig }) {
  const members = [
    { name: "Líder Principal",  role: "Diretor(a)" },
    { name: "Co-liderança",     role: "Vice-diretor(a)" },
    { name: "Secretária",       role: "Secretária Geral" },
    { name: "Tesoureiro",       role: "Tesoureiro(a)" },
  ];
  return (
    <div className="p-6">
      <p className="text-xs text-white/30 uppercase tracking-widest font-semibold mb-4">Nossa liderança</p>
      <div className="space-y-2">
        {members.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div
              className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
              style={{ background: `${dept.color}20`, color: dept.color }}
            >
              {m.name[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-white/90">{m.name}</p>
              <p className="text-[11px] text-white/35">{m.role}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ContatoTab({ dept }: { dept: DeptConfig }) {
  return (
    <div className="p-6">
      <p className="text-xs text-white/30 uppercase tracking-widest font-semibold mb-4">Fale conosco</p>
      <div
        className="p-5 rounded-2xl space-y-3"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {[
          { label: "NOME",      placeholder: "Seu nome" },
          { label: "E-MAIL",    placeholder: "seu@email.com" },
          { label: "MENSAGEM",  placeholder: "Como podemos ajudar?", multiline: true },
        ].map((field) => (
          <div key={field.label}>
            <label className="text-[10px] font-semibold tracking-widest text-white/30 block mb-1.5">
              {field.label}
            </label>
            {field.multiline ? (
              <textarea
                placeholder={field.placeholder}
                rows={4}
                className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.8)",
                }}
              />
            ) : (
              <input
                type="text"
                placeholder={field.placeholder}
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.8)",
                }}
              />
            )}
          </div>
        ))}
        <button
          className="w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-opacity hover:opacity-90 mt-1"
          style={{ background: dept.color, color: "#fff" }}
        >
          ENVIAR MENSAGEM
        </button>
      </div>
    </div>
  );
}
