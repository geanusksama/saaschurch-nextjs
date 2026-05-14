import { useMemo, useState } from 'react';
import { Calendar, Clock, Filter, Search } from 'lucide-react';
import { useMemberOptions, usePastoralTimeline } from '../../lib/pastoralHooks';

function typeLabel(type: string) {
  if (type === 'visit') return 'Visita';
  if (type === 'counseling') return 'Aconselhamento';
  if (type === 'prayer_request') return 'Pedido de oração';
  if (type === 'discipleship') return 'Discipulado';
  return type;
}

export default function PastoralTimeline() {
  const [searchMember, setSearchMember] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [textFilter, setTextFilter] = useState('');

  const { data: members = [] } = useMemberOptions(searchMember);
  const { data: timeline = [], isLoading } = usePastoralTimeline({ memberId: selectedMemberId || undefined });

  const filtered = useMemo(() => {
    const normalized = textFilter.trim().toLowerCase();
    if (!normalized) return timeline;
    return timeline.filter((item) => {
      const source = `${item.title} ${item.description || ''} ${item.status || ''}`.toLowerCase();
      return source.includes(normalized);
    });
  }, [textFilter, timeline]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
          <Calendar className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Timeline Pastoral</h1>
          <p className="text-slate-600">Linha do tempo unificada de visitas, aconselhamento, oração e discipulado.</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Buscar membro</label>
            <input
              value={searchMember}
              onChange={(event) => setSearchMember(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Digite nome do membro"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Filtrar por membro</label>
            <select
              value={selectedMemberId}
              onChange={(event) => setSelectedMemberId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Filtro textual</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={textFilter}
                onChange={(event) => setTextFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
                placeholder="Título, descrição ou status"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Eventos ({filtered.length})
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Carregando timeline pastoral...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-start gap-4 px-4 py-4">
                <div className="mt-0.5 rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
                  {typeLabel(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{item.title}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{item.status}</span>
                  </div>
                  {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(item.event_date).toLocaleString('pt-BR')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Filter className="h-3.5 w-3.5" />
                      Responsável: {item.responsible_name || '-'}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">Nenhum evento pastoral encontrado para os filtros selecionados.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
