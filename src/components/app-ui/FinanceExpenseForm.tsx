import { ArrowLeft, Minus, AlertCircle } from 'lucide-react';
import { Link } from 'react-router';
import { useState } from 'react';
import { AlertDialog } from './shared/ConfirmDialog';

export function FinanceExpenseForm() {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: '',
    paymentMethod: '',
    supplier: '',
    notes: '',
    attachReceipt: false
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
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lançar Despesa</h1>
            <p className="text-slate-600 dark:text-slate-400">Registrar nova saída financeira</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="bg-white rounded-xl border border-slate-200 p-8 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Informações da Despesa</h2>
          
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
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Ex: Conta de Luz - Março/2024"
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
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
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
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
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
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Selecione...</option>
                <option value="salarios">Salários</option>
                <option value="infraestrutura">Infraestrutura</option>
                <option value="eventos">Eventos</option>
                <option value="comunicacao">Comunicação</option>
                <option value="missoes">Missões</option>
                <option value="manutencao">Manutenção</option>
                <option value="impostos">Impostos e Taxas</option>
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
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
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

            {/* Supplier */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Fornecedor/Beneficiário
              </label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Nome do fornecedor ou beneficiário"
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
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Adicione observações sobre esta despesa..."
              />
            </div>

            {/* Attach Receipt */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.attachReceipt}
                  onChange={(e) => setFormData({ ...formData, attachReceipt: e.target.checked })}
                  className="w-4 h-4 rounded text-red-600 focus:ring-2 focus:ring-red-500"
                />
                <span className="text-sm text-slate-700">Anexar comprovante/nota fiscal</span>
              </label>
            </div>

            {formData.attachReceipt && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Arquivo
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="text-xs text-slate-500 mt-1">Formatos aceitos: PDF, JPG, PNG (máx. 5MB)</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            <Minus className="w-5 h-5" />
            Lançar Despesa
          </button>
          <Link
            to="/app-ui/finance"
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Cancelar
          </Link>
        </div>
      </form>

      {/* Alert */}
      <div className="mt-8 max-w-4xl bg-amber-50 rounded-xl border border-amber-200 p-6">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-amber-900 mb-2">⚠️ Importante</h3>
            <ul className="space-y-1 text-sm text-amber-800">
              <li>• Sempre anexe comprovantes para despesas acima de R$ 500,00</li>
              <li>• Verifique se a despesa está dentro do orçamento aprovado</li>
              <li>• Pagamentos recorrentes podem ser configurados como automáticos</li>
            </ul>
          </div>
        </div>
      </div>

      <AlertDialog
        open={successOpen}
        title="Despesa lançada"
        message="A despesa foi registrada com sucesso."
        variant="success"
        onClose={() => setSuccessOpen(false)}
      />
    </div>
  );
}
