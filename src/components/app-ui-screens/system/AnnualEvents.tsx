import { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, X, CalendarDays, Clock, MapPin,
  Tag, ChevronLeft, ChevronRight, Eye, EyeOff, Check, Save,
  AlertCircle, RefreshCw,
} from "lucide-react";

import { apiBase as API } from "../../lib/apiBase";

// ─── Mobile-app icon set for tbeventos ────────────────────────────────────────
type EventIconKey =
  | "favorite" | "groups" | "terrain" | "public" | "music_note"
  | "star" | "nightlife" | "auto_awesome" | "celebration" | "event";

interface IconCfg {
  label: string;
  emoji: string;
  bg: string;
}

const ICON_MAP: Record<EventIconKey, IconCfg> = {
  favorite:     { label: "Favorito",     emoji: "❤️",  bg: "bg-rose-500" },
  groups:       { label: "Grupos",       emoji: "👥",  bg: "bg-indigo-500" },
  terrain:      { label: "Terreno",      emoji: "⛰️",  bg: "bg-emerald-600" },
  public:       { label: "Público",      emoji: "🌐",  bg: "bg-sky-500" },
  music_note:   { label: "Música",       emoji: "🎵",  bg: "bg-purple-500" },
  star:         { label: "Destaque",     emoji: "⭐",  bg: "bg-amber-500" },
  nightlife:    { label: "Noite",        emoji: "🌙",  bg: "bg-violet-600" },
  auto_awesome: { label: "Especial",     emoji: "✨",  bg: "bg-pink-500" },
  celebration:  { label: "Celebração",   emoji: "🎉",  bg: "bg-orange-500" },
  event:        { label: "Evento",       emoji: "📅",  bg: "bg-blue-600" },
};

const ALL_ICON_KEYS = Object.keys(ICON_MAP) as EventIconKey[];

function IconBadge({ iconName, size = "md" }: { iconName?: string | null; size?: "sm" | "md" | "lg" }) {
  const key = (iconName || "event") as EventIconKey;
  const cfg = ICON_MAP[key] || ICON_MAP.event;
  const sizeClass = size === "sm" ? "h-8 w-8 text-base" : size === "lg" ? "h-12 w-12 text-2xl" : "h-10 w-10 text-xl";
  return (
    <div className={`relative flex ${sizeClass} flex-shrink-0 items-center justify-center rounded-xl ${cfg.bg} overflow-hidden shadow-md`}>
      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
      <span className="relative z-10 drop-shadow">{cfg.emoji}</span>
    </div>
  );
}

