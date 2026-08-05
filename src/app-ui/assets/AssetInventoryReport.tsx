import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { FileCheck, Loader2, CheckCircle2, XCircle, AlertTriangle, Printer, Share2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';
import { printReport } from '../../lib/printReport';

export default function AssetInventoryReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('mrm_token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [observation, setObservation] = useState('');
  const [finishing, setFinishing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/asset-inventories/${id}`, { headers: authHeaders });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao carregar inventário.');
      setData(json);
      setObservation(json.inventory.observation || '');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message || 'Falha ao carregar inventário.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function handleFinish() {
    setFinishing(true);
    try {
      const res = await fetch(`${apiBase}/asset-inventories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ observation }),
      });
      if (!res.ok) throw new Error('Falha ao finalizar inventário.');
      toast.success('Inventário finalizado!');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao finalizar.');
    } finally {
      setFinishing(false);
    }
  }

  function handlePrint() {
    if (!data) return;
    const rows = [
      ...data.items.map((i: any) => ({
        codigo: i.asset.code, nome: i.asset.name, setor: i.asset.sector || '—',
        situacao: i.locationMatch ? 'Encontrado no local' : `Encontrado em: ${i.locationFound || '—'}`,
        observacao: i.observation || '—',
      })),
      ...data.missing.map((a: any) => ({ codigo: a.code, nome: a.name, setor: a.sector || '—', situacao: 'NÃO ENCONTRADO', observacao: '—' })),
    ];
    printReport({
      title: 'Relatório de Inventário de Patrimônio',
      subtitle: `${data.inventory.church?.name || ''} · ${new Date(data.inventory.startedAt).toLocaleDateString('pt-BR')}`,
      orientation: 'landscape',
      columns: [
        { key: 'codigo', label: 'Código' }, { key: 'nome', label: 'Bem' }, { key: 'setor', label: 'Setor' },
        { key: 'situacao', label: 'Situação' }, { key: 'observacao', label: 'Observação' },
      ],
      rows,
    });
  }

  async function handleShare() {
    const text = `Inventário de Patrimônio — ${data.inventory.church?.name}\nEncontrados: ${data.totals.found}/${data.totals.expected}\nFaltando: ${data.totals.missing}\nDivergências: ${data.totals.divergent}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Relatório de Inventário', text }); } catch { /* cancelado */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Resumo copiado para a área de transferência.');
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (error || !data) return <div className="p-6 text-red-600">{error || 'Inventário não encontrado.'}</div>;

  const { inventory, items, missing, totals } = data;
  const isCompleted = inventory.status === 'completed';

  return (
    <div className="p-6 max-w-4xl mx-auto text-slate-900 dark:text-slate-100 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/app-ui/asset-inventories/${id}/scan`} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
            <FileCheck className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Relatório de Inventário</h1>
            <p className="text-sm text-slate-500">{inventory.church?.name} · {new Date(inventory.startedAt).toLocaleString('pt-BR')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700">
            <Share2 className="w-4 h-4" /> Compartilhar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="Esperados" value={totals.expected} color="text-slate-700" />
        <Stat label="Encontrados" value={totals.found} color="text-green-700" />
        <Stat label="Faltando" value={totals.missing} color="text-red-700" />
        <Stat label="Divergências" value={totals.divergent} color="text-amber-700" />
      </div>

      {missing.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2 text-red-700"><XCircle className="w-4 h-4" /> Não encontrados ({missing.length})</h3>
          <div className="space-y-1 text-sm max-h-56 overflow-y-auto">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {missing.map((a: any) => (
              <div key={a.id} className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1.5">
                <span>{a.name} <span className="text-slate-400 font-mono text-xs">({a.code})</span></span>
                <span className="text-slate-500">{a.sector || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2 text-green-700"><CheckCircle2 className="w-4 h-4" /> Encontrados ({items.length})</h3>
        <div className="space-y-1 text-sm max-h-56 overflow-y-auto">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {items.map((i: any) => (
            <div key={i.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 py-1.5">
              <span>{i.asset.name} <span className="text-slate-400 font-mono text-xs">({i.asset.code})</span></span>
              {i.locationMatch ? (
                <span className="text-green-600 text-xs">No local cadastrado</span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 text-xs"><AlertTriangle className="w-3 h-3" /> Encontrado em: {i.locationFound}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <label className="block text-sm font-semibold">Observação final do inventário</label>
        <textarea
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          disabled={isCompleted}
          rows={3}
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 disabled:opacity-60"
        />
        {isCompleted ? (
          <div className="flex items-center gap-2 text-green-700 font-semibold text-sm"><CheckCircle2 className="w-4 h-4" /> Inventário finalizado — pronto para imprimir ou compartilhar</div>
        ) : (
          <button onClick={handleFinish} disabled={finishing} className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-semibold disabled:opacity-50">
            {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Finalizar Inventário
          </button>
        )}
      </div>

      <button onClick={() => navigate('/app-ui/assets')} className="text-sm text-slate-500 hover:text-slate-800">← Voltar para Patrimônio</button>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-slate-500 uppercase font-semibold">{label}</p>
    </div>
  );
}
