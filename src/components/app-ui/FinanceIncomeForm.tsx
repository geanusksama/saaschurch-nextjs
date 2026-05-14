import { ArrowLeft, Plus, DollarSign } from 'lucide-react';
import { Link } from 'react-router';
import { useState } from 'react';
import { AlertDialog } from './shared/ConfirmDialog';

export function FinanceIncomeForm() {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: '',
    paymentMethod: '',
    member: '',
    notes: ''
  });
  const [successOpen, setSuccessOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessOpen(true);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lançar Receita</h1>
            <p className="text-slate-600 dark:text-slate-400">Registrar nova entrada financeira</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="bg-white rounded-xl border border-slate-200 p-8 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Informações da Receita</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Descrição <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Ex: Dízimo - João Silva"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Valor <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Data <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Categoria <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Selecione...</option>
                <option value="dizimos">Dízimos</option>
                <option value="ofertas">Ofertas</option>
                <option value="doacoes">Doações</option>
                <option value="eventos">Eventos</option>
                <option value="missoes">Missões</option>
                <option value="outros">Outros</option>
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Forma de Pagamento <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Selecione...</option>
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Cartão de Débito</option>
                <option value="credito">Cartão de Crédito</option>
                <option value="transferencia">Transferência Bancária</option>
                <option value="boleto">Boleto</option>
              </select>
            </div>

            {/* Member */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Membro (Opcional)
              </label>
              <input
                type="text"
                value={formData.member}
                onChange={(e) => setFormData({ ...formData, member: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Buscar membro..."
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Observações
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Adicione observações sobre esta receita..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Lançar Receita
          </button>
          <Link
            to="/app-ui/finance"
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Cancelar
          </Link>
        </div>
      </form>

      {/* Quick Tips */}
      <div className="mt-8 max-w-4xl bg-green-50 rounded-xl border border-green-200 p-6">
        <h3 className="font-bold text-green-900 mb-3">💡 Dicas Rápidas</h3>
        <ul className="space-y-2 text-sm text-green-800">
          <li>• Dízimos devem ser cadastrados com o nome do membro para controle</li>
          <li>• Ofertas de cultos podem ser lançadas em lote ao final do dia</li>
          <li>• Use a categoria "Missões" para separar ofertas missionárias</li>
          <li>• Adicione o número do recibo nas observações para rastreamento</li>
        </ul>
      </div>

      <AlertDialog
        open={successOpen}
        title="Receita lançada"
        message="A receita foi registrada com sucesso."
        variant="success"
        onClose={() => setSuccessOpen(false)}
      />
    </div>
  );
}
