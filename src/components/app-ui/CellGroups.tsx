import { useEffect, useState } from 'react';
import { Plus, Search, Filter, Users, MapPin, Calendar, TrendingUp, User, Phone, Network } from 'lucide-react';
import { Link } from 'react-router';
import { apiBase } from '../../lib/apiBase';

export function CellGroups() {
  const [cells, setCells] = useState([]);
  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const token = localStorage.getItem('mrm_token');
        const headers = { Authorization: `Bearer ${token}` };

        const [cellsRes, reportsRes] = await Promise.all([
          fetch(`${apiBase}/cell-groups`, { headers }).then(r => r.json()),
          fetch(`${apiBase}/cell-reports`, { headers }).then(r => r.json())
        ]);

        if (Array.isArray(cellsRes)) setCells(cellsRes);
        if (Array.isArray(reportsRes)) setRecentReports(reportsRes);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalMembers = cells.reduce((sum, cell) => sum + (cell._count?.members || 0), 0);
  
  const filteredCells = cells.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.leader?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (loading) {
    return <div className="p-6 text-slate-600">Carregando GFs...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
            <Network className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">GF (Grupos Familiares)</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie grupos e acompanhe crescimento</p>
          </div>
        </div>
        <Link 
          to="/app-ui/cells/new"
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo GF
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total de GFs</p>
              <p className="text-2xl font-bold text-slate-900">{cells.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Membros em GFs</p>
              <p className="text-2xl font-bold text-slate-900">{totalMembers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Crescimento Mensal</p>
              <p className="text-2xl font-bold text-slate-900">+15%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Reuniões Esta Semana</p>
              <p className="text-2xl font-bold text-slate-900">{cells.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Cells List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Lista de GFs</h2>
              <button className="p-2 hover:bg-slate-100 rounded-lg">
                <Filter className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar GFs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {filteredCells.map((cell) => (
                <Link
                  key={cell.id}
                  to={`/app-ui/cells/${cell.id}`}
                  className="block border border-slate-200 rounded-lg p-4 hover:border-purple-300 hover:bg-slate-50 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center text-white font-semibold">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{cell.name}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Líder: {cell.leader?.fullName || 'Não definido'}</p>
                        <p className="text-xs text-slate-500 mt-1">{cell.leader?.mobile || cell.leader?.phone || ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                      <TrendingUp className="w-4 h-4" />
                      0%
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Users className="w-4 h-4" />
                      <span>{cell._count?.members || 0} membros</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-4 h-4" />
                      <span>{cell.meetingDay || '-'} {cell.meetingTime ? new Date(cell.meetingTime).toISOString().slice(11, 16) : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="w-4 h-4" />
                      <span>{cell.address || cell.description || '-'}</span>
                    </div>
                  </div>
                </Link>
              ))}
              {filteredCells.length === 0 && (
                <p className="text-slate-500 text-center py-4">Nenhum GF encontrado.</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Reports */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Relatórios Recentes</h2>
          </div>
          <div className="p-6 space-y-4">
            {recentReports.slice(0, 5).map((report) => (
              <div key={report.id} className="border border-slate-200 rounded-lg p-4">
                <div className="font-semibold text-slate-900 mb-2">{report.cellGroup?.name}</div>
                <div className="text-sm text-slate-600 mb-3">
                  {new Date(report.meetingDate).toLocaleDateString('pt-BR')}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Presença:</span>
                    <span className="font-semibold text-slate-900">{report.attendanceCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Visitantes:</span>
                    <span className="font-semibold text-blue-600">{report.visitorsCount}</span>
                  </div>
                </div>
              </div>
            ))}
            {recentReports.length === 0 && (
              <p className="text-slate-500 text-center py-4">Nenhum relatório recente.</p>
            )}

            <Link 
              to="/app-ui/cells/reports"
              className="w-full py-3 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center"
            >
              Ver Todos os Relatórios
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}