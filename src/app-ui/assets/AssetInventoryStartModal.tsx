import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ClipboardList, Loader2, User, Calendar, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';
import { hasFixedChurchScope } from './churchScope';

type Church = { id: string; name: string; code?: string | null; currentLeaderName?: string | null };

interface Props {
  onClose: () => void;
}

export function AssetInventoryStartModal({ onClose }: Props) {
  const navigate = useNavigate();
  const token = localStorage.getItem('mrm_token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; } })();
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || currentUser.campoId || '';
  const fixedChurch = hasFixedChurchScope(currentUser);

  const [churches, setChurches] = useState<Church[]>([]);
  const [churchId, setChurchId] = useState(currentUser.churchId || '');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [now] = useState(new Date());

  useEffect(() => {
    const fieldQuery = activeFieldId ? `?fieldId=${encodeURIComponent(activeFieldId)}` : '';
    fetch(`${apiBase}/churches${fieldQuery}`, { headers: authHeaders })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setChurches(Array.isArray(data) ? data : data.data || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedChurch = churches.find((c) => c.id === churchId);

  async function handleStart() {
    if (!churchId) { setError('Selecione a igreja/campo onde o inventário será feito.'); return; }
    setStarting(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/asset-inventories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ churchId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao iniciar inventário.');
      toast.success('Inventário iniciado!');
      onClose();
      navigate(`/app-ui/asset-inventories/${data.id}/scan`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message || 'Falha ao iniciar inventário.');
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Iniciar Inventário</h2>
              <p className="text-sm text-slate-500">Confira os bens cadastrados fisicamente na igreja</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}

          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Calendar className="w-4 h-4" />
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} às {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Igreja / Campo</label>
            {fixedChurch ? (
              <div className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {selectedChurch?.name || 'Sua igreja'}
              </div>
            ) : (
              <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800">
                <option value="">Selecione...</option>
                {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>

          {selectedChurch && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm">
              <User className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600 dark:text-slate-400">Dirigente:</span>
              <span className="font-semibold">{selectedChurch.currentLeaderName || 'Não informado'}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800">Cancelar</button>
          <button
            onClick={handleStart}
            disabled={starting || !churchId}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-semibold disabled:opacity-50"
          >
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
            {starting ? 'Iniciando...' : 'Iniciar Inventário'}
          </button>
        </div>
      </div>
    </div>
  );
}
