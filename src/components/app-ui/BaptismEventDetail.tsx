import { useParams, Link } from 'react-router';
import { ArrowLeft, Calendar, MapPin, Users, User, Phone, Mail, CheckCircle, Clock } from 'lucide-react';

// Mock data for baptism events
const baptismEvents = [
  {
    id: 1,
    date: '2024-04-15',
    location: 'Sede Principal',
    candidates: 12,
    status: 'Agendado',
    time: '19:00',
    pastor: 'Pr. João Silva',
    description: 'Cerimônia de batismo com 12 candidatos',
    candidatesList: [
      { id: 1, name: 'Maria Santos', age: 25, phone: '(11) 98765-4321', email: 'maria@email.com', status: 'Confirmado' },
      { id: 2, name: 'João Pedro', age: 18, phone: '(11) 98765-4322', email: 'joao@email.com', status: 'Confirmado' },
      { id: 3, name: 'Ana Silva', age: 32, phone: '(11) 98765-4323', email: 'ana@email.com', status: 'Confirmado' },
      { id: 4, name: 'Carlos Mendes', age: 28, phone: '(11) 98765-4324', email: 'carlos@email.com', status: 'Confirmado' },
      { id: 5, name: 'Fernanda Costa', age: 22, phone: '(11) 98765-4325', email: 'fernanda@email.com', status: 'Pendente' },
      { id: 6, name: 'Rafael Lima', age: 35, phone: '(11) 98765-4326', email: 'rafael@email.com', status: 'Confirmado' },
      { id: 7, name: 'Juliana Rocha', age: 29, phone: '(11) 98765-4327', email: 'juliana@email.com', status: 'Confirmado' },
      { id: 8, name: 'Pedro Alves', age: 24, phone: '(11) 98765-4328', email: 'pedro@email.com', status: 'Confirmado' },
      { id: 9, name: 'Camila Dias', age: 31, phone: '(11) 98765-4329', email: 'camila@email.com', status: 'Confirmado' },
      { id: 10, name: 'Lucas Oliveira', age: 27, phone: '(11) 98765-4330', email: 'lucas@email.com', status: 'Confirmado' },
      { id: 11, name: 'Beatriz Santos', age: 23, phone: '(11) 98765-4331', email: 'beatriz@email.com', status: 'Pendente' },
      { id: 12, name: 'Thiago Ferreira', age: 30, phone: '(11) 98765-4332', email: 'thiago@email.com', status: 'Confirmado' },
    ]
  },
  {
    id: 2,
    date: '2024-05-20',
    location: 'Campus Norte',
    candidates: 8,
    status: 'Agendado',
    time: '18:00',
    pastor: 'Pr. Maria Oliveira',
    description: 'Cerimônia de batismo no Campus Norte',
    candidatesList: [
      { id: 1, name: 'Ricardo Silva', age: 26, phone: '(11) 98765-5001', email: 'ricardo@email.com', status: 'Confirmado' },
      { id: 2, name: 'Patrícia Costa', age: 34, phone: '(11) 98765-5002', email: 'patricia@email.com', status: 'Confirmado' },
      { id: 3, name: 'Gabriel Santos', age: 21, phone: '(11) 98765-5003', email: 'gabriel@email.com', status: 'Confirmado' },
      { id: 4, name: 'Amanda Lima', age: 28, phone: '(11) 98765-5004', email: 'amanda@email.com', status: 'Confirmado' },
      { id: 5, name: 'Bruno Alves', age: 33, phone: '(11) 98765-5005', email: 'bruno@email.com', status: 'Confirmado' },
      { id: 6, name: 'Larissa Rocha', age: 25, phone: '(11) 98765-5006', email: 'larissa@email.com', status: 'Pendente' },
      { id: 7, name: 'Felipe Mendes', age: 29, phone: '(11) 98765-5007', email: 'felipe@email.com', status: 'Confirmado' },
      { id: 8, name: 'Isabela Dias', age: 27, phone: '(11) 98765-5008', email: 'isabela@email.com', status: 'Confirmado' },
    ]
  },
  {
    id: 3,
    date: '2024-06-10',
    location: 'Campus Sul',
    candidates: 15,
    status: 'Planejamento',
    time: '19:30',
    pastor: 'Pr. Carlos Mendes',
    description: 'Grande cerimônia de batismo no Campus Sul',
    candidatesList: [
      { id: 1, name: 'Marcos Silva', age: 24, phone: '(11) 98765-6001', email: 'marcos@email.com', status: 'Em Análise' },
      { id: 2, name: 'Aline Costa', age: 30, phone: '(11) 98765-6002', email: 'aline@email.com', status: 'Em Análise' },
      { id: 3, name: 'Rodrigo Lima', age: 26, phone: '(11) 98765-6003', email: 'rodrigo@email.com', status: 'Em Análise' },
      { id: 4, name: 'Vanessa Santos', age: 32, phone: '(11) 98765-6004', email: 'vanessa@email.com', status: 'Confirmado' },
      { id: 5, name: 'Diego Alves', age: 28, phone: '(11) 98765-6005', email: 'diego@email.com', status: 'Confirmado' },
      { id: 6, name: 'Priscila Rocha', age: 25, phone: '(11) 98765-6006', email: 'priscila@email.com', status: 'Confirmado' },
      { id: 7, name: 'Leonardo Dias', age: 31, phone: '(11) 98765-6007', email: 'leonardo@email.com', status: 'Confirmado' },
      { id: 8, name: 'Tatiana Mendes', age: 27, phone: '(11) 98765-6008', email: 'tatiana@email.com', status: 'Em Análise' },
      { id: 9, name: 'André Oliveira', age: 29, phone: '(11) 98765-6009', email: 'andre@email.com', status: 'Confirmado' },
      { id: 10, name: 'Carolina Silva', age: 23, phone: '(11) 98765-6010', email: 'carolina@email.com', status: 'Confirmado' },
      { id: 11, name: 'Vinícius Costa', age: 26, phone: '(11) 98765-6011', email: 'vinicius@email.com', status: 'Em Análise' },
      { id: 12, name: 'Renata Lima', age: 34, phone: '(11) 98765-6012', email: 'renata@email.com', status: 'Confirmado' },
      { id: 13, name: 'Gustavo Santos', age: 22, phone: '(11) 98765-6013', email: 'gustavo@email.com', status: 'Em Análise' },
      { id: 14, name: 'Natália Alves', age: 28, phone: '(11) 98765-6014', email: 'natalia@email.com', status: 'Confirmado' },
      { id: 15, name: 'Eduardo Rocha', age: 30, phone: '(11) 98765-6015', email: 'eduardo@email.com', status: 'Confirmado' },
    ]
  },
];

