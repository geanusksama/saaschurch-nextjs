import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ClipboardList, Plus, RefreshCw, PlayCircle, FileCheck } from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
import { AssetInventoryStartModal } from './AssetInventoryStartModal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InventoryRow = any;

export default function AssetInventoryList() {
  const token = localStorage.getItem('mrm_token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const [inventories, setInventories] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showStart, setShowStart] = useState(false);

  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; } })();
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || currentUser.campoId || '';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const fieldQuery = activeFieldId ? `?campoId=${encodeURIComponent(activeFieldId)}` : '';
      const res = await fetch(`${apiBase}/asset-inventories${fieldQuery}`, { headers: authHeaders });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Erro ${res.status}`); }
      setInventories(await res.json());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message || 'Falha ao carregar inventários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const inProgress = inventories.filter((i) => i.status === 'in_progress');
  const completed = inventories.filter((i) => i.status !== 'in_progress');

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inventários de Patrimônio</h1>
            <p className="text-slate-600 dark:text-slate-400">Confira em andamento ou veja o histórico já finalizado</p>
          </div>
        </div>
        <button
          onClick={() => setShowStart(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Iniciar novo inventário
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => load()} className="flex items-center gap-1 text-red-600 hover:text-red-800 font-medium">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400">Carregando...</div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-amber-600 mb-3">Em andamento ({inProgress.length})</h2>
            {inProgress.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-sm text-slate-400 text-center">
                Nenhum inventário em andamento no momento.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {inProgress.map((inv) => (
                  <Link
                    key={inv.id}
                    to={`/app-ui/asset-inventories/${inv.id}/scan`}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Em andamento</span>
                      <PlayCircle className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{inv.church?.name || '—'}</p>
                    <p className="text-xs text-slate-500 mt-1">Iniciado em {new Date(inv.startedAt).toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-slate-500">Dirigente: {inv.leaderName || '—'}</p>
                    <p className="text-xs text-slate-500">Por: {inv.startedByUser?.fullName || '—'} · {inv._count?.items ?? 0} conferido(s)</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Finalizados ({completed.length})</h2>
            {completed.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-sm text-slate-400 text-center">
                Nenhum inventário finalizado ainda.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {completed.map((inv) => (
                  <Link
                    key={inv.id}
                    to={`/app-ui/asset-inventories/${inv.id}/report`}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Finalizado</span>
                      <FileCheck className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{inv.church?.name || '—'}</p>
                    <p className="text-xs text-slate-500 mt-1">Concluído em {inv.finishedAt ? new Date(inv.finishedAt).toLocaleString('pt-BR') : '—'}</p>
                    <p className="text-xs text-slate-500">Dirigente: {inv.leaderName || '—'}</p>
                    <p className="text-xs text-slate-500">{inv._count?.items ?? 0} item(ns) conferido(s)</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {showStart && <AssetInventoryStartModal onClose={() => setShowStart(false)} />}
    </div>
  );
}
