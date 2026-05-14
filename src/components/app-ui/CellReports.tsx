import { BarChart2, Search, Download, Printer } from 'lucide-react';
import { Calendar, Users, UserPlus, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiBase } from '../../lib/apiBase';

export function CellReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadReports() {
      try {
        const token = localStorage.getItem('mrm_token');
        const response = await fetch(`${apiBase}/cell-reports`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setReports(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, []);

  const filteredReports = reports.filter(r => 
    r.cellGroup?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.cellGroup?.leader?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAttendance = filteredReports.reduce((sum, r) => sum + (r.attendanceCount || 0), 0);
  const totalVisitors = filteredReports.reduce((sum, r) => sum + (r.visitorsCount || 0), 0);
  const totalConversions = filteredReports.reduce((sum, r) => sum + (r.conversionsCount || 0), 0);
  const totalOffering = filteredReports.reduce((sum, r) => sum + (Number(r.offeringAmount) || 0), 0);

  const handleExportCSV = () => {
    const headers = ['GF', 'Líder', 'Data', 'Presença', 'Visitantes', 'Conversões', 'Oferta'];
    const rows = filteredReports.map(r => [
      r.cellGroup?.name || '',
      r.cellGroup?.leader?.fullName || '',
      new Date(r.meetingDate).toLocaleDateString('pt-BR'),
      r.attendanceCount || 0,
      r.visitorsCount || 0,
      r.conversionsCount || 0,
      Number(r.offeringAmount || 0).toFixed(2)
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'relatorio_gfs.csv';
    link.click();
  };

  if (loading) {
    return <div className="p-6 text-slate-600">Carregando relatórios...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
            <BarChart2 className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Relatórios de GFs</h1>
            <p className="text-slate-600 dark:text-slate-400">Acompanhe os relatórios semanais dos GFs</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar GF ou Líder..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={handleExportCSV}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
            <button 
              onClick={() => window.print()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Presença Total</p>
              <p className="text-2xl font-bold text-slate-900">{totalAttendance}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Visitantes</p>
              <p className="text-2xl font-bold text-slate-900">{totalVisitors}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Conversões</p>
              <p className="text-2xl font-bold text-slate-900">{totalConversions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Ofertas</p>
              <p className="text-2xl font-bold text-slate-900">
                R$ {totalOffering.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Relatórios da Semana</h2>
          <span className="text-sm text-slate-500">{filteredReports.length} registros encontrados</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">GF</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Líder</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Data</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-slate-900">Presença</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-slate-900">Visitantes</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-slate-900">Conversões</th>
                <th className="text-right px-6 py-3 text-sm font-semibold text-slate-900">Oferta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredReports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{report.cellGroup?.name}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {report.cellGroup?.leader?.fullName || 'Não definido'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4" />
                      {new Date(report.meetingDate).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-semibold text-slate-900">{report.attendanceCount || 0}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-semibold text-blue-600">{report.visitorsCount || 0}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-semibold text-green-600">{report.conversionsCount || 0}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-slate-900">
                      R$ {Number(report.offeringAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-slate-500">
                    Nenhum relatório encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
