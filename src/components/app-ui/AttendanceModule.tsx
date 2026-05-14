import { CheckSquare, TrendingUp, Users, Calendar, Download, Plus } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from '../../design-system/components/Badge';

const weeklyData = [
  { week: 'Sem 1', presentes: 350, ausentes: 45 },
  { week: 'Sem 2', presentes: 380, ausentes: 38 },
  { week: 'Sem 3', presentes: 420, ausentes: 32 },
  { week: 'Sem 4', presentes: 405, ausentes: 35 },
];

const serviceAttendance = [
  {
    id: 1,
    service: 'Culto de Domingo - Manhã',
    date: '2024-03-17',
    time: '10:00',
    expected: 400,
    present: 385,
    percentage: 96.25,
    firstTimers: 12
  },
  {
    id: 2,
    service: 'Culto de Domingo - Noite',
    date: '2024-03-17',
    time: '18:00',
    expected: 450,
    present: 420,
    percentage: 93.33,
    firstTimers: 8
  },
  {
    id: 3,
    service: 'Culto de Quarta-feira',
    date: '2024-03-13',
    time: '19:30',
    expected: 250,
    present: 235,
    percentage: 94.00,
    firstTimers: 3
  },
  {
    id: 4,
    service: 'Reunião de Oração',
    date: '2024-03-15',
    time: '20:00',
    expected: 100,
    present: 92,
    percentage: 92.00,
    firstTimers: 0
  },
];

const recentCheckIns = [
  { id: 1, name: 'João Silva', time: '17:45', service: 'Culto Domingo', method: 'QR Code' },
  { id: 2, name: 'Maria Santos', time: '17:48', service: 'Culto Domingo', method: 'Face ID' },
  { id: 3, name: 'Pedro Oliveira', time: '17:50', service: 'Culto Domingo', method: 'Manual' },
  { id: 4, name: 'Ana Costa', time: '17:52', service: 'Culto Domingo', method: 'QR Code' },
  { id: 5, name: 'Carlos Mendes', time: '17:55', service: 'Culto Domingo', method: 'Face ID' },
];

export function AttendanceModule() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <CheckSquare className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Presença</h1>
            <p className="text-slate-600 dark:text-slate-400">Controle de frequência e check-in</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
            <Download className="w-5 h-5" />
            Exportar Relatório
          </button>
          <button className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            <Plus className="w-5 h-5" />
            Novo Check-in
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Presentes Hoje</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">805</p>
          <p className="text-sm text-green-600 mt-1">+12% vs semana passada</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Taxa de Presença</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">94.7%</p>
          <p className="text-sm text-purple-600 mt-1">Meta: 90%</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Visitantes</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">23</p>
          <p className="text-sm text-blue-600 mt-1">Primeira vez</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Média Mensal</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">3,240</p>
          <p className="text-sm text-orange-600 mt-1">Este mês</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Weekly Trend */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Tendência Semanal</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={weeklyData}>
              <CartesianGrid key="grid-weekly" strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis key="xaxis-weekly" dataKey="week" stroke="#64748b" />
              <YAxis key="yaxis-weekly" stroke="#64748b" />
              <Tooltip
                key="tooltip-weekly"
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <Legend key="legend-weekly" />
              <Line key="line-presentes" type="monotone" dataKey="presentes" stroke="#10b981" strokeWidth={3} name="Presentes" />
              <Line key="line-ausentes" type="monotone" dataKey="ausentes" stroke="#ef4444" strokeWidth={3} name="Ausentes" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Service Comparison */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Comparativo por Culto</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={serviceAttendance}>
              <CartesianGrid key="grid-service" strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis key="xaxis-service" dataKey="service" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis key="yaxis-service" stroke="#64748b" />
              <Tooltip
                key="tooltip-service"
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <Legend key="legend-service" />
              <Bar key="bar-present" dataKey="present" fill="#8b5cf6" name="Presentes" radius={[8, 8, 0, 0]} />
              <Bar key="bar-expected" dataKey="expected" fill="#e0e7ff" name="Esperado" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Service Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Presença por Culto</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Culto</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Data/Hora</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Esperado</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Presente</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Taxa</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Visitantes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {serviceAttendance.map((service) => (
                <tr key={service.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{service.service}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {new Date(service.date).toLocaleDateString('pt-BR')} - {service.time}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{service.expected}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">{service.present}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${service.percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-slate-900">
                        {service.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={service.firstTimers > 0 ? 'active' : 'inactive'}>
                      {service.firstTimers}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Check-ins */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Check-ins Recentes</h3>
        </div>
        <div className="divide-y divide-slate-200">
          {recentCheckIns.map((checkIn) => (
            <div key={checkIn.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-semibold">
                  {checkIn.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{checkIn.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{checkIn.service}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="active">{checkIn.method}</Badge>
                <span className="text-sm text-slate-600">{checkIn.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}