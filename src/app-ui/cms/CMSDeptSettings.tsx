import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Save, Eye, Globe, Tag, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import { DEPT_MAP, DEPARTMENTS, type DeptSlug } from "../../components/public/portal/departments/deptConfig";
import { useDeptPage, useSaveDeptPage } from "../../hooks/useDeptPage";

export default function CMSDeptSettings() {
  const { id: deptSlug } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dept = deptSlug ? DEPT_MAP[deptSlug as DeptSlug] : null;
  const { data: savedPage } = useDeptPage(deptSlug ?? "");
  const saveMutation = useSaveDeptPage(deptSlug ?? "");
  const [savedOk, setSavedOk] = useState(false);
  const [published, setPublished] = useState(savedPage?.published ?? false);

  const handlePublish = async () => {
    if (!deptSlug) return;
    await saveMutation.mutateAsync({
      deptSlug,
      blocks: savedPage?.blocks ?? [],
      published: !published,
    });
    setPublished((p) => !p);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2500);
  };

  if (!dept) return <div className="p-8 text-center text-slate-500">Departamento não encontrado.</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate("/app-ui/cms")}
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1.5">
          <ArrowLeft size={14} /> CMS
        </button>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <div className="w-3 h-3 rounded-full" style={{ background: dept.color }} />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{dept.name} — Configurações</h1>
      </div>

      <div className="space-y-6">
        {/* Status card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Status de publicação</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${published ? "bg-green-500" : "bg-amber-400"}`} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {published ? "Publicado" : "Rascunho"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {published ? "O mini-site está visível no portal público." : "Somente admins conseguem ver este mini-site."}
              </p>
            </div>
            <button onClick={handlePublish} disabled={saveMutation.isPending}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                published
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}>
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : savedOk ? <CheckCircle size={14} /> : <Globe size={14} />}
              {published ? "Despublicar" : "Publicar"}
            </button>
          </div>
        </div>

        {/* Department info */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Tag size={14} className="text-slate-400" />
            Informações do departamento
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-500">Nome</span>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">{dept.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-500">Slug (URL)</span>
              <code className="text-xs font-mono text-violet-600 dark:text-violet-400">{dept.slug}</code>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-500">Tags</span>
              <div className="flex gap-1">
                {dept.tags.map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">{t}</span>
                ))}
              </div>
            </div>
            <div className="py-2">
              <span className="text-xs text-slate-500 block mb-1">Descrição</span>
              <span className="text-xs text-slate-700 dark:text-slate-300">{dept.description}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => navigate(`/app-ui/cms/departamentos/${deptSlug}/builder`)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors">
            <Save size={14} /> Abrir Page Builder
          </button>
          <button onClick={() => window.open(`/portal/dept/${deptSlug}`, "_blank")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Eye size={14} /> Preview
          </button>
        </div>
      </div>
    </div>
  );
}
