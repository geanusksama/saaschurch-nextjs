import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  LayoutTemplate, X, Zap, BookOpen, Users, Calendar,
  Music, Globe, Heart, ChevronRight, Sparkles,
} from "lucide-react";
import { DEPARTMENTS } from "../../components/public/portal/departments/deptConfig";

interface Template {
  id: string;
  name: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  blocks: string[];
  badge?: string;
}

const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Em branco",
    desc: "Comece do zero com uma tela limpa.",
    icon: LayoutTemplate,
    color: "#64748b",
    blocks: [],
  },
  {
    id: "ministerio",
    name: "Ministério",
    desc: "Hero + sobre + equipe + agenda + contato.",
    icon: Heart,
    color: "#9333ea",
    blocks: ["hero", "text", "team", "events", "form"],
    badge: "Popular",
  },
  {
    id: "jovens",
    name: "Jovens / Frente",
    desc: "Hero com vídeo, cards de pilares, agenda, galeria e redes sociais.",
    icon: Zap,
    color: "#f59e0b",
    blocks: ["hero", "cards", "events", "gallery", "social"],
  },
  {
    id: "ebd",
    name: "Escola Bíblica (EBD)",
    desc: "Estatísticas, turmas, materiais para download e programação.",
    icon: BookOpen,
    color: "#0ea5e9",
    blocks: ["banner", "cards", "schedule", "text", "form"],
  },
  {
    id: "louvor",
    name: "Louvor / Música",
    desc: "Hero com fundo, galeria de fotos, playlist e equipe.",
    icon: Music,
    color: "#ec4899",
    blocks: ["hero", "gallery", "team", "social"],
  },
  {
    id: "missoes",
    name: "Missões",
    desc: "Banner de impacto, mapa de campos, testemunhos e formulário.",
    icon: Globe,
    color: "#22c55e",
    blocks: ["banner", "text", "map", "testimonials", "form"],
  },
  {
    id: "casais",
    name: "Casais / Família",
    desc: "Hero caloroso, cards de valores, agenda de encontros e contato.",
    icon: Users,
    color: "#f97316",
    blocks: ["hero", "cards", "events", "form"],
  },
  {
    id: "agenda",
    name: "Agenda / Eventos",
    desc: "Focado em eventos: banner + lista de próximos + galeria + inscrição.",
    icon: Calendar,
    color: "#6366f1",
    blocks: ["banner", "events", "gallery", "form"],
  },
];

export default function CMSTemplates() {
  const navigate = useNavigate();

  const applyTemplate = (template: Template, deptSlug: string) => {
    // Navigate to page builder with template query param
    navigate(`/app-ui/cms/departamentos/${deptSlug}/builder?template=${template.id}`);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/app-ui/cms")}
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1.5"
        >
          ← CMS
        </button>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Templates</h1>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {TEMPLATES.map((tpl, i) => (
          <motion.div
            key={tpl.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden group cursor-pointer hover:border-violet-400 hover:shadow-md transition-all"
          >
            {tpl.badge && (
              <span className="absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-600 text-white z-10">
                {tpl.badge}
              </span>
            )}
            {/* Color band */}
            <div className="h-16 flex items-center justify-center" style={{ background: tpl.color + "18", borderBottom: `2px solid ${tpl.color}40` }}>
              <tpl.icon size={26} style={{ color: tpl.color }} />
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{tpl.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                {tpl.desc}
              </p>
              {tpl.blocks.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {tpl.blocks.slice(0, 4).map((b) => (
                    <span key={b} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 capitalize">
                      {b}
                    </span>
                  ))}
                  {tpl.blocks.length > 4 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-400">
                      +{tpl.blocks.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Hover: choose dept */}
            <div className="absolute inset-0 bg-white/95 dark:bg-slate-800/97 opacity-0 group-hover:opacity-100 transition-all flex flex-col p-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                <Sparkles size={11} className="text-violet-500" />
                Aplicar em qual departamento?
              </p>
              <div className="flex-1 overflow-y-auto space-y-1">
                {DEPARTMENTS.map((dept) => (
                  <button
                    key={dept.slug}
                    onClick={() => applyTemplate(tpl, dept.slug)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dept.color }} />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">{dept.name}</span>
                    <ChevronRight size={10} className="text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Info footer */}
      <p className="text-xs text-slate-400 text-center">
        Os templates pré-preenchem os blocos no construtor — você pode editar livremente depois.
      </p>
    </div>
  );
}
