import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  LayoutGrid, Globe, Settings, Eye, Edit3,
  CheckCircle, AlertCircle, PlusCircle, Layers,
} from "lucide-react";
import { DEPARTMENTS } from "../../components/public/portal/departments/deptConfig";

export default function CMSDashboard() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");

  // Simulated publish status (would come from DB in production)
  const publishedSlugs = new Set(["cibe", "jovens", "ebd"]);

  const filtered = DEPARTMENTS.filter((d) => {
    if (filter === "published") return publishedSlugs.has(d.slug);
    if (filter === "draft")     return !publishedSlugs.has(d.slug);
    return true;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            CMS de Departamentos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie os mini-sites e conteúdos de cada departamento
          </p>
        </div>
        <button
          onClick={() => navigate("/app-ui/cms/templates")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
        >
          <PlusCircle size={15} />
          Novo a partir de template
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Departamentos",     value: DEPARTMENTS.length, icon: LayoutGrid,   color: "violet" },
          { label: "Publicados",         value: publishedSlugs.size, icon: CheckCircle, color: "green" },
          { label: "Em rascunho",        value: DEPARTMENTS.length - publishedSlugs.size, icon: AlertCircle, color: "amber" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-${stat.color}-100 dark:bg-${stat.color}-900/30`}>
              <stat.icon size={16} className={`text-${stat.color}-600 dark:text-${stat.color}-400`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200 dark:border-slate-700">
        {(["all", "published", "draft"] as const).map((f) => {
          const labels = { all: "Todos", published: "Publicados", draft: "Rascunho" };
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                filter === f
                  ? "border-violet-600 text-violet-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {labels[f]}
            </button>
          );
        })}
      </div>

      {/* Department grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((dept, i) => {
          const isPublished = publishedSlugs.has(dept.slug);
          return (
            <motion.div
              key={dept.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden group"
            >
              {/* Color header */}
              <div className="h-14 relative flex items-center px-4 gap-3" style={{ background: dept.color + "18", borderBottom: `2px solid ${dept.color}40` }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dept.color }} />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{dept.name}</p>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isPublished
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                  }`}
                >
                  {isPublished ? "Publicado" : "Rascunho"}
                </span>
              </div>

              {/* Content */}
              <div className="p-4">
                <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                  {dept.description}
                </p>

                <div className="flex flex-wrap gap-1 mb-4">
                  {dept.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/app-ui/cms/departamentos/${dept.slug}/builder`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                  >
                    <Edit3 size={12} />
                    Editar
                  </button>
                  <button
                    onClick={() => window.open(`/portal/dept/${dept.slug}`, "_blank")}
                    className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    title="Preview"
                  >
                    <Eye size={14} className="text-slate-500" />
                  </button>
                  <button
                    onClick={() => navigate(`/app-ui/cms/departamentos/${dept.slug}`)}
                    className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    title="Configurações"
                  >
                    <Settings size={14} className="text-slate-500" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
