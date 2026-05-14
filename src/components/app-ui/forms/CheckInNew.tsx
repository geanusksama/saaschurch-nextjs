import { ArrowLeft, Save, QrCode, User } from 'lucide-react';
import { Link } from 'react-router';

export function CheckInNew() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
            <QrCode className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo Check-in</h1>
            <p className="text-slate-600 dark:text-slate-400">Registrar presença manual</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-6">Dados do Check-in</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Culto/Evento *
              </label>
              <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option>Selecione o culto</option>
                <option>Culto de Domingo - Manhã</option>
                <option>Culto de Domingo - Tarde</option>
                <option>Culto de Domingo - Noite</option>
                <option>Reunião de Oração</option>
                <option>Escola Bíblica</option>
              </select>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Data *
                </label>
                <input
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Horário
                </label>
                <input
                  type="time"
                  defaultValue={new Date().toTimeString().slice(0, 5)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Membros *
              </label>
              <select multiple className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" size={6}>
                <option>Roberto Carlos Mendes</option>
                <option>Silvia Regina Souza</option>
                <option>Marcos Paulo Oliveira</option>
                <option>Vanessa Cristina Lima</option>
                <option>André Luiz Santos</option>
                <option>Daniela Ferreira Costa</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">Segure Ctrl/Cmd para selecionar múltiplos</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            to="/app-ui/checkin"
            className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </Link>
          <button className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors">
            <Save className="w-5 h-5" />
            Registrar Presença
          </button>
        </div>
      </div>
    </div>
  );
}
