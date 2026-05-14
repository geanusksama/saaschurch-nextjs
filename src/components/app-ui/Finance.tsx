import { DollarSign, TrendingUp, TrendingDown, Calendar, Download, Plus, Filter } from 'lucide-react';
import { Link } from 'react-router';
import { financialTransactions } from '../../data/mockData';

export function Finance() {
  const totalReceita = financialTransactions
    .filter(t => t.type === 'Receita')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalDespesa = financialTransactions
    .filter(t => t.type === 'Despesa')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const saldo = totalReceita - totalDespesa;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Financeiro</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie receitas, despesas e tesouraria</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 border border-slate-200 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
            <Download className="w-5 h-5" />
            Exportar
          </button>
          <Link
            to="/app-ui/finance/new"
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nova Transação
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Receitas</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Despesas</p>
              <p className="text-2xl font-bold text-red-600">
                R$ {totalDespesa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Saldo</p>
              <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Transações</p>
              <p className="text-2xl font-bold text-slate-900">{financialTransactions.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Transações Recentes</h2>
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm">
              <Filter className="w-4 h-4" />
              Filtrar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Data</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Descrição</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Categoria</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Método</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Igreja</th>
                <th className="text-right px-6 py-3 text-sm font-semibold text-slate-900">Valor</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-slate-900">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {financialTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(transaction.date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{transaction.description}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                      {transaction.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {transaction.method}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {transaction.church}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-semibold ${
                      transaction.type === 'Receita' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'Receita' ? '+' : '-'} R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      transaction.status === 'Confirmado' || transaction.status === 'Pago' 
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {transaction.status}
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