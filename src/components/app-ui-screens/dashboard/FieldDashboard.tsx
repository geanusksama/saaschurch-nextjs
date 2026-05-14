import { Building2, Church, Users, DollarSign, TrendingUp, TrendingDown, BarChart3, Map } from 'lucide-react';

// Mock data para Campo (múltiplas regionais)
const regionais = [
  { id: 1, name: 'Regional Sul', churches: 45, members: 12500, growth: 8.5, offering: 450000 },
  { id: 2, name: 'Regional Norte', churches: 38, members: 9800, growth: 12.3, offering: 380000 },
  { id: 3, name: 'Regional Leste', churches: 42, members: 11200, growth: 6.7, offering: 420000 },
  { id: 4, name: 'Regional Oeste', churches: 35, members: 8900, growth: -2.1, offering: 350000 },
  { id: 5, name: 'Regional Centro', churches: 52, members: 15300, growth: 10.2, offering: 520000 },
];

export default function FieldDashboard() {
  const totalChurches = regionais.reduce((sum, r) => sum + r.churches, 0);
  const totalMembers = regionais.reduce((sum, r) => sum + r.members, 0);
  const totalOffering = regionais.reduce((sum, r) => sum + r.offering, 0);
  const avgGrowth = regionais.reduce((sum, r) => sum + r.growth, 0) / regionais.length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Map className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard de Campo</h1>
            <p className="text-slate-600 dark:text-slate-400">Visão consolidada de todas as regionais</p>
          </div>
        </div>
      </div>

      {/* KPIs Consolidados */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Total de Regionais</p>
            <Building2 className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{regionais.length}</p>
          <p className="text-xs text-slate-500 mt-1">5 regionais ativas</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Total de Igrejas</p>
            <Church className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalChurches}</p>
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            +{avgGrowth.toFixed(1)}% este mês
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Total de Membros</p>
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalMembers.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            +{avgGrowth.toFixed(1)}% este mês
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Ofertas Totais</p>
            <DollarSign className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            R$ {(totalOffering / 1000).toFixed(0)}k
          </p>
          <p className="text-xs text-slate-500 mt-1">Mês atual</p>
        </div>
      </div>

      {/* Tabela de Regionais */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Regionais</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Performance de cada regional</p>
            </div>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Regional</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Igrejas</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Membros</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Crescimento</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Ofertas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {regionais.map((regional) => (
                <tr key={regional.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{regional.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-slate-900">{regional.churches}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-slate-900">
                      {regional.members.toLocaleString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                      regional.growth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {regional.growth >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {regional.growth >= 0 ? '+' : ''}{regional.growth}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-slate-900">
                      R$ {(regional.offering / 1000).toFixed(0)}k
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
