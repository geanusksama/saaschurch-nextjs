import { Search, Filter, Download, Eye, Edit, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../design-system/components/Badge';

const transactions = [
  {
    id: 1,
    date: '2024-03-15',
    description: 'Dízimo - João Silva',
    category: 'Dízimos',
    type: 'income',
    amount: 500.00,
    method: 'PIX',
    status: 'completed',
    reference: 'DIZ-2024-001'
  },
  {
    id: 2,
    date: '2024-03-15',
    description: 'Oferta Culto Domingo',
    category: 'Ofertas',
    type: 'income',
    amount: 1250.00,
    method: 'Dinheiro',
    status: 'completed',
    reference: 'OFR-2024-045'
  },
  {
    id: 3,
    date: '2024-03-14',
    description: 'Conta de Luz',
    category: 'Infraestrutura',
    type: 'expense',
    amount: 850.00,
    method: 'Transferência',
    status: 'completed',
    reference: 'DSP-2024-032'
  },
  {
    id: 4,
    date: '2024-03-14',
    description: 'Dízimo - Maria Santos',
    category: 'Dízimos',
    type: 'income',
    amount: 750.00,
    method: 'Cartão de Crédito',
    status: 'completed',
    reference: 'DIZ-2024-002'
  },
  {
    id: 5,
    date: '2024-03-13',
    description: 'Salário - Pastor Carlos',
    category: 'Salários',
    type: 'expense',
    amount: 5500.00,
    method: 'Transferência',
    status: 'completed',
    reference: 'DSP-2024-031'
  },
  {
    id: 6,
    date: '2024-03-13',
    description: 'Oferta Missionária',
    category: 'Missões',
    type: 'income',
    amount: 2300.00,
    method: 'PIX',
    status: 'completed',
    reference: 'OFR-2024-046'
  },
  {
    id: 7,
    date: '2024-03-12',
    description: 'Material de Limpeza',
    category: 'Infraestrutura',
    type: 'expense',
    amount: 320.00,
    method: 'Dinheiro',
    status: 'completed',
    reference: 'DSP-2024-030'
  },
  {
    id: 8,
    date: '2024-03-12',
    description: 'Evento - Congresso CIBE',
    category: 'Eventos',
    type: 'income',
    amount: 4500.00,
    method: 'Transferência',
    status: 'pending',
    reference: 'EVT-2024-012'
  },
];

export function FinanceTransactions() {
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  
  const filteredTransactions = filterType === 'all' 
    ? transactions 
    : transactions.filter(t => t.type === filterType);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Consulta de Lançamentos</h1>
            <p className="text-slate-600 dark:text-slate-400">Visualize todas as transações financeiras</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          <Download className="w-5 h-5" />
          Exportar
        </button>
      </div>

      {/* Summary */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Receitas</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Despesas</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Saldo</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="grid md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar transação..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <select className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option>Todas as Categorias</option>
            <option>Dízimos</option>
            <option>Ofertas</option>
            <option>Salários</option>
            <option>Infraestrutura</option>
            <option>Eventos</option>
          </select>
          <select className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option>Todas as Formas</option>
            <option>PIX</option>
            <option>Dinheiro</option>
            <option>Cartão de Crédito</option>
            <option>Transferência</option>
          </select>
          <input
            type="date"
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="date"
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterType === 'all'
              ? 'bg-purple-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Todas ({transactions.length})
        </button>
        <button
          onClick={() => setFilterType('income')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterType === 'income'
              ? 'bg-green-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Receitas ({transactions.filter(t => t.type === 'income').length})
        </button>
        <button
          onClick={() => setFilterType('expense')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterType === 'expense'
              ? 'bg-red-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Despesas ({transactions.filter(t => t.type === 'expense').length})
        </button>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Data</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Descrição</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Categoria</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Tipo</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Forma</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Valor</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Status</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {new Date(transaction.date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{transaction.description}</p>
                      <p className="text-xs text-slate-500">{transaction.reference}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{transaction.category}</td>
                  <td className="px-6 py-4">
                    {transaction.type === 'income' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <TrendingUp className="w-3 h-3" />
                        Receita
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        <TrendingDown className="w-3 h-3" />
                        Despesa
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{transaction.method}</td>
                  <td className="px-6 py-4">
                    <span className={`font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.type === 'income' ? '+' : '-'} R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={transaction.status === 'completed' ? 'completed' : 'pending'}>
                      {transaction.status === 'completed' ? 'Concluído' : 'Pendente'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1.5 hover:bg-blue-50 rounded transition-colors">
                        <Eye className="w-4 h-4 text-blue-600" />
                      </button>
                      <button className="p-1.5 hover:bg-purple-50 rounded transition-colors">
                        <Edit className="w-4 h-4 text-purple-600" />
                      </button>
                      <button className="p-1.5 hover:bg-red-50 rounded transition-colors">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
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
