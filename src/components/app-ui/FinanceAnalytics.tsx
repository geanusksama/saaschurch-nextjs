import { TrendingUp, TrendingDown, DollarSign, PieChart, Download, Calendar } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const monthlyData = [
  { month: 'Jan', receita: 45000, despesa: 32000 },
  { month: 'Fev', receita: 52000, despesa: 28000 },
  { month: 'Mar', receita: 48000, despesa: 35000 },
  { month: 'Abr', receita: 61000, despesa: 31000 },
  { month: 'Mai', receita: 55000, despesa: 29000 },
  { month: 'Jun', receita: 67000, despesa: 34000 },
];

const categoryData = [
  { name: 'Dízimos', value: 180000, color: '#8b5cf6' },
  { name: 'Ofertas', value: 85000, color: '#3b82f6' },
  { name: 'Eventos', value: 45000, color: '#10b981' },
  { name: 'Doações', value: 32000, color: '#f59e0b' },
];

const expenseData = [
  { name: 'Salários', value: 95000, color: '#ef4444' },
  { name: 'Infraestrutura', value: 58000, color: '#f97316' },
  { name: 'Eventos', value: 32000, color: '#eab308' },
  { name: 'Comunicação', value: 15000, color: '#84cc16' },
  { name: 'Outros', value: 12000, color: '#6366f1' },
];

export function FinanceAnalytics() {
  const totalReceita = categoryData.reduce((sum, item) => sum + item.value, 0);
  const totalDespesa = expenseData.reduce((sum, item) => sum + item.value, 0);
  const saldo = totalReceita - totalDespesa;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Análises Financeiras</h1>
            <p className="text-slate-600 dark:text-slate-400">Relatórios e indicadores financeiros</p>
          </div>
        </div>
        <div className="flex gap-3">
          <select className="px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option>Últimos 6 meses</option>
            <option>Último ano</option>
            <option>Ano atual</option>
            <option>Personalizado</option>
          </select>
          <button className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            <Download className="w-5 h-5" />
            Exportar Relatório
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-xl p-6 border border-green-200 dark:border-green-800/40">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-green-600">+12.5%</span>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300 mb-1">Receita Total</p>
          <p className="text-2xl font-bold text-green-900 dark:text-green-100">
            R$ {totalReceita.toLocaleString('pt-BR')}
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 rounded-xl p-6 border border-red-200 dark:border-red-800/40">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-red-600">-3.2%</span>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300 mb-1">Despesa Total</p>
          <p className="text-2xl font-bold text-red-900 dark:text-red-100">
            R$ {totalDespesa.toLocaleString('pt-BR')}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800/40">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-blue-600">Positivo</span>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Saldo</p>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            R$ {saldo.toLocaleString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue vs Expense Trend */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Receita vs Despesa</h3>
            <Calendar className="w-5 h-5 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff', border: document.documentElement.classList.contains('dark') ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: '8px', color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#1e293b' }}
                formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
              />
              <Legend />
              <Line type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={3} name="Receita" />
              <Line type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={3} name="Despesa" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Comparison */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Comparativo Mensal</h3>
            <PieChart className="w-5 h-5 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff', border: document.documentElement.classList.contains('dark') ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: '8px', color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#1e293b' }}
                formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
              />
              <Legend />
              <Bar dataKey="receita" fill="#8b5cf6" name="Receita" radius={[8, 8, 0, 0]} />
              <Bar dataKey="despesa" fill="#3b82f6" name="Despesa" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Categories */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Receita por Categoria</h3>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`revenue-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {categoryData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    R$ {item.value.toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Expense Categories */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Despesa por Categoria</h3>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPieChart>
                  <Pie
                    data={expenseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expenseData.map((entry, index) => (
                      <Cell key={`expense-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {expenseData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    R$ {item.value.toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}