import { useState } from 'react';
import { ShoppingCart, Search, Eye, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  AGUARDANDO_PAGAMENTO: { label: 'Aguardando',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  PAGO:                 { label: 'Pago',         color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  CANCELADO:            { label: 'Cancelado',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  REEMBOLSADO:          { label: 'Reembolsado',  color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  EXPIRADO:             { label: 'Expirado',     color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' },
};

type Order = {
  id: string; numero_pedido: string; buyer_name: string; buyer_email: string;
  total: number; status: string; created_at: string;
  app_events?: { nome: string };
};

export default function AppEventOrders() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const user = getStoredUser();
  const churchId: string | undefined = user.churchId;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['app-orders', churchId],
    queryFn: async () => {
      // Filtrar pedidos pelos eventos da igreja atual
      let query = supabase
        .from('event_orders')
        .select('id, numero_pedido, buyer_name, buyer_email, total, status, created_at, app_events!inner(nome, church_id)')
        .order('created_at', { ascending: false });
      if (churchId) query = (query as ReturnType<typeof query.eq>).eq('app_events.church_id', churchId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.numero_pedido.toLowerCase().includes(search.toLowerCase()) ||
      (o.buyer_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (o.buyer_email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
          <ShoppingCart className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pedidos</h1>
          <p className="text-slate-500 dark:text-slate-400">Gerenciamento de pedidos de ingressos</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, nome ou email..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Carregando pedidos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Pedido</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Comprador</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Evento</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Total</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Data</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const s = STATUS_LABELS[o.status] ?? { label: o.status, color: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={o.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{o.numero_pedido}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-white">{o.buyer_name}</p>
                      <p className="text-xs text-slate-500">{o.buyer_email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{o.app_events?.nome ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">R$ {Number(o.total).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(o.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(o)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="Ver detalhes">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Detalhes do Pedido</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Número</dt>
                <dd className="font-mono text-slate-900 dark:text-white">{selected.numero_pedido}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Comprador</dt>
                <dd className="text-slate-900 dark:text-white">{selected.buyer_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Email</dt>
                <dd className="text-slate-900 dark:text-white">{selected.buyer_email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Total</dt>
                <dd className="font-bold text-slate-900 dark:text-white">R$ {Number(selected.total).toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Status</dt>
                <dd><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(STATUS_LABELS[selected.status] ?? { color: '' }).color}`}>{(STATUS_LABELS[selected.status] ?? { label: selected.status }).label}</span></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Data</dt>
                <dd className="text-slate-900 dark:text-white">{new Date(selected.created_at).toLocaleString('pt-BR')}</dd>
              </div>
            </dl>
            <button onClick={() => setSelected(null)} className="mt-6 w-full py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
