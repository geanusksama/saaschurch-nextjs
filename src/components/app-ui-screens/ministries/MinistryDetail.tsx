import { ArrowLeft, Users, User, Calendar, Target, TrendingUp, Mail, Phone } from 'lucide-react';
import { Link } from 'react-router';

const ministry = {
  id: 1,
  name: 'Louvor e Adoração',
  description: 'Ministério responsável pela música e adoração nos cultos e eventos da igreja',
  leader: { name: 'Carlos Roberto Silva', photo: null, email: 'carlos@igreja.com', phone: '(11) 98765-4321' },
  members: 45,
  departments: ['Banda', 'Coral', 'Ministério Infantil', 'Produção'],
  meetings: 'Quintas-feiras, 19h30',
  goals: [
    { id: 1, title: 'Formar novo coral infantil', progress: 65, status: 'in_progress' },
    { id: 2, title: 'Gravar CD de adoração', progress: 40, status: 'in_progress' },
    { id: 3, title: 'Treinar 10 novos músicos', progress: 80, status: 'in_progress' },
  ]
};

const members = [
  { id: 1, name: 'Ana Paula Santos', role: 'Vocal', status: 'active', joined: '2023-01-15' },
  { id: 2, name: 'Bruno Oliveira', role: 'Bateria', status: 'active', joined: '2022-08-20' },
  { id: 3, name: 'Carla Mendes', role: 'Teclado', status: 'active', joined: '2023-03-10' },
  { id: 4, name: 'Daniel Costa', role: 'Guitarra', status: 'active', joined: '2022-11-05' },
  { id: 5, name: 'Eduarda Lima', role: 'Vocal', status: 'active', joined: '2023-05-18' },
  { id: 6, name: 'Felipe Rodrigues', role: 'Baixo', status: 'active', joined: '2022-09-22' },
];

export default function MinistryDetail() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{ministry.name}</h1>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl">{ministry.description}</p>
            </div>
          </div>
          
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
            Editar Ministério
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-600 dark:text-slate-400">Total de Membros</p>
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{ministry.members}</p>
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +12% este mês
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-600 dark:text-slate-400">Departamentos</p>
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{ministry.departments.length}</p>
            </div>
          </div>

          {/* Goals */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Metas do Ministério</h2>
            <div className="space-y-4">
              {ministry.goals.map((goal) => (
                <div key={goal.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-900">{goal.title}</span>
                    <span className="text-sm font-semibold text-purple-600">{goal.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-600 to-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Members List */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Membros do Ministério</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{members.length} membros ativos</p>
                </div>
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm">
                  Adicionar Membro
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Função</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Desde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-purple-600" />
                          </div>
                          <span className="font-medium text-slate-900">{member.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{member.role}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-semibold">
                          Ativo
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">
                          {new Date(member.joined).toLocaleDateString('pt-BR')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Leader Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Líder do Ministério</h3>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{ministry.leader.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Líder Principal</p>
              </div>
            </div>

            <div className="space-y-3">
              <a 
                href={`mailto:${ministry.leader.email}`}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-purple-600"
              >
                <Mail className="w-4 h-4" />
                {ministry.leader.email}
              </a>
              <a 
                href={`tel:${ministry.leader.phone}`}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-purple-600"
              >
                <Phone className="w-4 h-4" />
                {ministry.leader.phone}
              </a>
            </div>
          </div>

          {/* Departments */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Departamentos</h3>
            <div className="space-y-2">
              {ministry.departments.map((dept, index) => (
                <div key={index} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg">
                  <div className="w-2 h-2 bg-purple-600 rounded-full" />
                  <span className="text-sm text-slate-700">{dept}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Meeting Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900">Reuniões</h3>
            </div>
            <p className="text-sm text-slate-700">{ministry.meetings}</p>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Ações Rápidas</h3>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200">
                Agendar Reunião
              </button>
              <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200">
                Enviar Mensagem
              </button>
              <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200">
                Gerar Relatório
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
