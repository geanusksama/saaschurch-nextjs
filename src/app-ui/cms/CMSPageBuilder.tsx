import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { motion, AnimatePresence, Reorder } from "motion/react";
import {
  Eye, Save, LayoutTemplate, Type, Image as ImageIcon,
  Video, Grid3X3, Users, Calendar, MessageSquare, FileText,
  Map, Share2, GripVertical, Trash2, Plus, X, ChevronRight,
  Sparkles, CheckCircle, SlidersHorizontal, Upload, Loader2,
  Columns, Pencil, AtSign, PlayCircle, Phone, Headphones,
} from "lucide-react";
import { DEPT_MAP, type DeptSlug, type DeptConfig } from "../../components/public/portal/departments/deptConfig";
import { useDeptPage, useSaveDeptPage, uploadDeptMedia, type PageBlock } from "../../hooks/useDeptPage";

// ── Block type registry ───────────────────────────────────────────────────────

type BlockType =
  | "hero" | "banner" | "carousel" | "text" | "image" | "video" | "gallery"
  | "cards" | "events" | "team" | "testimonials"
  | "faq" | "form" | "schedule" | "map" | "social" | "columns" | "divider";

type Block = PageBlock & { type: BlockType };

const BLOCK_LIBRARY: { type: BlockType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: "hero",         label: "Hero",          icon: LayoutTemplate,    desc: "Seção principal com bg, vídeo, CTA" },
  { type: "banner",       label: "Banner",         icon: ImageIcon,         desc: "Banner com imagem e texto overlay" },
  { type: "carousel",     label: "Carrossel",      icon: SlidersHorizontal, desc: "Slides com imagens e legendas" },
  { type: "text",         label: "Texto",          icon: Type,              desc: "Parágrafo ou título" },
  { type: "image",        label: "Imagem",         icon: ImageIcon,         desc: "Foto ou banner simples" },
  { type: "video",        label: "Vídeo",          icon: Video,             desc: "YouTube / Vimeo" },
  { type: "gallery",      label: "Galeria",        icon: Grid3X3,           desc: "Grade de fotos" },
  { type: "cards",        label: "Cards",          icon: Sparkles,          desc: "Blocos de conteúdo" },
  { type: "events",       label: "Eventos",        icon: Calendar,          desc: "Agenda integrada" },
  { type: "team",         label: "Equipe",         icon: Users,             desc: "Membros e líderes" },
  { type: "testimonials", label: "Testemunhos",    icon: MessageSquare,     desc: "Depoimentos" },
  { type: "faq",          label: "FAQ",            icon: FileText,          desc: "Perguntas frequentes" },
  { type: "form",         label: "Formulário",     icon: CheckCircle,       desc: "Contato / inscrição" },
  { type: "schedule",     label: "Programação",    icon: Calendar,          desc: "Horários e escalas" },
  { type: "map",          label: "Mapa",           icon: Map,               desc: "Localização" },
  { type: "social",       label: "Redes Sociais",  icon: Share2,            desc: "Links sociais em linha" },
  { type: "columns",      label: "Colunas",        icon: Columns,           desc: "2-4 colunas lado a lado" },
  { type: "divider",      label: "Separador",      icon: Grid3X3,           desc: "Divisor de seções" },
];

const BLOCK_DEFAULTS: Record<BlockType, Record<string, string | boolean | number>> = {
  hero: {
    title: "Bem-vindo ao nosso departamento", subtitle: "", badge: "", watermarkText: "",
    ctaText: "", ctaUrl: "", ctaStyle: "primary", textAlign: "center",
    bgType: "color", bgImage: "", bgVideo: "", overlayOpacity: 50, bgColor: "", height: "lg",
  },
  banner: {
    title: "", subtitle: "", badge: "", watermarkText: "", bgImage: "", bgColor: "",
    overlayOpacity: 40, textAlign: "left", ctaText: "", ctaUrl: "", height: "md",
  },
  carousel: { slidesCount: 3, autoplay: "true", interval: "5", showDots: "true", showArrows: "true", effect: "slide", height: "md" },
  text:         { content: "Escreva o conteúdo aqui...", align: "left", size: "base" },
  image:        { url: "", alt: "", caption: "", width: "full", rounded: "true" },
  video:        { url: "", caption: "", autoplay: "false", loop: "false" },
  gallery:      { columns: 3, showCaptions: "false", gap: "sm" },
  cards:        { columns: 3, variant: "vertical" },
  events:       { limit: 4, showPast: "false" },
  team:         { columns: 4, showBio: "false" },
  testimonials: { limit: 3, variant: "cards" },
  faq:          { expanded: "false" },
  form:         { subject: "Contato", fields: "name,email,message" },
  schedule:     { showWeekly: "true" },
  map:          { address: "", zoom: 14 },
  social:       { instagram: "", youtube: "", whatsapp: "", facebook: "", spotify: "", layout: "row" },
  columns: {
    count: "2", gap: "md",
    col1Title: "", col1Text: "", col1Icon: "", col1BtnText: "", col1BtnUrl: "",
    col2Title: "", col2Text: "", col2Icon: "", col2BtnText: "", col2BtnUrl: "",
    col3Title: "", col3Text: "", col3Icon: "", col3BtnText: "", col3BtnUrl: "",
    col4Title: "", col4Text: "", col4Icon: "", col4BtnText: "", col4BtnUrl: "",
  },
  divider:      { style: "line", spacing: "md" },
};

