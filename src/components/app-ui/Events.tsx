import { Calendar, Plus, Users, Ticket, QrCode, MapPin, Clock } from 'lucide-react';
import { Link } from 'react-router';

const events = [
  {
    id: '1',
    name: 'Culto de Domingo',
    date: '2024-03-17',
    time: '10:00',
    location: 'Sede Principal',
    capacity: 500,
    registered: 350,
    tickets: false,
    status: 'upcoming',
  },
  {
    id: '2',
    name: 'Congresso CIBE 2024',
    date: '2024-03-22',
    time: '18:00',
    location: 'Centro de Convenções',
    capacity: 3000,
    registered: 2500,
    tickets: true,
    revenue: 125000,
    status: 'upcoming',
  },
  {
    id: '3',
    name: 'Reunião de Jovens',
    date: '2024-03-18',
    time: '19:30',
    location: 'Sala dos Jovens',
    capacity: 150,
    registered: 120,
    tickets: false,
    status: 'upcoming',
  },
  {
    id: '4',
    name: 'Escola Bíblica',
    date: '2024-03-19',
    time: '19:00',
    location: 'Sede Principal',
    capacity: 100,
    registered: 85,
    tickets: false,
    status: 'upcoming',
  },
];

export function Events() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Eventos</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie todos os eventos da igreja</p>
          </div>
        </div>
        <Link
          to="/app-ui/events/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
        >
          <Plus className="w-5 h-5" />
          Novo Evento
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total de Eventos</p>
              <p className="text-2xl font-bold text-slate-900">{events.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Inscritos</p>
              <p className="text-2xl font-bold text-slate-900">
                {events.reduce((sum, e) => sum + e.registered, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Ticket className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Receita</p>
              <p className="text-2xl font-bold text-slate-900">R$ 125K</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <QrCode className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Check-ins Hoje</p>
              <p className="text-2xl font-bold text-slate-900">350</p>
            </div>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div key={event.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
            <div className="h-32 bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Calendar className="w-16 h-16 text-white opacity-50" />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-3">{event.name}</h3>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(event.date).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="w-4 h-4" />
                  <span>{event.time}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span>{event.location}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Users className="w-4 h-4" />
                  <span>{event.registered} / {event.capacity} inscritos</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ width: `${(event.registered / event.capacity) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {Math.round((event.registered / event.capacity) * 100)}% de ocupação
                </p>
              </div>

              {event.tickets && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 rounded-lg">
                  <Ticket className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-900">Venda de Ingressos</p>
                    <p className="text-xs text-green-600">R$ {(event.revenue || 0).toLocaleString()}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Link
                  to={`/app-ui/events/${event.id}`}
                  className="flex-1 py-2 text-center border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 font-medium"
                >
                  Ver Detalhes
                </Link>
                <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