function IconPicker({ value, onChange, onClose }: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold text-slate-800 dark:text-white">Escolher ícone</span>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {ALL_ICON_KEYS.map((k) => {
            const cfg = ICON_MAP[k];
            return (
              <button
                key={k}
                onClick={() => { onChange(k); onClose(); }}
                title={cfg.label}
                className={`relative flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-xl ${cfg.bg} overflow-hidden shadow transition-transform hover:scale-105 ${value === k ? "ring-2 ring-white ring-offset-1" : ""}`}
              >
                <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                <span className="relative z-10 text-lg">{cfg.emoji}</span>
                <span className="relative z-10 text-[9px] text-white/90 font-medium leading-none">{cfg.label}</span>
                {value === k && (
                  <Check className="absolute top-0.5 right-0.5 h-3 w-3 text-white drop-shadow z-20" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TbEvento {
  id: string;
  evento: string;
  datareal: string;
  dia: number;
  mes: string;
  ano: number;
  diaSemana?: string;
  horario?: string;
  local?: string;
  obs?: string;
  ministerio?: string;
  departamento?: string;
  mostrar: boolean;
  reservar: boolean;
  tipo: string;
  preco: number;
  iconName?: string;
  audienceScope: string;
}

const EMPTY_FORM = {
  evento: "",
  datareal: "",
  horario: "",
  local: "",
  obs: "",
  ministerio: "",
  departamento: "",
  tipo: "gratuito",
  preco: 0,
  mostrar: true,
  reservar: false,
  iconName: "event",
  audienceScope: "headquarters",
};

// ─── Component ────────────────────────────────────────────────────────────────

const labelClass = "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400";
const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-700";

const MONTHS_PT = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function AnnualEvents() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [events, setEvents] = useState<TbEvento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TbEvento | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Icon picker
  const [showIconPicker, setShowIconPicker] = useState(false);

  const token = localStorage.getItem("mrm_token") || "";
  const fieldId = localStorage.getItem("mrm_active_field_id") || "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fieldId) params.set("campoId", fieldId);
      params.set("year", String(year));
      const res = await fetch(`${API}/annual-events?${params}`, { headers });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setEvents(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [year, fieldId, token]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setShowModal(true);
  }

  function openEdit(ev: TbEvento) {
    setEditing(ev);
    setForm({
      evento: ev.evento,
      datareal: ev.datareal?.slice(0, 10) || "",
      horario: ev.horario || "",
      local: ev.local || "",
      obs: ev.obs || "",
      ministerio: ev.ministerio || "",
      departamento: ev.departamento || "",
      tipo: ev.tipo || "gratuito",
      preco: ev.preco || 0,
      mostrar: ev.mostrar,
      reservar: ev.reservar,
      iconName: ev.iconName || "event",
      audienceScope: ev.audienceScope || "headquarters",
    });
    setFormError(null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.evento.trim()) { setFormError("Nome do evento é obrigatório"); return; }
    if (!form.datareal) { setFormError("Data é obrigatória"); return; }
    if (!fieldId) { setFormError("Nenhum campo ativo selecionado"); return; }

    setSaving(true);
    setFormError(null);
    try {
      const body = { ...form, campoId: fieldId };
      let res: Response;
      if (editing) {
        res = await fetch(`${API}/annual-events/${editing.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${API}/annual-events`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erro ${res.status}`);
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await fetch(`${API}/annual-events/${id}`, { method: "DELETE", headers });
      setConfirmDeleteId(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  // Group by month
  const grouped = events.reduce<Record<string, TbEvento[]>>((acc, ev) => {
    const key = ev.mes || "?";
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  const monthOrder = MONTHS_PT.filter((m) => m && grouped[m]);

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Programação Anual
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Agenda de eventos do campo para o ano
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          Novo Evento
        </button>
      </div>

      {/* Year selector */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[64px] text-center text-lg font-bold text-slate-900 dark:text-white">
          {year}
        </span>
        <button
          onClick={() => setYear((y) => y + 1)}
          className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={load}
          className="ml-2 rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          title="Recarregar"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        <span className="ml-2 text-sm text-slate-500">
          {events.length} evento{events.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Empty */}
      {!loading && events.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400">
            Nenhum evento para {year}.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Adicionar o primeiro evento
          </button>
        </div>
      )}

      {/* Grouped by month */}
      {!loading && monthOrder.length > 0 && (
        <div className="space-y-6">
          {monthOrder.map((month) => (
            <div key={month}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {month}
              </h2>
              <div className="space-y-2">
                {grouped[month].map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
                  >
                    {/* Icon */}
                    <IconBadge iconName={ev.iconName} size="md" />

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`font-semibold text-slate-900 dark:text-white ${!ev.mostrar ? "opacity-50" : ""}`}>
                            {ev.evento}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {ev.diaSemana ? `${ev.diaSemana}, ` : ""}
                              {ev.dia}/{MONTHS_PT.indexOf(ev.mes).toString().padStart(2, "0")}
                            </span>
                            {ev.horario && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {ev.horario}
                              </span>
                            )}
                            {ev.local && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {ev.local}
                              </span>
                            )}
                            {ev.ministerio && (
                              <span className="flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                {ev.ministerio}
                              </span>
                            )}
                          </div>
                          {ev.obs && (
                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 line-clamp-2">
                              {ev.obs}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-shrink-0 items-center gap-1">
                          {!ev.mostrar && (
                            <span title="Oculto" className="rounded-full border border-slate-200 p-1 text-slate-400">
                              <EyeOff className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <button
                            onClick={() => openEdit(ev)}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 dark:border-slate-700 dark:hover:bg-slate-800"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(ev.id)}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:hover:bg-red-950"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ev.tipo === "pago" && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                            Pago • R$ {Number(ev.preco).toFixed(2)}
                          </span>
                        )}
                        {ev.reservar && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                            Reserva
                          </span>
                        )}
                        {ev.departamento && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {ev.departamento}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Create / Edit Modal ────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                {editing ? "Editar Evento" : "Novo Evento"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              {/* Icon + Name */}
              <div>
                <label className={labelClass}>Ícone e Nome do Evento *</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(true)}
                    title="Escolher ícone"
                    className="flex-shrink-0 transition-transform hover:scale-110"
                  >
                    <IconBadge iconName={form.iconName} size="lg" />
                  </button>
                  <input
                    className={inputClass}
                    placeholder="Nome do evento"
                    value={form.evento}
                    onChange={(e) => setForm((p) => ({ ...p, evento: e.target.value }))}
                  />
                </div>
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Data *</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.datareal}
                    onChange={(e) => setForm((p) => ({ ...p, datareal: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Horário</label>
                  <input
                    className={inputClass}
                    placeholder="ex: 19h30"
                    value={form.horario}
                    onChange={(e) => setForm((p) => ({ ...p, horario: e.target.value }))}
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className={labelClass}>Local</label>
                <input
                  className={inputClass}
                  placeholder="Local do evento"
                  value={form.local}
                  onChange={(e) => setForm((p) => ({ ...p, local: e.target.value }))}
                />
              </div>

              {/* Ministry + Department */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Ministério</label>
                  <input
                    className={inputClass}
                    placeholder="ex: Louvor"
                    value={form.ministerio}
                    onChange={(e) => setForm((p) => ({ ...p, ministerio: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Departamento</label>
                  <input
                    className={inputClass}
                    placeholder="ex: Jovens"
                    value={form.departamento}
                    onChange={(e) => setForm((p) => ({ ...p, departamento: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelClass}>Observações</label>
                <textarea
                  className={inputClass + " resize-none"}
                  rows={2}
                  placeholder="Detalhes adicionais..."
                  value={form.obs}
                  onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))}
                />
              </div>

              {/* Tipo / Preço */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Tipo</label>
                  <select
                    className={inputClass}
                    value={form.tipo}
                    onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                  >
                    <option value="gratuito">Gratuito</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                {form.tipo === "pago" && (
                  <div>
                    <label className={labelClass}>Preço (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputClass}
                      value={form.preco}
                      onChange={(e) => setForm((p) => ({ ...p, preco: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                )}
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-6">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <div
                    onClick={() => setForm((p) => ({ ...p, mostrar: !p.mostrar }))}
                    className={`relative h-5 w-9 rounded-full transition-colors ${form.mostrar ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.mostrar ? "translate-x-4" : ""}`} />
                  </div>
                  <span className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                    {form.mostrar ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {form.mostrar ? "Visível" : "Oculto"}
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <div
                    onClick={() => setForm((p) => ({ ...p, reservar: !p.reservar }))}
                    className={`relative h-5 w-9 rounded-full transition-colors ${form.reservar ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.reservar ? "translate-x-4" : ""}`} />
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">Permite Reserva</span>
                </label>
              </div>
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm ─────────────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">Excluir evento?</h3>
            <p className="mb-5 text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deleting}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Icon Picker ────────────────────────────────────────────────────── */}
      {showIconPicker && (
        <IconPicker
          value={form.iconName || "event"}
          onChange={(v) => setForm((p) => ({ ...p, iconName: v }))}
          onClose={() => setShowIconPicker(false)}
        />
      )}
    </div>
  );
}