const COLOR_PRESETS = ["#1a1a2e", "#e53e3e", "#22c55e", "#3b82f6", "#9333ea", "#f59e0b", "#0ea5e9", "#ec4899"];

function genId() { return Math.random().toString(36).slice(2, 9); }

// ── Module-level UI primitives (OUTSIDE all components to avoid remount-on-render) ──

const inputCls = "w-full px-3 py-2 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500";

function EditorField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
        {label}{hint && <span className="ml-1 text-[10px] font-normal opacity-60">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function EditorInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} className={inputCls} />
  );
}

function EditorTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} rows={rows} className={`${inputCls} resize-none`} />
  );
}

function EditorSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { label: string; value: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function EditorSlider({ label, hint, value, onChange, min = 0, max = 100 }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <EditorField label={label} hint={hint ?? `${value}%`}>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-violet-600" />
    </EditorField>
  );
}

function EditorDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">{label}</span>
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

function EditorImageField({ label, value, onChange, deptSlug }: {
  label: string; value: string; onChange: (v: string) => void; deptSlug: string;
}) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadDeptMedia(deptSlug, file);
      onChange(url);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <EditorField label={label} hint="jpg, png, webp · max 5MB">
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div className="space-y-1.5">
        {value && (
          <div className="relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 aspect-video">
            <img src={value} alt="" className="w-full h-full object-cover" />
            <button onClick={() => onChange("")} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
              <X size={10} className="text-white" />
            </button>
          </div>
        )}
        <div className="flex gap-1.5">
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
            placeholder="https://... ou cole a URL"
            className="flex-1 min-w-0 px-2.5 py-2 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
          <button onClick={() => ref.current?.click()} disabled={uploading}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-shrink-0">
            {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
            {uploading ? "..." : "Upload"}
          </button>
        </div>
      </div>
    </EditorField>
  );
}

function EditorColorField({ label, value, onChange, deptColor }: {
  label: string; value: string; onChange: (v: string) => void; deptColor: string;
}) {
  return (
    <EditorField label={label}>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {[...COLOR_PRESETS, deptColor].map((c) => (
          <button key={c} onClick={() => onChange(c)}
            className="w-7 h-7 rounded-full border-2 transition-all"
            style={{ background: c, borderColor: value === c ? "#fff" : "transparent" }} />
        ))}
      </div>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="#hex ou bg-gradient-to-r from-... to-..."
        className={inputCls} />
    </EditorField>
  );
}

// ── Main Page Builder ─────────────────────────────────────────────────────────

