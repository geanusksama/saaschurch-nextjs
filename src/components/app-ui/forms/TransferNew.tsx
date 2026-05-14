import { ArrowLeft, Save, UserCheck } from 'lucide-react';
import { Link } from 'react-router';

export function TransferNew() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nova Transferência</h1>
            <p className="text-slate-600 dark:text-slate-400">Solicitar transferência de membro</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-6">Dados do Membro</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Membro *
              </label>
              <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option>Selecione o membro</option>
                <option>Roberto Carlos Mendes</option>
                <option>Silvia Regina Souza</option>
                <option>Marcos Paulo Oliveira</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tipo de Transferência *
              </label>
              <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option>Transferência de Saída</option>
                <option>Transferência de Entrada</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Igreja de Destino/Origem *
              </label>
              <input
                type="text"
                placeholder="Nome da igreja"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Motivo
              </label>
              <textarea
                rows={4}
                placeholder="Descreva o motivo da transferência..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              ></textarea>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            to="/app-ui/transfer"
            className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </Link>
          <button className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-colors">
            <Save className="w-5 h-5" />
            Salvar Transferência
          </button>
        </div>
      </div>
    </div>
  );
}
