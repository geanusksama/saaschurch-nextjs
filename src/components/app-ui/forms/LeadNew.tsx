import { ArrowLeft, Save, User, Phone, Mail, Globe, Tag, Calendar, MessageSquare } from 'lucide-react';
import { Link } from 'react-router';

export function LeadNew() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo Lead</h1>
            <p className="text-slate-600 dark:text-slate-400">Cadastre um novo lead no pipeline</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Informações Básicas */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" />
              Informações Básicas
            </h3>
            
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    placeholder="Nome do lead"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Telefone *
                  </label>
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Data de Nascimento
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Origem e Estágio */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-600" />
              Origem e Estágio
            </h3>
            
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Origem *
                  </label>
                  <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <option>Selecione a origem</option>
                    <option>Site</option>
                    <option>Indicação</option>
                    <option>WhatsApp</option>
                    <option>Facebook</option>
                    <option>Instagram</option>
                    <option>Evento CIBE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Estágio *
                  </label>
                  <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <option>Visitante</option>
                    <option>Em Acompanhamento</option>
                    <option>Consolidado</option>
                    <option>Membro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Responsável
                </label>
                <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option>Selecione um responsável</option>
                  <option>Ana Paula Silva</option>
                  <option>Carlos Eduardo Santos</option>
                  <option>Rafael Souza Lima</option>
                  <option>Juliana Ferreira Rocha</option>
                </select>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              Observações
            </h3>
            
            <textarea
              rows={4}
              placeholder="Adicione observações sobre o lead..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            ></textarea>
          </div>

          <div className="flex justify-end gap-3">
            <Link
              to="/app-ui/crm"
              className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </Link>
            <button className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-colors">
              <Save className="w-5 h-5" />
              Salvar Lead
            </button>
          </div>
        </div>

        {/* Preview Card */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100 p-6">
            <h3 className="font-bold text-slate-900 mb-4">💡 Dicas</h3>
            
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2"></div>
                <p>Preencha todas as informações básicas para facilitar o acompanhamento</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2"></div>
                <p>Escolha a origem correta para análises mais precisas</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2"></div>
                <p>Atribua um responsável para garantir o follow-up</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Próximos Passos</h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 font-semibold">
                  1
                </div>
                <span className="text-slate-600">Salvar informações do lead</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-semibold">
                  2
                </div>
                <span className="text-slate-600">Fazer primeiro contato</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600 font-semibold">
                  3
                </div>
                <span className="text-slate-600">Agendar visita pastoral</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
