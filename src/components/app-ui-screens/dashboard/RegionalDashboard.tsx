import { Church, Users, DollarSign, TrendingUp, Calendar, Heart, Target } from 'lucide-react';

// Mock data para Regional (múltiplas igrejas)
const churches = [
  { id: 1, name: 'Igreja Central', city: 'São Paulo - SP', members: 850, growth: 12.5, offering: 45000, services: 4 },
  { id: 2, name: 'Igreja do Brooklin', city: 'São Paulo - SP', members: 420, growth: 8.3, offering: 28000, services: 3 },
  { id: 3, name: 'Igreja de Guarulhos', city: 'Guarulhos - SP', members: 380, growth: 15.2, offering: 22000, services: 3 },
  { id: 4, name: 'Igreja de Osasco', city: 'Osasco - SP', members: 290, growth: 6.7, offering: 18000, services: 2 },
  { id: 5, name: 'Igreja do Tatuapé', city: 'São Paulo - SP', members: 520, growth: 10.1, offering: 32000, services: 3 },
];

export default function RegionalDashboard() {
  const totalMembers = churches.reduce((sum, c) => sum + c.members, 0);
  const totalOffering = churches.reduce((sum, c) => sum + c.offering, 0);
  const avgGrowth = churches.reduce((sum, c) => sum + c.growth, 0) / churches.length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Church className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Regional</h1>
            <p className="text-slate-600 dark:text-slate-400">Regional Sul - São Paulo e Grande São Paulo</p>
          </div>
        </div>
      </div>

      {/* KPIs Consolidados */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Total de Igrejas</p>
            <Church className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{churches.length}</p>
          <p className="text-xs text-slate-500 mt-1">5 igrejas ativas</p>
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

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Média por Igreja</p>
            <Target className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {Math.round(totalMembers / churches.length)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Membros por igreja</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-5 h-5" />
            <p className="text-sm opacity-90">Cultos desta Semana</p>
          </div>
          <p className="text-2xl font-bold">
            {churches.reduce((sum, c) => sum + c.services, 0)}
          </p>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-5 h-5" />
            <p className="text-sm opacity-90">Visitas Pastorais</p>
          </div>
          <p className="text-2xl font-bold">34</p>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-5 h-5" />
            <p className="text-sm opacity-90">Novos Convertidos</p>
          </div>
          <p className="text-2xl font-bold">28</p>
        </div>
      </div>

      {/* Tabela de Igrejas */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Igrejas da Regional</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Performance de cada igreja</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Igreja</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Cidade</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Membros</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Crescimento</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Ofertas</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Cultos/Sem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {churches.map((church) => (
                <tr key={church.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Church className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{church.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{church.city}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-slate-900">{church.members}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-semibold">
                      <TrendingUp className="w-3 h-3" />
                      +{church.growth}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-slate-900">
                      R$ {(church.offering / 1000).toFixed(1)}k
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-slate-900">{church.services}</span>
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
