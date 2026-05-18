import { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Plus, Pencil, Trash2, X, Bus, ParkingCircle, Train, Bike, Car, Navigation, Home, Info,
  type LucideIcon,
} from 'lucide-react';

type IconCfg = { value: string; label: string; Icon: LucideIcon; bg: string };

const ACCESS_ICONS: IconCfg[] = [
  { value: 'Bus',           label: 'Ônibus',           Icon: Bus,           bg: 'bg-blue-600'   },
  { value: 'ParkingCircle', label: 'Estacionamento',   Icon: ParkingCircle, bg: 'bg-green-600'  },
  { value: 'Train',         label: 'Metrô / Trem',     Icon: Train,         bg: 'bg-purple-700' },
  { value: 'Bike',          label: 'Ciclovia',         Icon: Bike,          bg: 'bg-amber-500'  },
  { value: 'Car',           label: 'Carro',            Icon: Car,           bg: 'bg-orange-500' },
  { value: 'Navigation',    label: 'A Pé',             Icon: Navigation,    bg: 'bg-teal-600'   },
  { value: 'MapPin',        label: 'Ponto de Refer.',  Icon: MapPin,        bg: 'bg-red-500'    },
  { value: 'Home',          label: 'Entrada',          Icon: Home,          bg: 'bg-slate-600'  },
  { value: 'Info',          label: 'Informação',       Icon: Info,          bg: 'bg-cyan-600'   },
];

function getIconCfg(value: string) {
  return ACCESS_ICONS.find(i => i.value === value) ?? ACCESS_ICONS[0];
}

type AccessInfo = { id: string; type: string; description: string; mapUrl: string | null; icon: string; order: number };

function getHQContext() {
  const token = localStorage.getItem('mrm_token') ?? '';
  const activeFieldId = localStorage.getItem('mrm_active_field_id') ||
    (() => { try { return JSON.parse(localStorage.getItem('mrm_user') ?? '{}').campoId; } catch { return ''; } })();
  return { token, activeFieldId };
}

export default function AppHQAccess() {
  const [hqId, setHqId] = useState('');
  const [items, setItems] = useState<AccessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AccessInfo | null>(null);
  const [form, setForm] = useState({ description: '', mapUrl: '', icon: 'Bus', type: 'bus', order: '0' });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const load = useCallback(async () => {
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
      const res = await fetch(`/api/headquarters/${id}/access`, { headers });
      if (!res.ok) throw new Error('Falha ao carregar como chegar.');
      setItems(await res.json());
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erro ao carregar.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ description: '', mapUrl: '', icon: 'Bus', type: 'bus', order: '0' });
    setFormErr('');
    setModalOpen(true);
  };
  const openEdit = (a: AccessInfo) => {
    setEditing(a);
    setForm({ description: a.description, mapUrl: a.mapUrl ?? '', icon: a.icon, type: a.type, order: String(a.order) });
    setFormErr('');
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.description.trim()) { setFormErr('Descrição é obrigatória.'); return; }
    setSaving(true); setFormErr('');
    try {
      const { token } = getHQContext();
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const body = { type: form.type, description: form.description, mapUrl: form.mapUrl || null, icon: form.icon, order: Number(form.order) || 0 };
      if (editing) {
        const res = await fetch(`/api/headquarters/access/${editing.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(`/api/headquarters/${hqId}/access`, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
      }
      setModalOpen(false);
      await load();
    } catch (e: unknown) { setFormErr((e as Error).message ?? 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('Remover esta instrução de acesso?')) return;
    const { token } = getHQContext();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    await fetch(`/api/headquarters/access/${id}`, { method: 'DELETE', headers });
    await load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
            <MapPin className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Como Chegar</h1>
            <p className="text-slate-500 dark:text-slate-400">Instruções de acesso e transporte para a sede</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> Nova Instrução
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">{error}</div>}

      {loading ? (
        <div className="text-center py-16 text-slate-400">Carregando instruções...</div>
      ) : items.length === 0 && !error ? (
        <div className="text-center py-16">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Nenhuma instrução de acesso cadastrada</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">Adicionar Instrução</button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.sort((a, b) => a.order - b.order).map(item => {
            const ic = getIconCfg(item.icon);
            const Ic = ic.Icon;
            return (
              <div key={item.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ic.bg}`}>
                  <Ic className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white text-sm">{item.description}</p>
                  {item.mapUrl && (
                    <a href={item.mapUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-teal-600 dark:text-teal-400 hover:underline mt-0.5 block truncate">
                      Ver no Google Maps →
                    </a>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => del(item.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? 'Editar' : 'Nova'} Instrução de Acesso</h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            {formErr && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{formErr}</p>}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Descrição *</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ex: Linha 4040 para o Terminal Central"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Link do Google Maps (opcional)</label>
                <input type="url" value={form.mapUrl} onChange={e => setForm(f => ({ ...f, mapUrl: e.target.value }))}
                  placeholder="https://maps.app.goo.gl/..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Ícone</label>
                <div className="grid grid-cols-9 gap-1.5">
                  {ACCESS_ICONS.map(ic => {
                    const Ic = ic.Icon;
                    const sel = form.icon === ic.value;
                    return (
                      <button key={ic.value} type="button" onClick={() => setForm(f => ({ ...f, icon: ic.value, type: ic.value.toLowerCase() }))}
                        title={ic.label}
                        className={`flex flex-col items-center p-1 rounded-lg border transition ${sel ? 'border-teal-500 ring-2 ring-teal-300 dark:ring-teal-700' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600'}`}>
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
                <button onClick={save} disabled={saving} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
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
