import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Plus, Pencil, Trash2, X, Sun, Moon, BookOpen, Zap, Flame, Heart,
  Users, Star, Globe, Music2, Sparkles, Gift,
  type LucideIcon,
} from 'lucide-react';

const DAYS = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

type IconCfg = { value: string; label: string; Icon: LucideIcon; bg: string };

const SCHEDULE_ICONS: IconCfg[] = [
  { value: 'Sun',      label: 'Culto / Adoração',     Icon: Sun,      bg: 'bg-orange-400' },
  { value: 'Sun2',     label: 'Culto da Manhã',        Icon: Sun,      bg: 'bg-green-500'  },
  { value: 'Moon',     label: 'Culto Noturno',         Icon: Moon,     bg: 'bg-indigo-700' },
  { value: 'BookOpen', label: 'EBD / Escola Bíblica',  Icon: BookOpen, bg: 'bg-yellow-500' },
  { value: 'Zap',      label: 'Evangelístico',         Icon: Zap,      bg: 'bg-blue-600'   },
  { value: 'Flame',    label: 'Libertação',            Icon: Flame,    bg: 'bg-pink-600'   },
  { value: 'Heart',    label: 'Doutrina / Pastoral',   Icon: Heart,    bg: 'bg-purple-700' },
  { value: 'Users',    label: 'Reunião / Encontro',    Icon: Users,    bg: 'bg-teal-500'   },
  { value: 'Star',     label: 'Culto Especial',        Icon: Star,     bg: 'bg-amber-500'  },
  { value: 'Globe',    label: 'Missões',               Icon: Globe,    bg: 'bg-cyan-600'   },
  { value: 'Music2',   label: 'Louvor',                Icon: Music2,   bg: 'bg-rose-500'   },
  { value: 'Sparkles', label: 'Consagração',           Icon: Sparkles, bg: 'bg-violet-600' },
  { value: 'Gift',     label: 'Ofertório',             Icon: Gift,     bg: 'bg-emerald-600'},
];

function getIconCfg(value: string) {
  return SCHEDULE_ICONS.find(i => i.value === value) ?? SCHEDULE_ICONS[0];
}

type Schedule = { id: string; dayOfWeek: string; name: string; time: string; icon: string; order: number };

function getHQContext() {
  const token = localStorage.getItem('mrm_token') ?? '';
  const activeFieldId = localStorage.getItem('mrm_active_field_id') ||
    (() => { try { return JSON.parse(localStorage.getItem('mrm_user') ?? '{}').campoId; } catch { return ''; } })();
  return { token, activeFieldId };
}

export default function AppHQSchedule() {
  const [hqId, setHqId] = useState('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState({ dayOfWeek: 'Domingo', name: '', time: '', icon: 'Sun', order: '0' });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const loadHQ = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { token, activeFieldId } = getHQContext();
      if (!activeFieldId) throw new Error('Nenhum campo ativo. Faça login novamente.');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const hqRes = await fetch(`/api/headquarters?fieldId=${activeFieldId}`, { headers });
      if (!hqRes.ok) throw new Error('Sem permissão para ver a sede.');
      const hqList = await hqRes.json();
      if (!hqList.length) throw new Error('Nenhuma sede cadastrada para este campo.');
      const id = hqList[0].id;
      setHqId(id);
      const schRes = await fetch(`/api/headquarters/${id}/schedule`, { headers });
      if (!schRes.ok) throw new Error('Falha ao carregar programação.');
      setSchedules(await schRes.json());
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erro ao carregar.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadHQ(); }, [loadHQ]);

  const openNew = () => {
    setEditing(null);
    setForm({ dayOfWeek: 'Domingo', name: '', time: '', icon: 'Sun', order: '0' });
    setFormErr('');
    setModalOpen(true);
  };
  const openEdit = (s: Schedule) => {
    setEditing(s);
    setForm({ dayOfWeek: s.dayOfWeek, name: s.name, time: s.time, icon: s.icon, order: String(s.order) });
    setFormErr('');
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.time.trim()) { setFormErr('Nome e horário são obrigatórios.'); return; }
    setSaving(true); setFormErr('');
    try {
      const { token } = getHQContext();
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const body = { dayOfWeek: form.dayOfWeek, name: form.name, time: form.time, icon: form.icon, order: Number(form.order) || 0 };
      if (editing) {
        const res = await fetch(`/api/headquarters/schedule/${editing.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(`/api/headquarters/${hqId}/schedule`, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
      }
      setModalOpen(false);
      await loadHQ();
    } catch (e: unknown) { setFormErr((e as Error).message ?? 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('Remover esta programação?')) return;
    const { token } = getHQContext();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    await fetch(`/api/headquarters/schedule/${id}`, { method: 'DELETE', headers });
    await loadHQ();
  };

  const byDay = DAYS.map(day => ({ day, items: schedules.filter(s => s.dayOfWeek === day) })).filter(g => g.items.length > 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Programação da Igreja</h1>
            <p className="text-slate-500 dark:text-slate-400">Horários dos cultos e eventos semanais</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> Nova Programação
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">{error}</div>}

      {loading ? (
        <div className="text-center py-16 text-slate-400">Carregando programação...</div>
      ) : schedules.length === 0 && !error ? (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Nenhuma programação cadastrada</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Adicionar Programação</button>
        </div>
      ) : (
        <div className="space-y-4">
          {byDay.map(({ day, items }) => (
            <div key={day} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{day}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.sort((a, b) => a.order - b.order).map(s => {
                  const ic = getIconCfg(s.icon);
                  const Ico = ic.Icon;
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ic.bg}`}>
                        <Ico className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white text-sm">{s.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{s.time}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => del(s.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {/* days with no items yet */}
          {schedules.length > 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-600 text-center">Use + Nova Programação para adicionar mais horários</p>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? 'Editar' : 'Nova'} Programação</h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            {formErr && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{formErr}</p>}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Dia da semana *</label>
                  <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white">
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Horário *</label>
                  <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nome do culto *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Culto da Manhã"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Ícone</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {SCHEDULE_ICONS.map(ic => {
                    const Ic = ic.Icon;
                    const sel = form.icon === ic.value;
                    return (
                      <button key={ic.value} type="button" onClick={() => setForm(f => ({ ...f, icon: ic.value }))}
                        title={ic.label}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition ${sel ? 'border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600'}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ic.bg}`}>
                          <Ic className="w-4 h-4 text-white" />
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-1">{getIconCfg(form.icon).label}</p>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                <button onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
