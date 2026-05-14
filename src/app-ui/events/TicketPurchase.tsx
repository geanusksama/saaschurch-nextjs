import { ShoppingCart, CreditCard, Ticket, User, Mail, Phone } from 'lucide-react';
import { useState } from 'react';

export default function TicketPurchase() {
  const [quantity, setQuantity] = useState(1);
  const price = 150;

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Comprar Ingresso</h1>
            <p className="text-slate-600 dark:text-slate-400">Conferência CIBE 2024</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 text-xl mb-4">Dados Pessoais</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nome Completo</label>
                <input type="text" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                  <input type="email" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Telefone</label>
                  <input type="tel" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 text-xl mb-4">Quantidade</h2>
            <div className="flex items-center gap-4">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 bg-slate-200 rounded-lg hover:bg-slate-300 font-bold">-</button>
              <span className="text-2xl font-bold text-slate-900">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 bg-slate-200 rounded-lg hover:bg-slate-300 font-bold">+</button>
              <span className="text-slate-600">× R$ {price.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 text-xl mb-4">Pagamento</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Número do Cartão</label>
                <input type="text" placeholder="0000 0000 0000 0000" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Validade</label>
                  <input type="text" placeholder="MM/AA" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">CVV</label>
                  <input type="text" placeholder="123" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 sticky top-6">
            <h2 className="font-bold text-slate-900 text-xl mb-4">Resumo</h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-slate-600">
                <span>Ingressos ({quantity}x)</span>
                <span>R$ {(price * quantity).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxa de serviço</span>
                <span>R$ {(price * quantity * 0.05).toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between">
                <span className="font-bold text-slate-900">Total</span>
                <span className="font-bold text-purple-600 text-xl">R$ {(price * quantity * 1.05).toFixed(2)}</span>
              </div>
            </div>
            <button className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all">
              Finalizar Compra
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
