import { Database, Search, Filter, Download, User, Calendar, Clock, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiBase } from '../../../lib/apiBase';

export function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>({
    totalActions: 0,
    todayActions: 0,
    activeUsers: 0,
    lastBackupTime: '3h',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Protect client side: only master level is allowed
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('mrm_user') || '{}');
    } catch {
      return {};
    }
  })();

  const isMaster = storedUser.profileType === 'master';

  useEffect(() => {
    if (!isMaster) return;

    let active = true;
    const fetchLogs = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('mrm_token');
        const response = await fetch(
          `${apiBase}/audit-logs?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(searchTerm)}&type=${filterType}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!response.ok) {
          throw new Error('Falha ao buscar logs de auditoria no servidor.');
        }
        const data = await response.json();
        if (active) {
          setLogs(data.data || []);
          setTotal(data.total || 0);
          if (data.stats) {
            setStats(data.stats);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar dados.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    // Debounce search input changes slightly
    const delayDebounceFn = setTimeout(() => {
      fetchLogs();
    }, searchTerm ? 400 : 0);

    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [page, searchTerm, filterType, isMaster]);

  // Reset page when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterType]);

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('mrm_token');
      // Fetch matching logs with high limit for export
      const response = await fetch(
        `${apiBase}/audit-logs?limit=5000&search=${encodeURIComponent(searchTerm)}&type=${filterType}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!response.ok) throw new Error("Erro ao obter logs para exportação.");
      const payload = await response.json();
      const logsToExport = payload.data || [];

      // Format as CSV (comma separated values)
      const headers = ["Data/Hora", "Usuario", "Acao", "Recurso", "IP", "Tipo"];
      const rows = logsToExport.map((log: any) => [
        new Date(log.createdAt).toLocaleString('pt-BR'),
        log.user?.fullName || "Sistema",
        log.description || "",
        log.entityType || "",
        log.ipAddress || "",
        log.action === "create" ? "Criacao" :
        log.action === "update" ? "Atualizacao" :
        log.action === "delete" ? "Exclusao" :
        log.action === "read" ? "Leitura" :
        log.action === "auth" ? "Auth" : "Sistema"
      ]);

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((row: any) => row.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      alert("Falha ao exportar os logs: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    }
  };

  if (!isMaster) {
    return (
      <div className="p-8 text-center min-h-[50vh] flex flex-col justify-center items-center gap-4">
        <AlertTriangle className="w-16 h-16 text-red-500" />
        <h2 className="text-2xl font-bold text-slate-900">Acesso Restrito</h2>
        <p className="text-slate-600 max-w-md">Somente usuários de nível Master possuem privilégios para acessar os logs de auditoria do sistema.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Log de Auditoria</h1>
        <p className="text-slate-600 dark:text-slate-400">Histórico completo de ações no sistema</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total de Ações</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalActions?.toLocaleString('pt-BR') || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Usuários Ativos</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.activeUsers || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Hoje</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.todayActions || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <Database className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Último Backup</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.lastBackupTime || '3h'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por usuário, ação ou recurso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex gap-3">
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todas as Ações</option>
              <option value="create">Criação</option>
              <option value="update">Atualização</option>
              <option value="delete">Exclusão</option>
              <option value="read">Leitura</option>
              <option value="auth">Autenticação</option>
              <option value="system">Sistema</option>
            </select>

            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold"
            >
              <Download className="w-5 h-5" />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col justify-center items-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            <span className="text-sm text-slate-500 dark:text-slate-400">Carregando logs...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col justify-center items-center py-20 text-red-500 gap-2">
            <AlertTriangle className="w-8 h-8" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-20 text-slate-500 gap-2">
            <FileText className="w-8 h-8 text-slate-400" />
            <span className="text-sm">Nenhum registro encontrado.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">Data/Hora</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">Usuário</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">Ação</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">Recurso</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">IP</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                          {(log.user?.fullName || "Sistema").split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">{log.user?.fullName || "Sistema"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-100">{log.description}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{log.entityType || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">{log.ipAddress || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        log.action === 'create' ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300' :
                        log.action === 'update' ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300' :
                        log.action === 'delete' ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300' :
                        log.action === 'read' ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300' :
                        log.action === 'auth' ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {log.action === 'create' ? 'Criação' :
                         log.action === 'update' ? 'Atualização' :
                         log.action === 'delete' ? 'Exclusão' :
                         log.action === 'read' ? 'Leitura' :
                         log.action === 'auth' ? 'Auth' :
                         log.action === 'system' ? 'Sistema' : log.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && !error && logs.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Mostrando {logs.length} de {total} registros
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:pointer-events-none text-sm font-semibold"
              >
                Anterior
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none text-sm font-semibold"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
