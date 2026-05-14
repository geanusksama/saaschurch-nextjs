import { ArrowLeft, Calendar, MapPin, Users, DollarSign, QrCode, Edit, Share2, Ticket, Clock, User } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../design-system/components/Badge';

const ticketTypes = [
  { id: 1, name: 'VIP', price: 150, sold: 85, total: 100, color: 'purple' },
  { id: 2, name: 'Pista', price: 80, sold: 342, total: 500, color: 'blue' },
  { id: 3, name: 'Camarote', price: 200, sold: 28, total: 50, color: 'orange' },
];

const attendees = [
  { id: 1, name: 'João Silva', photo: 'https://i.pravatar.cc/150?img=12', ticket: 'VIP', checkedIn: true },
  { id: 2, name: 'Maria Santos', photo: 'https://i.pravatar.cc/150?img=45', ticket: 'Pista', checkedIn: true },
  { id: 3, name: 'Pedro Costa', photo: 'https://i.pravatar.cc/150?img=33', ticket: 'Pista', checkedIn: false },
  { id: 4, name: 'Ana Oliveira', photo: 'https://i.pravatar.cc/150?img=47', ticket: 'Camarote', checkedIn: true },
];

export function EventDetail() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        
        {/* Event Cover */}
        <div className="relative h-64 rounded-xl overflow-hidden mb-6">
          <img
            src="https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=1200&h=400&fit=crop"
            alt="Evento"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="success">Vendas Abertas</Badge>
                <h1 className="text-4xl font-bold text-white mt-2 mb-2">CIBE 2024</h1>
                <div className="flex flex-wrap gap-4 text-white">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    25 de Maio, 2024
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    19:00 - 22:00
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Centro de Convenções SP
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-colors">
                  <Share2 className="w-5 h-5" />
                  Compartilhar
                </button>
                <button className="flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors font-medium">
                  <Edit className="w-5 h-5" />
                  Editar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Ticket className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Ingressos Vendidos</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">455</p>
          <p className="text-sm text-green-600 mt-1">+127 esta semana</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Receita Total</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">R$ 48.350</p>
          <p className="text-sm text-slate-600 mt-1">de R$ 72.000</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Check-ins</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">245</p>
          <p className="text-sm text-slate-600 mt-1">de 455 vendidos</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Dias Restantes</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">45</p>
          <p className="text-sm text-slate-600 mt-1">até o evento</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Types */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Tipos de Ingresso</h2>
            <div className="space-y-4">
              {ticketTypes.map((ticket) => (
                <div key={ticket.id} className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">{ticket.name}</h3>
                      <p className="text-2xl font-bold text-blue-600">R$ {ticket.price}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-600 dark:text-slate-400">Vendidos</p>
                      <p className="text-xl font-bold text-slate-900">{ticket.sold}/{ticket.total}</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={`bg-${ticket.color}-600 h-2 rounded-full`}
                      style={{ width: `${(ticket.sold / ticket.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">
                    {ticket.total - ticket.sold} ingressos disponíveis
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Attendees */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Participantes Recentes</h2>
              <Link to="#" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                Ver Todos
              </Link>
            </div>
            <div className="space-y-3">
              {attendees.map((attendee) => (
                <div key={attendee.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <img
                      src={attendee.photo}
                      alt={attendee.name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">{attendee.name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{attendee.ticket}</p>
                    </div>
                  </div>
                  {attendee.checkedIn ? (
                    <Badge variant="success">Check-in Feito</Badge>
                  ) : (
                    <Badge variant="warning">Pendente</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Ações Rápidas</h2>
            <div className="space-y-2">
              <Link to="#" className="w-full flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                <QrCode className="w-5 h-5" />
                Scanner QR Code
              </Link>
              <button className="w-full flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                <Ticket className="w-5 h-5" />
                Vender Ingresso
              </button>
              <button className="w-full flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                <Share2 className="w-5 h-5" />
                Promover Evento
              </button>
            </div>
          </div>

          {/* Event Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Detalhes do Evento</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-600 mb-1">Categoria</p>
                <p className="font-semibold text-slate-900">Conferência</p>
              </div>
              <div>
                <p className="text-slate-600 mb-1">Organizador</p>
                <p className="font-semibold text-slate-900">Pastor João Silva</p>
              </div>
              <div>
                <p className="text-slate-600 mb-1">Capacidade</p>
                <p className="font-semibold text-slate-900">650 pessoas</p>
              </div>
              <div>
                <p className="text-slate-600 mb-1">Idade Mínima</p>
                <p className="font-semibold text-slate-900">Livre</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}