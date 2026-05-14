import { ArrowLeft, Save, Droplets, User, Calendar, MessageSquare } from 'lucide-react';
import { Link } from 'react-router';

export function BaptismRequestNew() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Droplets className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo Pedido de Batismo</h1>
            <p className="text-slate-600 dark:text-slate-400">Registrar novo pedido de batismo</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Dados do Candidato
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Membro *
                </label>
                <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option>Selecione o membro</option>
                  <option>Roberto Carlos Mendes</option>
                  <option>Silvia Regina Souza</option>
                  <option>Marcos Paulo Oliveira</option>
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Data de Nascimento
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Evento de Batismo *
                </label>
                <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option>Selecione o evento</option>
                  <option>Batismo Mensal - Março 2025</option>
                  <option>Batismo Especial CIBE - Abril 2025</option>
                  <option>Batismo Trimestral - Junho 2025</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status
                </label>
                <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option>Pendente</option>
                  <option>Em Análise</option>
                  <option>Aprovado</option>
                  <option>Concluído</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Observações
                </label>
                <textarea
                  rows={4}
                  placeholder="Informações adicionais sobre o candidato..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                ></textarea>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link
              to="/app-ui/baptism"
              className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </Link>
            <button className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
              <Save className="w-5 h-5" />
              Salvar Pedido
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-100 p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Droplets className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Batismo nas Águas</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Símbolo público de fé e obediência a Cristo</p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="bg-white rounded-lg p-3">
              <p className="font-semibold text-slate-900 mb-1">Requisitos:</p>
              <ul className="space-y-1 text-slate-600">
                <li>• Ter aceitado Jesus</li>
                <li>• Frequentar a igreja</li>
                <li>• Ter feito o curso</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