export default function CMSPageBuilder() {
  const { id: deptSlug } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dept = deptSlug ? DEPT_MAP[deptSlug as DeptSlug] : null;

  const { data: savedPage, isLoading } = useDeptPage(deptSlug ?? "");
  const saveMutation = useSaveDeptPage(deptSlug ?? "");

  const [blocks, setBlocks] = useState<Block[]>([
    { id: genId(), type: "hero",    label: "Hero",    config: { ...BLOCK_DEFAULTS.hero } },
    { id: genId(), type: "events",  label: "Eventos", config: { ...BLOCK_DEFAULTS.events } },
    { id: genId(), type: "gallery", label: "Galeria", config: { ...BLOCK_DEFAULTS.gallery } },
  ]);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (!loadedRef.current && savedPage?.blocks && savedPage.blocks.length > 0) {
      setBlocks(savedPage.blocks as Block[]);
      loadedRef.current = true;
    }
  }, [savedPage]);

  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [savedOk, setSavedOk]         = useState(false);
  const [pageConfig, setPageConfig] = useState({
    titleOverride: "", subtitleOverride: "", showAccentBar: true,
  });

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;

  const openHeader = () => { setSelectedId(null); setEditingHeader(true); };
  const closePanel = () => { setSelectedId(null); setEditingHeader(false); };

  const addBlock = useCallback((type: BlockType) => {
    const def = BLOCK_LIBRARY.find((b) => b.type === type)!;
    const nb: Block = { id: genId(), type, label: def.label, config: { ...BLOCK_DEFAULTS[type] } };
    setBlocks((prev) => [...prev, nb]);
    setSelectedId(nb.id);
    setShowLibrary(false);
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  // updateConfig uses functional update — stable, doesn't cause full re-render of block list
  const updateConfig = useCallback((id: string, key: string, value: string | boolean | number) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, config: { ...b.config, [key]: value } } : b));
  }, []);

  const handleSave = async () => {
    if (!deptSlug) return;
    await saveMutation.mutateAsync({ deptSlug, blocks });
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2500);
  };

  if (!dept) return <div className="p-8 text-center text-slate-500">Departamento não encontrado.</div>;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* ── Left: block list ── */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <button onClick={() => navigate("/app-ui/cms")}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 mb-3">
            ← CMS
          </button>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: dept.color }} />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{dept.name}</p>
              <p className="text-[10px] text-slate-400">Page Builder</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isLoading && (
            <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
              <Loader2 size={12} className="animate-spin text-slate-400" />
              <span className="text-[10px] text-slate-400">Carregando...</span>
            </div>
          )}
          <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase mb-2 px-1">
            Seções ({blocks.length})
          </p>
          <Reorder.Group axis="y" values={blocks} onReorder={setBlocks} className="space-y-1">
            {blocks.map((block) => {
              const def = BLOCK_LIBRARY.find((b) => b.type === block.type);
              const Icon = def?.icon ?? LayoutTemplate;
              const isSel = selectedId === block.id;
              return (
                <Reorder.Item key={block.id} value={block}>
                  <motion.div layout role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedId(isSel ? null : block.id); }}
                    onClick={() => setSelectedId(isSel ? null : block.id)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors cursor-pointer group ${
                      isSel ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                             : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"}`}>
                    <GripVertical size={12} className="text-slate-300 dark:text-slate-600 cursor-grab flex-shrink-0" />
                    <Icon size={13} className="flex-shrink-0" />
                    <span className="text-xs font-medium flex-1 truncate">{block.label}</span>
                    <div role="button" tabIndex={0}
                      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") removeBlock(block.id); }}
                      onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 p-0.5 cursor-pointer">
                      <Trash2 size={11} />
                    </div>
                  </motion.div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>

          <button onClick={() => setShowLibrary(true)}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 hover:text-violet-600 hover:border-violet-400 transition-colors">
            <Plus size={13} />
            Adicionar bloco
          </button>
        </div>
      </div>

      {/* ── Center: Canvas ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Construtor Visual</span>
            <ChevronRight size={12} className="text-slate-300" />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{dept.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.open(`/portal/dept/${dept.slug}`, "_blank")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Eye size={13} /> Preview
            </button>
            <button onClick={handleSave} disabled={saveMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 transition-colors">
              {saveMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : savedOk ? <CheckCircle size={13} /> : <Save size={13} />}
              {saveMutation.isPending ? "Salvando..." : savedOk ? "Salvo!" : "Salvar"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-xl" style={{ background: "#0a0a14", minHeight: 600 }}>
            {/* Clickable dept header */}
            <div role="button" tabIndex={0} onClick={openHeader}
              onKeyDown={(e) => { if (e.key === "Enter") openHeader(); }}
              className={`relative p-5 cursor-pointer transition-all group ${editingHeader ? "ring-2 ring-inset ring-violet-500" : "hover:ring-2 hover:ring-inset hover:ring-white/20"}`}
              style={{ borderBottom: `2px solid ${dept.color}40` }}>
              <div className="flex items-center gap-3">
                {pageConfig.showAccentBar !== false && (
                  <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: dept.color }} />
                )}
                <div className="flex-1">
                  <p className="text-base font-bold text-white">{pageConfig.titleOverride || dept.name}</p>
                  <p className="text-xs text-white/40">{pageConfig.subtitleOverride || dept.description}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-opacity ${editingHeader ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  style={{ background: dept.color + "30", color: dept.iconColor }}>
                  <Pencil size={9} /> Editar
                </span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <AnimatePresence>
                {blocks.map((block) => {
                  const def = BLOCK_LIBRARY.find((b) => b.type === block.type);
                  const Icon = def?.icon ?? LayoutTemplate;
                  const isSel = selectedId === block.id;
                  return (
                    <motion.div key={block.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }} onClick={() => setSelectedId(isSel ? null : block.id)}
                      className={`relative rounded-xl cursor-pointer transition-all overflow-hidden ${isSel ? "ring-2 ring-violet-500" : "hover:ring-1 hover:ring-white/20"}`}
                      style={{ background: isSel ? `${dept.color}15` : "rgba(255,255,255,0.04)", border: `1px solid ${isSel ? dept.color + "40" : "rgba(255,255,255,0.06)"}` }}>
                      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <Icon size={12} style={{ color: isSel ? dept.color : "#64748b" }} />
                        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">{block.label}</span>
                        {isSel && (
                          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: dept.color, color: "#fff" }}>
                            Editar →
                          </span>
                        )}
                      </div>
                      <div className="p-3"><BlockPreview block={block} dept={dept} /></div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {blocks.length === 0 && (
                <div className="text-center py-16 text-slate-500 text-sm">Nenhum bloco. Adicione no painel esquerdo.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: properties ── */}
      <AnimatePresence>
        {(selectedBlock || editingHeader) && (
          <motion.div initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {editingHeader ? "Cabeçalho da página" : selectedBlock?.label}
              </p>
              <button onClick={closePanel} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {editingHeader ? (
                <HeaderEditor pageConfig={pageConfig} dept={dept}
                  onChange={(key, val) => setPageConfig((p) => ({ ...p, [key]: val }))} />
              ) : selectedBlock ? (
                <BlockEditor block={selectedBlock} dept={dept}
                  onUpdate={(key, val) => updateConfig(selectedBlock.id, key, val)} />
              ) : null}
            </div>
            {!editingHeader && selectedBlock && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
                <button onClick={() => removeBlock(selectedBlock.id)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 transition-colors">
                  <Trash2 size={12} /> Remover bloco
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Library modal ── */}
      <AnimatePresence>
        {showLibrary && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowLibrary(false)}>
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Biblioteca de Blocos</h3>
                <button onClick={() => setShowLibrary(false)}><X size={18} className="text-slate-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {BLOCK_LIBRARY.map((block) => (
                  <button key={block.type} onClick={() => addBlock(block.type)}
                    className="flex items-start gap-3 p-3 rounded-xl text-left border border-slate-200 dark:border-slate-700 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                      <block.icon size={15} className="text-slate-600 dark:text-slate-300" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{block.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{block.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Header editor (page config panel) ────────────────────────────────────────

function HeaderEditor({ pageConfig, dept, onChange }: {
  pageConfig: { titleOverride: string; subtitleOverride: string; showAccentBar: boolean };
  dept: DeptConfig;
  onChange: (key: string, val: string | boolean) => void;
}) {
  return (
    <>
      <p className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
        Personalize o cabeçalho que aparece no topo da página do departamento.
      </p>
      <EditorDivider label="Texto" />
      <EditorField label="Título" hint="deixe vazio para usar o nome do depto">
        <EditorInput value={pageConfig.titleOverride} onChange={(v) => onChange("titleOverride", v)}
          placeholder={dept.name} />
      </EditorField>
      <EditorField label="Subtítulo" hint="deixe vazio para usar a descrição">
        <EditorInput value={pageConfig.subtitleOverride} onChange={(v) => onChange("subtitleOverride", v)}
          placeholder={dept.description} />
      </EditorField>
      <EditorDivider label="Estilo" />
      <EditorField label="Barra de acento lateral">
        <EditorSelect value={pageConfig.showAccentBar ? "true" : "false"}
          onChange={(v) => onChange("showAccentBar", v === "true")}
          options={[{ label: "Visível", value: "true" }, { label: "Oculta", value: "false" }]} />
      </EditorField>
    </>
  );
}

// ── Block Preview ─────────────────────────────────────────────────────────────

function BlockPreview({ block, dept }: { block: Block; dept: DeptConfig }) {
  const heightMap: Record<string, string> = { sm: "h-20", md: "h-32", lg: "h-44", full: "h-56" };
  const h = heightMap[String(block.config.height ?? "lg")] ?? "h-44";

  if (block.type === "hero" || block.type === "banner") {
    const hasBgImg = block.config.bgType === "image" && block.config.bgImage;
    const bgStyle = hasBgImg
      ? { backgroundImage: `url(${block.config.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
      : block.config.bgColor
      ? { background: String(block.config.bgColor) }
      : block.config.bgType === "gradient"
      ? { background: `linear-gradient(135deg, ${dept.color}60, ${dept.color}20)` }
      : { background: `${dept.color}25` };
    const align = String(block.config.textAlign ?? "center");
    const overlayPct = Number(block.config.overlayOpacity ?? 50) / 100;

    return (
      <div className={`relative ${h} rounded-lg overflow-hidden flex items-center`}
        style={{ ...bgStyle, border: `1px solid ${dept.color}40` }}>
        {(hasBgImg || block.config.bgVideo) && <div className="absolute inset-0 bg-black" style={{ opacity: overlayPct }} />}
        {block.config.watermarkText && (
          <span className="absolute right-3 bottom-1 text-3xl font-black text-white/10 select-none pointer-events-none uppercase">
            {String(block.config.watermarkText)}
          </span>
        )}
        <div className="relative z-10 px-4 w-full" style={{ textAlign: align as "left" | "center" | "right" }}>
          {block.config.badge && (
            <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mb-1"
              style={{ background: `${dept.color}30`, color: dept.iconColor, border: `1px solid ${dept.color}40` }}>
              {String(block.config.badge)}
            </span>
          )}
          {block.config.title && <p className="text-sm font-black text-white leading-tight drop-shadow">{String(block.config.title)}</p>}
          {block.config.subtitle && <p className="text-[10px] text-white/70 mt-1">{String(block.config.subtitle)}</p>}
          {block.config.ctaText && (
            <div className="mt-2 inline-flex">
              <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg"
                style={{ background: block.config.ctaStyle === "outline" ? "transparent" : dept.color, color: block.config.ctaStyle === "outline" ? dept.color : "#fff", border: `1px solid ${dept.color}` }}>
                {String(block.config.ctaText)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (block.type === "carousel") {
    const count = Math.min(Number(block.config.slidesCount ?? 3), 5);
    return (
      <div className={`relative ${heightMap[String(block.config.height ?? "md")] ?? "h-32"} rounded-lg overflow-hidden`}
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex gap-1 p-2 h-full">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex-1 rounded-md"
              style={{ background: i === 0 ? `${dept.color}30` : "rgba(255,255,255,0.05)", border: i === 0 ? `1px solid ${dept.color}50` : "1px solid rgba(255,255,255,0.06)" }} />
          ))}
        </div>
        {block.config.showDots !== "false" && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="rounded-full"
                style={{ width: i === 0 ? 12 : 5, height: 5, background: i === 0 ? dept.color : "rgba(255,255,255,0.2)" }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (block.type === "text") return <div className="space-y-1.5">{[75, 90, 55].map((w, i) => <div key={i} className="h-2 rounded bg-white/10" style={{ width: `${w}%` }} />)}</div>;
  if (block.type === "gallery") return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${block.config.columns ?? 3}, 1fr)` }}>
      {Array.from({ length: Number(block.config.columns ?? 3) * 2 }).map((_, i) => <div key={i} className="aspect-square rounded bg-white/10" />)}
    </div>
  );
  if (block.type === "video") return (
    <div className="h-28 rounded-lg bg-black/40 flex items-center justify-center" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
        <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-white/60 ml-0.5" />
      </div>
    </div>
  );
  if (block.type === "events") return (
    <div className="space-y-1.5">
      {Array.from({ length: Math.min(Number(block.config.limit ?? 3), 3) }).map((_, i) => (
        <div key={i} className="flex gap-2 items-center">
          <div className="w-6 h-6 rounded flex-shrink-0" style={{ background: `${dept.color}20` }} />
          <div className="h-2 rounded bg-white/10 flex-1" />
        </div>
      ))}
    </div>
  );
  if (block.type === "social") {
    const networks = [
      { key: "instagram", Icon: AtSign,       label: "Instagram" },
      { key: "youtube",   Icon: PlayCircle,   label: "YouTube"   },
      { key: "whatsapp",  Icon: Phone,        label: "WhatsApp"  },
      { key: "facebook",  Icon: Share2,       label: "Facebook"  },
      { key: "spotify",   Icon: Headphones,   label: "Spotify"   },
    ].filter((n) => block.config[n.key]);
    const shown = networks.length > 0 ? networks : [
      { key: "instagram", Icon: AtSign,     label: "Instagram" },
      { key: "youtube",   Icon: PlayCircle, label: "YouTube"   },
      { key: "whatsapp",  Icon: Phone,      label: "WhatsApp"  },
    ];
    return (
      <div className="flex flex-wrap gap-2 p-2">
        {shown.map(({ key, Icon, label }) => (
          <div key={key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Icon size={12} className="text-white/60" />
            <span className="text-[10px] text-white/50">{label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === "columns") {
    const count = Number(block.config.count ?? 2);
    return (
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
        {Array.from({ length: count }).map((_, i) => {
          const n = i + 1;
          const title = block.config[`col${n}Title`];
          const text  = block.config[`col${n}Text`];
          return (
            <div key={i} className="p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${dept.color}30` }}>
              {title
                ? <p className="text-[10px] font-bold text-white/80 mb-1 truncate">{String(title)}</p>
                : <div className="h-2 rounded bg-white/15 mb-1.5 w-3/4" />
              }
              {text
                ? <p className="text-[9px] text-white/40 truncate">{String(text)}</p>
                : <div className="h-1.5 rounded bg-white/08 w-full" />
              }
            </div>
          );
        })}
      </div>
    );
  }

  if (block.type === "divider") return <div className="h-px bg-white/10 my-2" />;
  return (
    <div className="h-12 rounded-lg bg-white/5 flex items-center justify-center">
      <span className="text-[10px] text-white/30">{block.label}</span>
    </div>
  );
}

// ── Block Editor ──────────────────────────────────────────────────────────────
// Uses module-level components (EditorInput, EditorSelect, etc.) to prevent
// remount-on-render and focus loss on each keystroke.

function BlockEditor({ block, dept, onUpdate }: {
  block: Block; dept: DeptConfig;
  onUpdate: (key: string, val: string | boolean | number) => void;
}) {
  const cfg = block.config;
  const deptSlug = block.config.dept_slug as string || "media";
  const get = (k: string) => String(cfg[k] ?? "");
  const num = (k: string, def = 0) => Number(cfg[k] ?? def);
  const set = (k: string) => (v: string) => onUpdate(k, v);
  const setNum = (k: string) => (v: number) => onUpdate(k, v);

  if (block.type === "hero" || block.type === "banner") return (
    <>
      <EditorDivider label="Conteúdo" />
      <div className="grid grid-cols-2 gap-2">
        <EditorField label="Badge (etiqueta)">
          <EditorInput value={get("badge")} onChange={set("badge")} placeholder="Ex: Novo" />
        </EditorField>
        <EditorField label="Marca d'água">
          <EditorInput value={get("watermarkText")} onChange={set("watermarkText")} placeholder="Ex: SALE" />
        </EditorField>
      </div>
      <EditorField label="Título principal">
        <EditorInput value={get("title")} onChange={set("title")} placeholder="Título do hero" />
      </EditorField>
      <EditorField label="Subtítulo / Descrição">
        <EditorInput value={get("subtitle")} onChange={set("subtitle")} placeholder="Texto de apoio" />
      </EditorField>
      <EditorField label="Alinhamento">
        <EditorSelect value={get("textAlign")} onChange={set("textAlign")} options={[
          { label: "Esquerda", value: "left" }, { label: "Centro", value: "center" }, { label: "Direita", value: "right" },
        ]} />
      </EditorField>

      <EditorDivider label="Botão CTA" />
      <div className="grid grid-cols-2 gap-2">
        <EditorField label="Texto do botão">
          <EditorInput value={get("ctaText")} onChange={set("ctaText")} placeholder="Ex: Saiba mais" />
        </EditorField>
        <EditorField label="Link do botão">
          <EditorInput value={get("ctaUrl")} onChange={set("ctaUrl")} placeholder="https://" />
        </EditorField>
      </div>
      <EditorField label="Estilo do botão">
        <EditorSelect value={get("ctaStyle")} onChange={set("ctaStyle")} options={[
          { label: "Preenchido", value: "primary" }, { label: "Contorno", value: "outline" }, { label: "Ghost", value: "ghost" },
        ]} />
      </EditorField>

      <EditorDivider label="Fundo" />
      <EditorField label="Tipo de fundo">
        <EditorSelect value={get("bgType")} onChange={set("bgType")} options={[
          { label: "Cor sólida", value: "color" }, { label: "Gradiente", value: "gradient" },
          { label: "Imagem", value: "image" }, { label: "Vídeo (URL)", value: "video" },
        ]} />
      </EditorField>
      {(cfg.bgType === "color" || cfg.bgType === "gradient") && (
        <EditorColorField label="Cor / Gradiente" value={get("bgColor")} onChange={set("bgColor")} deptColor={dept.color} />
      )}
      {cfg.bgType === "image" && (
        <EditorImageField label="Imagem de fundo" value={get("bgImage")} onChange={set("bgImage")} deptSlug={deptSlug} />
      )}
      {cfg.bgType === "video" && (
        <EditorField label="URL do vídeo" hint="YouTube ou mp4">
          <EditorInput value={get("bgVideo")} onChange={set("bgVideo")} placeholder="https://..." />
        </EditorField>
      )}
      {(cfg.bgType === "image" || cfg.bgType === "video") && (
        <EditorSlider label="Opacidade do overlay" value={num("overlayOpacity", 50)} onChange={setNum("overlayOpacity")} min={0} max={90} />
      )}

      <EditorDivider label="Dimensões" />
      <EditorField label="Altura">
        <EditorSelect value={get("height")} onChange={set("height")} options={[
          { label: "Compacto (180px)", value: "sm" }, { label: "Médio (280px)", value: "md" },
          { label: "Grande (420px)", value: "lg" }, { label: "Tela cheia", value: "full" },
        ]} />
      </EditorField>
    </>
  );

  if (block.type === "carousel") return (
    <>
      <EditorDivider label="Slides" />
      <EditorField label="Número de slides">
        <EditorSelect value={get("slidesCount")} onChange={set("slidesCount")} options={[
          { label: "2 slides", value: "2" }, { label: "3 slides", value: "3" },
          { label: "4 slides", value: "4" }, { label: "5 slides", value: "5" },
        ]} />
      </EditorField>
      <EditorField label="Efeito">
        <EditorSelect value={get("effect")} onChange={set("effect")} options={[
          { label: "Deslizar", value: "slide" }, { label: "Fade", value: "fade" }, { label: "Cube", value: "cube" },
        ]} />
      </EditorField>
      <EditorDivider label="Comportamento" />
      <EditorField label="Autoplay">
        <EditorSelect value={get("autoplay")} onChange={set("autoplay")} options={[{ label: "Ativado", value: "true" }, { label: "Desativado", value: "false" }]} />
      </EditorField>
      {cfg.autoplay !== "false" && (
        <EditorField label="Intervalo">
          <EditorSelect value={get("interval")} onChange={set("interval")} options={[{ label: "3s", value: "3" }, { label: "5s", value: "5" }, { label: "8s", value: "8" }]} />
        </EditorField>
      )}
      <EditorField label="Mostrar dots">
        <EditorSelect value={get("showDots")} onChange={set("showDots")} options={[{ label: "Sim", value: "true" }, { label: "Não", value: "false" }]} />
      </EditorField>
      <EditorField label="Mostrar setas">
        <EditorSelect value={get("showArrows")} onChange={set("showArrows")} options={[{ label: "Sim", value: "true" }, { label: "Não", value: "false" }]} />
      </EditorField>
      <EditorDivider label="Dimensões" />
      <EditorField label="Altura">
        <EditorSelect value={get("height")} onChange={set("height")} options={[
          { label: "Compacto", value: "sm" }, { label: "Médio", value: "md" }, { label: "Grande", value: "lg" }, { label: "Tela cheia", value: "full" },
        ]} />
      </EditorField>
    </>
  );

  if (block.type === "text") return (
    <>
      <EditorField label="Conteúdo">
        <EditorTextarea value={get("content")} onChange={set("content")} placeholder="Escreva o conteúdo..." rows={5} />
      </EditorField>
      <EditorField label="Alinhamento">
        <EditorSelect value={get("align")} onChange={set("align")} options={[{ label: "Esquerda", value: "left" }, { label: "Centro", value: "center" }, { label: "Direita", value: "right" }]} />
      </EditorField>
      <EditorField label="Tamanho">
        <EditorSelect value={get("size")} onChange={set("size")} options={[{ label: "Pequeno", value: "sm" }, { label: "Normal", value: "base" }, { label: "Grande", value: "lg" }, { label: "Título", value: "xl" }]} />
      </EditorField>
    </>
  );

  if (block.type === "image") return (
    <>
      <EditorImageField label="Imagem" value={get("url")} onChange={set("url")} deptSlug={deptSlug} />
      <EditorField label="Texto alternativo"><EditorInput value={get("alt")} onChange={set("alt")} placeholder="Descrição" /></EditorField>
      <EditorField label="Legenda"><EditorInput value={get("caption")} onChange={set("caption")} placeholder="Legenda opcional" /></EditorField>
    </>
  );

  if (block.type === "video") return (
    <>
      <EditorField label="URL do vídeo" hint="YouTube ou Vimeo">
        <EditorInput value={get("url")} onChange={set("url")} placeholder="https://youtube.com/..." />
      </EditorField>
      <EditorField label="Legenda"><EditorInput value={get("caption")} onChange={set("caption")} placeholder="Legenda opcional" /></EditorField>
      <EditorField label="Autoplay">
        <EditorSelect value={get("autoplay")} onChange={set("autoplay")} options={[{ label: "Não", value: "false" }, { label: "Sim", value: "true" }]} />
      </EditorField>
    </>
  );

  if (block.type === "gallery") return (
    <>
      <EditorField label="Colunas">
        <EditorSelect value={get("columns")} onChange={set("columns")} options={[{ label: "2 colunas", value: "2" }, { label: "3 colunas", value: "3" }, { label: "4 colunas", value: "4" }]} />
      </EditorField>
      <EditorField label="Espaçamento">
        <EditorSelect value={get("gap")} onChange={set("gap")} options={[{ label: "Sem espaço", value: "none" }, { label: "Pequeno", value: "sm" }, { label: "Médio", value: "md" }]} />
      </EditorField>
    </>
  );

  if (block.type === "events") return (
    <EditorField label="Limite de eventos">
      <EditorSelect value={get("limit")} onChange={set("limit")} options={[{ label: "3", value: "3" }, { label: "4", value: "4" }, { label: "6", value: "6" }, { label: "Todos", value: "99" }]} />
    </EditorField>
  );

  if (block.type === "social") return (
    <>
      <EditorDivider label="Links" />
      <EditorField label="Instagram"><EditorInput value={get("instagram")} onChange={set("instagram")} placeholder="@usuario" /></EditorField>
      <EditorField label="YouTube"><EditorInput value={get("youtube")} onChange={set("youtube")} placeholder="URL do canal" /></EditorField>
      <EditorField label="WhatsApp"><EditorInput value={get("whatsapp")} onChange={set("whatsapp")} placeholder="5511999..." /></EditorField>
      <EditorField label="Facebook"><EditorInput value={get("facebook")} onChange={set("facebook")} placeholder="URL da página" /></EditorField>
      <EditorField label="Spotify"><EditorInput value={get("spotify")} onChange={set("spotify")} placeholder="URL da playlist" /></EditorField>
      <EditorDivider label="Layout" />
      <EditorField label="Exibição">
        <EditorSelect value={get("layout")} onChange={set("layout")} options={[
          { label: "Linha horizontal", value: "row" },
          { label: "Grade (2 colunas)", value: "grid" },
        ]} />
      </EditorField>
    </>
  );

  if (block.type === "columns") {
    const count = Number(get("count") || "2");
    return (
      <>
        <EditorDivider label="Estrutura" />
        <EditorField label="Número de colunas">
          <EditorSelect value={get("count")} onChange={set("count")} options={[
            { label: "2 colunas", value: "2" }, { label: "3 colunas", value: "3" }, { label: "4 colunas", value: "4" },
          ]} />
        </EditorField>
        <EditorField label="Espaçamento">
          <EditorSelect value={get("gap")} onChange={set("gap")} options={[
            { label: "Pequeno", value: "sm" }, { label: "Médio", value: "md" }, { label: "Grande", value: "lg" },
          ]} />
        </EditorField>
        {Array.from({ length: count }).map((_, i) => {
          const n = i + 1;
          return (
            <div key={n}>
              <EditorDivider label={`Coluna ${n}`} />
              <EditorField label="Título">
                <EditorInput value={get(`col${n}Title`)} onChange={set(`col${n}Title`)} placeholder={`Título ${n}`} />
              </EditorField>
              <EditorField label="Texto">
                <EditorTextarea value={get(`col${n}Text`)} onChange={set(`col${n}Text`)} placeholder="Conteúdo da coluna" rows={2} />
              </EditorField>
              <div className="grid grid-cols-2 gap-2">
                <EditorField label="Botão texto">
                  <EditorInput value={get(`col${n}BtnText`)} onChange={set(`col${n}BtnText`)} placeholder="Ex: Ver mais" />
                </EditorField>
                <EditorField label="Botão link">
                  <EditorInput value={get(`col${n}BtnUrl`)} onChange={set(`col${n}BtnUrl`)} placeholder="https://" />
                </EditorField>
              </div>
            </div>
          );
        })}
      </>
    );
  }

  if (block.type === "map") return (
    <>
      <EditorField label="Endereço"><EditorInput value={get("address")} onChange={set("address")} placeholder="Rua, número, cidade" /></EditorField>
      <EditorField label="Zoom">
        <EditorSelect value={get("zoom")} onChange={set("zoom")} options={[{ label: "Bairro (12)", value: "12" }, { label: "Rua (14)", value: "14" }, { label: "Edifício (16)", value: "16" }]} />
      </EditorField>
    </>
  );

  if (block.type === "form") return (
    <>
      <EditorField label="Assunto padrão"><EditorInput value={get("subject")} onChange={set("subject")} placeholder="Ex: Contato" /></EditorField>
      <EditorField label="Campos" hint="separados por vírgula"><EditorInput value={get("fields")} onChange={set("fields")} placeholder="name,email,message" /></EditorField>
    </>
  );

  if (block.type === "divider") return (
    <>
      <EditorField label="Estilo">
        <EditorSelect value={get("style")} onChange={set("style")} options={[{ label: "Linha", value: "line" }, { label: "Tracejado", value: "dashed" }, { label: "Espaço vazio", value: "space" }]} />
      </EditorField>
      <EditorField label="Espaçamento">
        <EditorSelect value={get("spacing")} onChange={set("spacing")} options={[{ label: "Pequeno", value: "sm" }, { label: "Médio", value: "md" }, { label: "Grande", value: "lg" }]} />
      </EditorField>
    </>
  );

  return <p className="text-xs text-slate-400">Configurações do bloco "{block.label}" disponíveis em breve.</p>;
}
