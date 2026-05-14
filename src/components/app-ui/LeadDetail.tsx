import { ArrowLeft, Mail, Phone, MapPin, Calendar, User, Building, Tag, Clock, MessageSquare, CheckCircle, Edit } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../design-system/components/Badge';

const activities = [
  { id: 1, type: 'email', title: 'Email enviado', description: 'Enviou email de boas-vindas', date: '2024-03-15 14:30', user: 'Ana Costa' },
  { id: 2, type: 'call', title: 'Ligação realizada', description: 'Conversa de 15 minutos sobre a igreja', date: '2024-03-14 10:15', user: 'Pedro Santos' },
  { id: 3, type: 'meeting', title: 'Reunião agendada', description: 'Visita pastoral marcada para 20/03', date: '2024-03-13 16:45', user: 'João Silva' },
  { id: 4, type: 'note', title: 'Nota adicionada', description: 'Interessado em batismo', date: '2024-03-12 09:20', user: 'Maria Lima' },
];

export function LeadDetail() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <img
              src="https://i.pravatar.cc/150?img=33"
              alt="Carlos Mendes"
              className="w-20 h-20 rounded-full border-4 border-blue-100"
            />
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Carlos Mendes</h1>
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="warning">Novo Lead</Badge>
                <span className="text-slate-600">ID: #1247</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  carlos.mendes@email.com
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  (11) 98765-4321
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  São Paulo, SP
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
              <Edit className="w-5 h-5" />
              Editar
            </button>
            <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              <CheckCircle className="w-5 h-5" />
              Converter em Membro
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lead Information */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Informações do Lead</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600 mb-1">Data de Criação</p>
                <p className="font-semibold text-slate-900">10/03/2024</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Origem</p>
                <p className="font-semibold text-slate-900">Formulário Website</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Responsável</p>
                <p className="font-semibold text-slate-900">Pastor João Silva</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Última Interação</p>
                <p className="font-semibold text-slate-900">Há 2 dias</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Interesse</p>
                <p className="font-semibold text-slate-900">Batismo, Células</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Score</p>
                <div className="flex items-center gap-2">
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                  <span className="font-semibold text-green-600">75</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Timeline de Atividades</h2>
              <button className="text-blue-600 hover:text-blue-700 font-medium">Ver Todas</button>
            </div>
            
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      {activity.type === 'email' && <Mail className="w-5 h-5 text-blue-600" />}
                      {activity.type === 'call' && <Phone className="w-5 h-5 text-green-600" />}
                      {activity.type === 'meeting' && <Calendar className="w-5 h-5 text-purple-600" />}
                      {activity.type === 'note' && <MessageSquare className="w-5 h-5 text-orange-600" />}
                    </div>
                    {activity.id !== activities.length && (
                      <div className="w-0.5 h-full bg-slate-200 mt-2"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-bold text-slate-900">{activity.title}</h3>
                      <span className="text-sm text-slate-500">{activity.date}</span>
                    </div>
                    <p className="text-slate-600 mb-2">{activity.description}</p>
                    <p className="text-sm text-slate-500">por {activity.user}</p>
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full mt-4 flex items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors font-medium">
              <MessageSquare className="w-5 h-5" />
              Adicionar Atividade
            </button>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Notas</h2>
            <div className="space-y-3 mb-4">
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-slate-900 mb-2">Demonstrou interesse em participar das células. Gostaria de conhecer mais sobre o discipulado.</p>
                <p className="text-sm text-slate-500">12/03/2024 às 09:20 - Maria Lima</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-slate-900 mb-2">Primeira visita foi no culto de domingo. Amigo do membro Pedro Costa.</p>
                <p className="text-sm text-slate-500">10/03/2024 às 15:30 - João Silva</p>
              </div>
            </div>
            <textarea
              placeholder="Adicionar nova nota..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              rows={3}
            ></textarea>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Salvar Nota
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stage */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Estágio do Pipeline</h2>
            <select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3">
              <option>Novo Lead</option>
              <option>Primeira Visita</option>
              <option>Acompanhamento</option>
              <option>Comprometido</option>
              <option>Membro</option>
            </select>
            <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Atualizar Estágio
            </button>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Ações Rápidas</h2>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                <Mail className="w-5 h-5 text-blue-600" />
                Enviar Email
              </button>
              <button className="w-full flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                <Phone className="w-5 h-5 text-green-600" />
                Ligar
              </button>
              <button className="w-full flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                <Calendar className="w-5 h-5 text-purple-600" />
                Agendar Reunião
              </button>
              <button className="w-full flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                <CheckCircle className="w-5 h-5 text-orange-600" />
                Criar Tarefa
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Tags</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">Batismo</span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">Célula</span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Discipulado</span>
            </div>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">+ Adicionar Tag</button>
          </div>
        </div>
      </div>
    </div>
  );
}
