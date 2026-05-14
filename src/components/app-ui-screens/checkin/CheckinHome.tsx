import { Link } from 'react-router';
import { Users, Baby, QrCode, UserCheck, Calendar, TrendingUp } from 'lucide-react';

const services = [
  { id: 1, name: 'Culto Domingo Manhã', time: '09:00', checkins: 342, capacity: 500 },
  { id: 2, name: 'Culto Domingo Noite', time: '18:00', checkins: 0, capacity: 500 },
  { id: 3, name: 'Culto Quarta-feira', time: '19:30', checkins: 0, capacity: 300 },
];

export default function CheckinHome() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sistema de Check-in</h1>
            <p className="text-slate-600 dark:text-slate-400">Gestão de presença em cultos e eventos</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Check-ins Hoje</p>
            <UserCheck className="w-5 h-5 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">342</p>
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            +15% vs semana passada
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Visitantes</p>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">28</p>
          <p className="text-xs text-slate-500 mt-1">Primeira visita hoje</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Kids Check-in</p>
            <Baby className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">87</p>
          <p className="text-xs text-slate-500 mt-1">Crianças registradas</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Taxa de Presença</p>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">68%</p>
          <p className="text-xs text-slate-500 mt-1">Dos membros ativos</p>
        </div>
      </div>

      {/* Check-in Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Link
          to="/app-ui/checkin/members"
          className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl p-8 text-white hover:shadow-lg transition-all"
        >
          <Users className="w-12 h-12 mb-4" />
          <h3 className="text-2xl font-bold mb-2">Check-in Membros</h3>
          <p className="text-teal-100">Registrar presença de membros</p>
        </Link>

        <Link
          to="/app-ui/checkin/visitors"
          className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl p-8 text-white hover:shadow-lg transition-all"
        >
          <UserCheck className="w-12 h-12 mb-4" />
          <h3 className="text-2xl font-bold mb-2">Check-in Visitantes</h3>
          <p className="text-blue-100">Cadastrar novos visitantes</p>
        </Link>

        <Link
          to="/app-ui/checkin/kids"
          className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-8 text-white hover:shadow-lg transition-all"
        >
          <Baby className="w-12 h-12 mb-4" />
          <h3 className="text-2xl font-bold mb-2">Check-in Kids</h3>
          <p className="text-purple-100">Registro de crianças</p>
        </Link>

        <Link
          to="/app-ui/checkin/scanner"
          className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-8 text-white hover:shadow-lg transition-all"
        >
          <QrCode className="w-12 h-12 mb-4" />
          <h3 className="text-2xl font-bold mb-2">Scanner QR Code</h3>
          <p className="text-orange-100">Check-in automático</p>
        </Link>
      </div>

      {/* Services Today */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Cultos de Hoje</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Selecione o culto para iniciar check-in</p>
            </div>
            <Calendar className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-6 border border-slate-200 rounded-lg hover:border-teal-300 hover:bg-slate-50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-teal-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-7 h-7 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{service.name}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Horário: {service.time}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">{service.checkins}</p>
                    <p className="text-xs text-slate-500">de {service.capacity} lugares</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {service.checkins > 0 ? (
                      <button className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
                        Continuar Check-in
                      </button>
                    ) : (
                      <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                        Iniciar Check-in
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
