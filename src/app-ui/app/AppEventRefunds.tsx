import { useState } from 'react';
import { RefreshCcw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  SOLICITADO: { label: 'Solicitado', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  APROVADO:   { label: 'Aprovado',   color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   icon: CheckCircle2 },
  NEGADO:     { label: 'Negado',     color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           icon: XCircle },
  PROCESSADO: { label: 'Processado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       icon: CheckCircle2 },
};

type Refund = {
  id: string; motivo: string; valor_solicitado: number;
  status: string; notas_admin: string; created_at: string;
  event_orders?: { numero_pedido: string; buyer_name: string };
  app_events?: { church_id: string };
};

export default function AppEventRefunds() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Refund | null>(null);
  const [nota, setNota] = useState('');
  const user = getStoredUser();
  const churchId: string | undefined = user.churchId;

  const { data: refunds = [], isLoading } = useQuery({
    queryKey: ['app-refunds', churchId],
    queryFn: async () => {
      // event_refunds tem event_id -> app_events (que tem church_id)
      let query = supabase
        .from('event_refunds')
        .select('id, motivo, valor_solicitado, status, notas_admin, created_at, event_orders(numero_pedido, buyer_name), app_events!inner(church_id)')
        .order('created_at', { ascending: false });
      if (churchId) query = (query as ReturnType<typeof query.eq>).eq('app_events.church_id', churchId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Refund[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notas_admin }: { id: string; status: string; notas_admin: string }) => {
      const { error } = await supabase.from('event_refunds').update({
        status,
        notas_admin: notas_admin || null,
        processed_at: status !== 'SOLICITADO' ? new Date().toISOString() : null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-refunds'] });
      setSelected(null);
      setNota('');
    },
  });

  const openRefund = (r: Refund) => {
    setSelected(r);
    setNota(r.notas_admin ?? '');
  };

  const pending = refunds.filter(r => r.status === 'SOLICITADO');
  const others = refunds.filter(r => r.status !== 'SOLICITADO');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
          <RefreshCcw className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fila de Reembolsos</h1>
          <p className="text-slate-500 dark:text-slate-400">Solicitações de reembolso dos compradores</p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-sm text-yellow-800 dark:text-yellow-300">
          <strong>{pending.length}</strong> solicitação(ões) pendente(s) de análise.
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Carregando reembolsos...</div>
      ) : refunds.length === 0 ? (
        <div className="text-center py-16">
          <RefreshCcw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Nenhuma solicitação de reembolso</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...pending, ...others].map(r => {
            const s = STATUS_LABELS[r.status] ?? { label: r.status, color: 'bg-slate-100 text-slate-600', icon: Clock };
            const StatusIcon = s.icon;
            return (
              <div key={r.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${s.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {s.label}
                    </span>
                    <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {r.event_orders?.buyer_name ?? 'Comprador'} — <span className="font-mono text-xs">{r.event_orders?.numero_pedido}</span>
                  </p>
                  {r.motivo && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{r.motivo}</p>}
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">R$ {Number(r.valor_solicitado).toFixed(2)}</p>
                </div>
                {r.status === 'SOLICITADO' && (
                  <button onClick={() => openRefund(r)} className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 shrink-0">
                    Analisar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Analisar Reembolso</h2>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-slate-500">Pedido</dt>
                <dd className="font-mono text-xs text-slate-900 dark:text-white">{selected.event_orders?.numero_pedido}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Valor</dt>
                <dd className="font-bold text-slate-900 dark:text-white">R$ {Number(selected.valor_solicitado).toFixed(2)}</dd>
              </div>
              {selected.motivo && (
                <div>
                  <dt className="text-slate-500 mb-1">Motivo</dt>
                  <dd className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 rounded p-2 text-xs">{selected.motivo}</dd>
                </div>
              )}
            </dl>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notas do Admin</label>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3}
                placeholder="Observações sobre a decisão..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setSelected(null); setNota(''); }} className="flex-1 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={() => updateMutation.mutate({ id: selected.id, status: 'NEGADO', notas_admin: nota })}
                disabled={updateMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Negar
              </button>
              <button
                onClick={() => updateMutation.mutate({ id: selected.id, status: 'APROVADO', notas_admin: nota })}
                disabled={updateMutation.isPending}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Aprovar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