export function BaptismEventDetail() {
  const { id } = useParams();
  const event = baptismEvents.find(e => e.id === Number(id));

  if (!event) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">Evento de batismo não encontrado</p>
          <Link to="/app-ui/baptism" className="text-purple-600 hover:text-purple-700 mt-4 inline-block">
            Voltar para Batismo
          </Link>
        </div>
      </div>
    );
  }

  const confirmedCount = event.candidatesList.filter(c => c.status === 'Confirmado').length;
  const pendingCount = event.candidatesList.filter(c => c.status === 'Pendente' || c.status === 'Em Análise').length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Evento de Batismo</h1>
            <p className="text-slate-600 dark:text-slate-400">{event.description}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event Details Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Detalhes do Evento</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Data</p>
                  <p className="font-semibold text-slate-900">
                    {new Date(event.date).toLocaleDateString('pt-BR', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Horário</p>
                  <p className="font-semibold text-slate-900">{event.time}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Local</p>
                  <p className="font-semibold text-slate-900">{event.location}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Pastor Responsável</p>
                  <p className="font-semibold text-slate-900">{event.pastor}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Candidates List */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                Candidatos ({event.candidatesList.length})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Nome</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Idade</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Telefone</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Email</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {event.candidatesList.map((candidate) => (
                    <tr key={candidate.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                            {candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <p className="font-semibold text-slate-900">{candidate.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {candidate.age} anos
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Phone className="w-4 h-4" />
                          {candidate.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail className="w-4 h-4" />
                          {candidate.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          candidate.status === 'Confirmado' ? 'bg-green-100 text-green-700' :
                          candidate.status === 'Pendente' ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {candidate.status}
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
          {/* Status Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Status do Evento</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">Status Geral</p>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  event.status === 'Agendado' ? 'bg-green-100 text-green-700' :
                  event.status === 'Planejamento' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {event.status}
                </span>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Total de Candidatos</span>
                  <span className="font-bold text-slate-900">{event.candidatesList.length}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Confirmados</span>
                  <span className="font-bold text-green-600">{confirmedCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Pendentes</span>
                  <span className="font-bold text-orange-600">{pendingCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Ações Rápidas</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                <Users className="w-4 h-4" />
                Adicionar Candidato
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <Mail className="w-4 h-4" />
                Enviar Convites
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <Calendar className="w-4 h-4" />
                Editar Evento
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
