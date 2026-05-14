import { ArrowRightLeft, Search, Plus, Building2 } from 'lucide-react';
import { Link } from 'react-router';

const transfers = [
  { id: 1, member: 'João Silva', from: 'Igreja Central', to: 'Igreja Norte', status: 'pending', date: '2024-03-15' },
  { id: 2, member: 'Maria Santos', from: 'Igreja Sul', to: 'Igreja Central', status: 'approved', date: '2024-03-10' },
  { id: 3, member: 'Carlos Oliveira', from: 'Igreja Leste', to: 'Igreja Oeste', status: 'completed', date: '2024-03-05' },
];

export default function TransferRequests() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transferências de Igreja</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie transferências entre igrejas</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {[
          { label: 'Pendentes', value: transfers.filter(t => t.status === 'pending').length, color: 'text-orange-600' },
          { label: 'Aprovadas', value: transfers.filter(t => t.status === 'approved').length, color: 'text-green-600' },
          { label: 'Concluídas', value: transfers.filter(t => t.status === 'completed').length, color: 'text-blue-600' }
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
            <p className="text-sm text-slate-600 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="Buscar transferências..." className="w-full pl-11 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <Link to="/app-ui/ecclesiastical/transfer/new" className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
            <Plus className="w-5 h-5" />Nova Transferência
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Membro', 'De', 'Para', 'Data', 'Status', 'Ações'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">{transfer.member}</td>
                <td className="px-6 py-4 text-slate-600">{transfer.from}</td>
                <td className="px-6 py-4 text-slate-600">{transfer.to}</td>
                <td className="px-6 py-4 text-slate-600">{new Date(transfer.date).toLocaleDateString('pt-BR')}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    transfer.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    transfer.status === 'approved' ? 'bg-green-100 text-green-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {transfer.status === 'completed' ? 'Concluída' : transfer.status === 'approved' ? 'Aprovada' : 'Pendente'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <Link to={`/app-ui/ecclesiastical/transfer/${transfer.id}`} className="text-purple-600 hover:text-purple-700 font-medium">Ver</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
