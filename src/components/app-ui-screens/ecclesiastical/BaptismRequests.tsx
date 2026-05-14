import { useState } from 'react';
import { Droplet, Search, Plus, Calendar, User } from 'lucide-react';
import { Link } from 'react-router';

const requests = [
  { id: 1, name: 'Carlos Eduardo Silva', date: '2024-03-20', status: 'pending', classes: 3 },
  { id: 2, name: 'Ana Paula Santos', date: '2024-03-20', status: 'approved', classes: 4 },
  { id: 3, name: 'Roberto Oliveira', date: '2024-04-15', status: 'pending', classes: 2 },
  { id: 4, name: 'Juliana Mendes', date: '2024-04-15', status: 'in-progress', classes: 3 },
];

export default function BaptismRequests() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Droplet className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pedidos de Batismo</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie os candidatos ao batismo</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Total de Pedidos</p>
          <p className="text-2xl font-bold text-slate-900">{requests.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Pendentes</p>
          <p className="text-2xl font-bold text-orange-600">
            {requests.filter(r => r.status === 'pending').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Aprovados</p>
          <p className="text-2xl font-bold text-green-600">
            {requests.filter(r => r.status === 'approved').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-1">Em Andamento</p>
          <p className="text-2xl font-bold text-blue-600">
            {requests.filter(r => r.status === 'in-progress').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar candidatos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <Link to="/app-ui/ecclesiastical/baptism/new" className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            <Plus className="w-5 h-5" />
            Novo Pedido
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Candidato</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Data Prevista</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Aulas</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {requests.map((request) => (
              <tr key={request.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="font-medium text-slate-900">{request.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(request.date).toLocaleDateString('pt-BR')}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">{request.classes}/4 concluídas</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    request.status === 'approved' ? 'bg-green-100 text-green-700' :
                    request.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {request.status === 'approved' ? 'Aprovado' :
                     request.status === 'pending' ? 'Pendente' : 'Em Andamento'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <Link to={`/app-ui/ecclesiastical/baptism/${request.id}`} className="text-purple-600 hover:text-purple-700 font-medium">
                    Ver Detalhes
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
