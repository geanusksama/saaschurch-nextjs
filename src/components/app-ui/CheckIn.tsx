import { QrCode, Users, UserPlus, Baby, Clock, CheckCircle, Camera, Smartphone, CheckSquare } from 'lucide-react';
import { Link } from 'react-router';
import { useState } from 'react';

const todayServices = [
  { id: 1, name: 'Culto da Manhã', time: '9h', checkins: 248, capacity: 500, status: 'active' },
  { id: 2, name: 'Culto da Tarde', time: '18h', checkins: 0, capacity: 500, status: 'scheduled' },
  { id: 3, name: 'Culto de Jovens', time: '20h', checkins: 0, capacity: 300, status: 'scheduled' },
];

const recentCheckins = [
  { id: 1, name: 'João Silva', type: 'Membro', time: '08:45', service: 'Culto da Manhã' },
  { id: 2, name: 'Maria Santos', type: 'Visitante', time: '08:47', service: 'Culto da Manhã' },
  { id: 3, name: 'Pedro Costa', type: 'Membro', time: '08:48', service: 'Culto da Manhã' },
  { id: 4, name: 'Ana Lima', type: 'Kids', time: '08:50', service: 'Culto da Manhã' },
  { id: 5, name: 'Carlos Rocha', type: 'Membro', time: '08:52', service: 'Culto da Manhã' },
];

export function CheckIn() {
  const [scannerMode, setScannerMode] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
            <CheckSquare className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sistema de Check-in</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie presença de membros, visitantes e crianças</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setScannerMode(!scannerMode)}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <QrCode className="w-5 h-5" />
            Scanner QR Code
          </button>
          <Link
            to="/app-ui/checkin/manual"
            className="flex items-center gap-2 border border-slate-200 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Check-in Manual
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Check-ins Hoje</p>
              <p className="text-2xl font-bold text-slate-900">248</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Membros</p>
              <p className="text-2xl font-bold text-slate-900">215</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Visitantes</p>
              <p className="text-2xl font-bold text-slate-900">18</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Baby className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Crianças</p>
              <p className="text-2xl font-bold text-slate-900">15</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scanner Mode */}
      {scannerMode && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 mb-6">
          <div className="max-w-md mx-auto text-center">
            <div className="w-64 h-64 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl mx-auto mb-6 flex items-center justify-center">
              <Camera className="w-24 h-24 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Scanner QR Code</h3>
            <p className="text-slate-600 mb-4">
              Posicione o QR Code do membro na frente da câmera
            </p>
            <button
              onClick={() => setScannerMode(false)}
              className="px-6 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Fechar Scanner
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's Services */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Cultos de Hoje</h2>
          </div>
          <div className="p-6 space-y-4">
            {todayServices.map((service) => (
              <div key={service.id} className="border border-slate-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{service.name}</h3>
                    <div className="flex items-center gap-2 text-slate-600 mt-1">
                      <Clock className="w-4 h-4" />
                      <span>{service.time}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    service.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {service.status === 'active' ? 'Em Andamento' : 'Agendado'}
                  </span>
                </div>

                <div className="flex items-center gap-6 mb-4">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Check-ins</p>
                    <p className="text-2xl font-bold text-slate-900">{service.checkins}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Capacidade</p>
                    <p className="text-2xl font-bold text-slate-900">{service.capacity}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-600 mb-2">Ocupação</p>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${(service.checkins / service.capacity) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {Math.round((service.checkins / service.capacity) * 100)}%
                    </p>
                  </div>
                </div>

                {service.status === 'active' && (
                  <div className="grid grid-cols-3 gap-3">
                    <Link
                      to={`/app-ui/checkin/service/${service.id}/members`}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                    >
                      <Users className="w-4 h-4" />
                      Membros
                    </Link>
                    <Link
                      to={`/app-ui/checkin/service/${service.id}/visitors`}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
                    >
                      <UserPlus className="w-4 h-4" />
                      Visitantes
                    </Link>
                    <Link
                      to={`/app-ui/checkin/service/${service.id}/kids`}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
                    >
                      <Baby className="w-4 h-4" />
                      Kids
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Check-ins */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Check-ins Recentes</h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {recentCheckins.map((checkin) => (
                <div key={checkin.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {checkin.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{checkin.name}</p>
                    <p className="text-xs text-slate-500">{checkin.type} • {checkin.time}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                </div>
              ))}
            </div>

            <Link
              to="/app-ui/checkin/history"
              className="block w-full mt-4 py-2 text-center border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Ver Histórico Completo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
