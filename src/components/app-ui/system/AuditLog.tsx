import { Database, Search, Filter, Download, User, Calendar, Clock, FileText } from 'lucide-react';
import { useState } from 'react';

const auditLogs = [
  { id: 1, user: 'Ana Paula Silva', action: 'Criou novo membro', resource: 'Roberto Carlos Mendes', timestamp: '2024-03-15 14:32:15', ip: '192.168.1.10', type: 'create' },
  { id: 2, user: 'Carlos Eduardo Santos', action: 'Atualizou configurações', resource: 'Configurações de Email', timestamp: '2024-03-15 13:45:22', ip: '192.168.1.15', type: 'update' },
  { id: 3, user: 'Rafael Souza Lima', action: 'Deletou usuário', resource: 'Pedro Silva (ID: 145)', timestamp: '2024-03-15 12:18:05', ip: '192.168.1.22', type: 'delete' },
  { id: 4, user: 'Juliana Ferreira Rocha', action: 'Aprovou batismo', resource: 'Marcos Paulo Oliveira', timestamp: '2024-03-15 11:30:40', ip: '192.168.1.8', type: 'update' },
  { id: 5, user: 'Ana Paula Silva', action: 'Exportou relatório', resource: 'Relatório Financeiro - Fevereiro', timestamp: '2024-03-15 10:22:15', ip: '192.168.1.10', type: 'read' },
  { id: 6, user: 'Sistema', action: 'Backup automático', resource: 'Banco de dados completo', timestamp: '2024-03-15 03:00:00', ip: 'Sistema', type: 'system' },
  { id: 7, user: 'Carlos Eduardo Santos', action: 'Login realizado', resource: 'Dashboard Admin', timestamp: '2024-03-14 18:45:30', ip: '192.168.1.15', type: 'auth' },
  { id: 8, user: 'Rafael Souza Lima', action: 'Criou evento', resource: 'Culto CIBE - Abril 2025', timestamp: '2024-03-14 16:20:10', ip: '192.168.1.22', type: 'create' },
];

export function AuditLog() {
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = auditLogs.filter(log => {
    const matchesType = filterType === 'all' || log.type === filterType;
    const matchesSearch = log.user.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.resource.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Log de Auditoria</h1>
        <p className="text-slate-600 dark:text-slate-400">Histórico completo de ações no sistema</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total de Ações</p>
              <p className="text-2xl font-bold text-slate-900">1.247</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Usuários Ativos</p>
              <p className="text-2xl font-bold text-slate-900">24</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Hoje</p>
              <p className="text-2xl font-bold text-slate-900">42</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Database className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Último Backup</p>
              <p className="text-2xl font-bold text-slate-900">3h</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por usuário, ação ou recurso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex gap-3">
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todas as Ações</option>
              <option value="create">Criação</option>
              <option value="update">Atualização</option>
              <option value="delete">Exclusão</option>
              <option value="read">Leitura</option>
              <option value="auth">Autenticação</option>
              <option value="system">Sistema</option>
            </select>

            <button className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              <Download className="w-5 h-5" />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900">Data/Hora</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900">Usuário</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900">Ação</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900">Recurso</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900">IP</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4" />
                      {log.timestamp}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                        {log.user.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="font-medium text-slate-900">{log.user}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">{log.action}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{log.resource}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-mono">{log.ip}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      log.type === 'create' ? 'bg-green-100 text-green-700' :
                      log.type === 'update' ? 'bg-blue-100 text-blue-700' :
                      log.type === 'delete' ? 'bg-red-100 text-red-700' :
                      log.type === 'read' ? 'bg-purple-100 text-purple-700' :
                      log.type === 'auth' ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {log.type === 'create' ? 'Criação' :
                       log.type === 'update' ? 'Atualização' :
                       log.type === 'delete' ? 'Exclusão' :
                       log.type === 'read' ? 'Leitura' :
                       log.type === 'auth' ? 'Auth' :
                       'Sistema'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Mostrando {filteredLogs.length} de {auditLogs.length} registros
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">
              Anterior
            </button>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              Próximo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
