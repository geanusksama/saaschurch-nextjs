import { useParams, Link } from 'react-router';
import { ArrowLeft, Users, MapPin, Calendar, Phone, TrendingUp, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiBase } from '../../lib/apiBase';

export function CellDetail() {
  const { id } = useParams();
  const [cell, setCell] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCell() {
      try {
        const token = localStorage.getItem('mrm_token');
        const response = await fetch(`${apiBase}/cell-groups/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Não encontrado');
        const data = await response.json();
        setCell(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadCell();
  }, [id]);

  if (loading) {
    return <div className="p-6 text-slate-600">Carregando GF...</div>;
  }

  if (!cell) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">GF não encontrado</p>
          <Link to="/app-ui/cells" className="text-purple-600 hover:text-purple-700 mt-4 inline-block">
            Voltar para GFs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{cell.name}</h1>
            <p className="text-slate-600 dark:text-slate-400">{cell.cellType || 'GF'}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Informações do GF</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Líder</p>
                  <p className="font-semibold text-slate-900">{cell.leader?.fullName || 'Não definido'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Telefone</p>
                  <p className="font-semibold text-slate-900">{cell.leader?.mobile || cell.leader?.phone || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Localização</p>
                  <p className="font-semibold text-slate-900">{cell.description || '-'}</p>
                  <p className="text-sm text-slate-500">{cell.address || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Horário</p>
                  <p className="font-semibold text-slate-900">
                    {cell.meetingDay || '-'} às {cell.meetingTime ? new Date(cell.meetingTime).toISOString().slice(11, 16) : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Members List */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Membros do GF</h2>
            <p className="text-slate-600 dark:text-slate-400">Lista de {cell.members?.length || 0} membros participantes</p>
            <div className="mt-4 space-y-2">
              {cell.members?.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{m.member?.fullName}</p>
                  </div>
                </div>
              ))}
              {!cell.members?.length && <p className="text-sm text-slate-500">Nenhum membro cadastrado.</p>}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Estatísticas</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">Total de Membros</p>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="text-2xl font-bold text-slate-900">{cell.members?.length || 0}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-2">Crescimento</p>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">0%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Ações Rápidas</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                <Calendar className="w-4 h-4" />
                Agendar Reunião
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <Phone className="w-4 h-4" />
                Contatar Líder
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <Users className="w-4 h-4" />
                Adicionar Membro
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
