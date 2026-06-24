import { Database, Search, Filter, Download, User, Calendar, Clock, FileText, AlertTriangle, Loader2, X } from 'lucide-react';
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

  // Date Range state
  const now = new Date();
  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const initialStartDate = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const initialEndDate = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [startHour, setStartHour] = useState('00:00');
  const [endHour, setEndHour] = useState('23:59');
  
  // Selected log for detailed view
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

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
          `${apiBase}/audit-logs?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(searchTerm)}&type=${filterType}&startDate=${startDate}&endDate=${endDate}&startHour=${startHour}&endHour=${endHour}`,
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
  }, [page, searchTerm, filterType, startDate, endDate, startHour, endHour, isMaster]);

  // Reset page when search, filter, dates or hours change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterType, startDate, endDate, startHour, endHour]);

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('mrm_token');
      // Fetch matching logs with high limit for export
      const response = await fetch(
        `${apiBase}/audit-logs?limit=5000&search=${encodeURIComponent(searchTerm)}&type=${filterType}&startDate=${startDate}&endDate=${endDate}&startHour=${startHour}&endHour=${endHour}`,
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

  const renderChanges = (changes: any) => {
    if (!changes) return <span className="text-slate-400 italic">Sem dados detalhados para esta ação.</span>;

    // Recursive function to search for images
    const images: string[] = [];
    const extractImages = (obj: any) => {
      if (!obj) return;
      if (typeof obj === 'string') {
        if (obj.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(obj)) {
          images.push(obj);
        }
      } else if (typeof obj === 'object') {
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            extractImages(obj[key]);
          }
        }
      }
    };
    extractImages(changes);

    const isPrimitive = typeof changes !== 'object';
    if (isPrimitive) {
      return (
        <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-lg text-xs font-mono overflow-auto text-slate-800 dark:text-slate-200">
          {String(changes)}
        </pre>
      );
    }

    // Mask sensitive keys
    const sensitiveKeys = ['password', 'senha', 'token', 'secret', 'access_token', 'passwordConfirm'];
    
    // Flatten helper to show flat list of keys
    const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
      let result: Record<string, any> = {};
      for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (value instanceof Date) {
            result[newKey] = value.toISOString();
          } else {
            Object.assign(result, flattenObject(value, newKey));
          }
        } else {
          result[newKey] = value;
        }
      }
      return result;
    };

    const flatChanges = flattenObject(changes);

    return (
      <div className="space-y-4">
        {/* Render key-values */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-slate-700 dark:text-slate-350 text-xs">Campo</th>
                <th className="text-left px-4 py-2 font-semibold text-slate-700 dark:text-slate-350 text-xs">Valor / Dado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-xs">
              {Object.entries(flatChanges).map(([key, val]) => {
                const isSensitive = sensitiveKeys.some(sk => key.toLowerCase().includes(sk));
                let displayVal = isSensitive ? '••••••••' : String(val);
                
                const isBase64 = typeof val === 'string' && val.startsWith('data:image/');
                if (isBase64) {
                  displayVal = '[Imagem Base64]';
                } else if (displayVal.length > 250) {
                  displayVal = displayVal.substring(0, 250) + '...';
                }

                return (
                  <tr key={key} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 font-semibold text-purple-700 dark:text-purple-400 break-all">{key}</td>
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200 break-all">{displayVal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Render extracted images */}
        {images.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Imagens / Anexos Identificados:</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {images.map((img, idx) => (
                <div key={idx} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 flex flex-col group relative">
                  <a href={img} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors opacity-0 group-hover:opacity-100 z-10">
                    <Download className="w-4 h-4" />
                  </a>
                  <div className="aspect-square flex items-center justify-center overflow-hidden bg-white dark:bg-slate-900">
                    <img 
                      src={img} 
                      alt={`Anexo ${idx + 1}`} 
                      className="object-contain w-full h-full max-h-full transition-transform hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Imagem {idx + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible raw JSON */}
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 select-none py-1">
            Visualizar JSON Completo
          </summary>
          <pre className="mt-2 p-3 bg-slate-950 text-emerald-400 rounded-lg overflow-auto max-h-40 font-mono">
            {JSON.stringify(changes, null, 2)}
          </pre>
        </details>
      </div>
    );
  };

  const renderPagination = (position: 'top' | 'bottom') => {
    if (loading || error || logs.length === 0) return null;

    const classes = position === 'top' 
      ? "px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/20"
      : "px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3";

    return (
      <div className={classes}>
        <p className="text-sm text-slate-650 dark:text-slate-400">
          Mostrando <span className="font-semibold text-slate-900 dark:text-white">{(page - 1) * pageSize + 1}</span> a <span className="font-semibold text-slate-900 dark:text-white">{Math.min(page * pageSize, total)}</span> de <span className="font-semibold text-slate-900 dark:text-white">{total}</span> registros
        </p>
        <div className="flex flex-wrap gap-1.5 items-center">
          <button 
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-3 py-1.5 border border-slate-200 dark:border-slate-850 rounded-lg text-slate-700 dark:text-slate-350 hover:bg-slate-55 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold uppercase tracking-wider"
          >
            Primeira
          </button>
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-slate-200 dark:border-slate-850 rounded-lg text-slate-700 dark:text-slate-350 hover:bg-slate-55 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold uppercase tracking-wider"
          >
            Anterior
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400 px-1.5">
            Pág. <span className="font-semibold text-slate-900 dark:text-white">{page}</span> de {totalPages}
          </span>
          <button 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 bg-purple-650 hover:bg-purple-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold uppercase tracking-wider shadow-sm"
          >
            Próximo
          </button>
          <button 
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="px-3 py-1.5 border border-slate-200 dark:border-slate-850 rounded-lg text-slate-700 dark:text-slate-350 hover:bg-slate-55 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold uppercase tracking-wider"
          >
            Última
          </button>
        </div>
      </div>
    );
  };

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
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-center">
          <div className="relative xl:col-span-3">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por usuário, ação ou recurso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 xl:col-span-6">
            <div className="flex-1 flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Início:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
              <input
                type="time"
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
                className="px-2 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
            <div className="flex-1 flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Fim:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
              <input
                type="time"
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
                className="px-2 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 xl:col-span-3">
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="flex-1 px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
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
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-650 hover:bg-purple-705 text-white rounded-lg transition-colors font-semibold text-sm shadow-sm hover:shadow active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>Exportar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        
        {/* Pagination at the TOP */}
        {renderPagination('top')}

        {loading ? (
          <div className="flex flex-col justify-center items-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-purple-650 animate-spin" />
            <span className="text-sm text-slate-500 dark:text-slate-400">Carregando logs de auditoria...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col justify-center items-center py-20 text-red-500 gap-2">
            <AlertTriangle className="w-8 h-8" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-20 text-slate-500 gap-2">
            <FileText className="w-8 h-8 text-slate-400" />
            <span className="text-sm">Nenhum registro encontrado para o período/filtros selecionados.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">Data/Hora</th>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">Usuário</th>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">Ação</th>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">Recurso</th>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">IP</th>
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-350">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr 
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-slate-650 dark:text-slate-400">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm">
                          {(log.user?.fullName || "Sistema").split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white text-sm">{log.user?.fullName || "Sistema"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-200 max-w-xs truncate">{log.description}</td>
                    <td className="px-6 py-4 text-sm text-slate-650 dark:text-slate-400">{log.entityType || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-650 dark:text-slate-450 font-mono whitespace-nowrap">{log.ipAddress || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide ${
                        log.action === 'create' ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300' :
                        log.action === 'update' ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' :
                        log.action === 'delete' ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300' :
                        log.action === 'read' ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300' :
                        log.action === 'auth' ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-350'
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

        {/* Pagination at the BOTTOM */}
        {renderPagination('bottom')}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850/50 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Detalhes do Evento</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">ID: {selectedLog.id}</p>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-850 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-350 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* User and Info Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-900">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Usuário</span>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-purple-100 dark:bg-purple-950 rounded-full flex items-center justify-center text-purple-700 dark:text-purple-300 text-xs font-semibold">
                      {(selectedLog.user?.fullName || "Sistema").split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLog.user?.fullName || "Sistema"}</span>
                  </div>
                  {selectedLog.user?.email && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 pl-8">{selectedLog.user.email}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Data / Hora</span>
                  <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-350">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{new Date(selectedLog.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ação / Evento</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      selectedLog.action === 'create' ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300' :
                      selectedLog.action === 'update' ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300' :
                      selectedLog.action === 'delete' ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300' :
                      selectedLog.action === 'read' ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300' :
                      selectedLog.action === 'auth' ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300' :
                      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      {selectedLog.action === 'create' ? 'Criação' :
                       selectedLog.action === 'update' ? 'Atualização' :
                       selectedLog.action === 'delete' ? 'Exclusão' :
                       selectedLog.action === 'read' ? 'Leitura' :
                       selectedLog.action === 'auth' ? 'Autenticação' :
                       selectedLog.action === 'system' ? 'Sistema' : selectedLog.action}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Recurso / Entidade</span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-250">{selectedLog.entityType || "-"}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Endereço IP</span>
                  <p className="text-xs font-mono text-slate-655 dark:text-slate-450">{selectedLog.ipAddress || "-"}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">ID da Entidade Relacionada</span>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-450 break-all">{selectedLog.entityId || "Nenhum"}</p>
                </div>
              </div>

              {/* Description Detail */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-850 dark:text-slate-200">Descrição da Ação:</h4>
                <div className="p-4 bg-purple-50/30 dark:bg-purple-950/10 border border-purple-100/50 dark:border-purple-900/20 rounded-xl">
                  <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{selectedLog.description}</p>
                </div>
              </div>

              {/* User Agent */}
              {selectedLog.userAgent && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 select-none py-1">
                    Visualizar User-Agent (Navegador/Dispositivo)
                  </summary>
                  <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-950 rounded-lg text-slate-600 dark:text-slate-400 break-all font-mono">
                    {selectedLog.userAgent}
                  </div>
                </details>
              )}

              {/* Payload Changes */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-850 dark:text-slate-200">Dados do Registro / Alterações:</h4>
                {renderChanges(selectedLog.changes)}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition-all active:scale-98 shadow-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
