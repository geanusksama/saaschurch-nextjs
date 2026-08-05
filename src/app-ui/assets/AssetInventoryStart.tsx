import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ClipboardList, Loader2, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';

type Church = { id: string; name: string; code?: string | null; currentLeaderName?: string | null };

export default function AssetInventoryStart() {
  const navigate = useNavigate();
  const token = localStorage.getItem('mrm_token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; } })();
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || currentUser.campoId || '';

  const [churches, setChurches] = useState<Church[]>([]);
  const [churchId, setChurchId] = useState(currentUser.churchId || '');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fieldQuery = activeFieldId ? `?fieldId=${encodeURIComponent(activeFieldId)}` : '';
    fetch(`${apiBase}/churches${fieldQuery}`, { headers: authHeaders })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setChurches(Array.isArray(data) ? data : data.data || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFieldId]);

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
      navigate(`/app-ui/asset-inventories/${data.id}/scan`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message || 'Falha ao iniciar inventário.');
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto text-slate-900 dark:text-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
          <ClipboardList className="w-6 h-6 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Iniciar Inventário de Patrimônio</h1>
          <p className="text-slate-600 dark:text-slate-400">Confira os bens cadastrados fisicamente na igreja</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Calendar className="w-4 h-4" />
          {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} às {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">Igreja / Campo</label>
          <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800">
            <option value="">Selecione...</option>
            {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {selectedChurch && (
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm">
            <User className="w-4 h-4 text-slate-500" />
            <span className="text-slate-600 dark:text-slate-400">Dirigente:</span>
            <span className="font-semibold">{selectedChurch.currentLeaderName || 'Não informado'}</span>
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={starting || !churchId}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-semibold disabled:opacity-50"
        >
          {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
          {starting ? 'Iniciando...' : 'Iniciar Inventário'}
        </button>
      </div>
    </div>
  );
}
