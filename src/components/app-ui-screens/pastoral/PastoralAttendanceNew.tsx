/**
 * PastoralAttendanceNew — Modal para criar novo atendimento pastoral
 *
 * Módulo EXCLUSIVO do pastoral. NÃO compartilha dados com a Secretaria/CRM.
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Save, Loader2, Search, User } from 'lucide-react';
import {
  type PastoralPipelineColumn,
  type AttendanceType,
  type Priority,
  ATTENDANCE_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  getCurrentChurchId,
  createPastoralAttendance,
} from '../../lib/pastoralKanbanService';
import { supabase } from '../../lib/supabaseClient';

interface MemberOption {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
}

export function PastoralAttendanceNew({
  column,
  columns,
  onClose,
  onCreated,
}: {
  column: PastoralPipelineColumn;
  columns: PastoralPipelineColumn[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const churchId = getCurrentChurchId();
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberOption | null>(null);
  const [form, setForm] = useState({
    title: '',
    attendanceType: 'visita_pastoral' as AttendanceType,
    priority: 'normal' as Priority,
    columnId: column.id,
    visitorName: '',
    phone: '',
    email: '',
    slaDate: '',
    description: '',
  });

  // Member search
  const { data: members = [], isLoading: searchLoading } = useQuery({
    queryKey: ['pastoral-member-search', churchId, memberSearch],
    enabled: !!churchId && memberSearch.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from('members')
        .select('id, full_name, phone, email')
        .eq('church_id', churchId)
        .ilike('full_name', `%${memberSearch}%`)
        .limit(8);
      return (data ?? []) as MemberOption[];
    },
    staleTime: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createPastoralAttendance({
        churchId: churchId!,
        columnId: form.columnId,
        title: form.title || form.visitorName || selectedMember?.full_name || 'Sem título',
        attendanceType: form.attendanceType,
        priority: form.priority,
        memberId: selectedMember?.id,
        visitorName: !selectedMember ? form.visitorName || undefined : undefined,
        phone: form.phone || selectedMember?.phone || undefined,
        email: form.email || selectedMember?.email || undefined,
        slaDate: form.slaDate || undefined,
        description: form.description || undefined,
      }),
    onSuccess: onCreated,
  });

  const selectMember = (m: MemberOption) => {
    setSelectedMember(m);
    setMemberSearch(m.full_name);
    if (!form.phone && m.phone) setForm((f) => ({ ...f, phone: m.phone! }));
    if (!form.email && m.email) setForm((f) => ({ ...f, email: m.email! }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Novo Atendimento Pastoral</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Membro / visitante */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Membro da Igreja</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={memberSearch}
                onChange={(e) => { setMemberSearch(e.target.value); setSelectedMember(null); }}
                placeholder="Buscar membro cadastrado..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            {memberSearch.length >= 2 && !selectedMember && (
              <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  </div>
                ) : members.length > 0 ? (
                  members.map((m) => (
                    <button key={m.id} onClick={() => selectMember(m)}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-green-50 text-left border-b border-slate-100 last:border-0">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{m.full_name}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2.5 text-sm text-slate-400">Nenhum membro encontrado</div>
                )}
              </div>
            )}
          </div>

          {!selectedMember && (
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Ou nome do visitante</label>
              <input
                value={form.visitorName}
                onChange={(e) => setForm((f) => ({ ...f, visitorName: e.target.value }))}
                placeholder="Nome completo do visitante"
                className="w-full px-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          {/* Tipo + Prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Tipo de Atendimento *</label>
              <select value={form.attendanceType} onChange={(e) => setForm((f) => ({ ...f, attendanceType: e.target.value as AttendanceType }))}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white">
                {(Object.entries(ATTENDANCE_TYPE_LABELS) as [AttendanceType, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Prioridade</label>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white">
                {(Object.entries(PRIORITY_LABELS) as [Priority, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Coluna */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Coluna inicial</label>
            <select value={form.columnId} onChange={(e) => setForm((f) => ({ ...f, columnId: e.target.value }))}
              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white">
              {columns.map((col) => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </div>

          {/* Assunto / título */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Assunto / Título</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Resumo do atendimento"
              className="w-full px-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          {/* Contato */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Telefone / WhatsApp</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
                className="w-full px-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">E-mail</label>
              <input value={form.email} type="email" onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
                className="w-full px-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          {/* SLA */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Data limite (SLA)</label>
            <input type="date" value={form.slaDate} onChange={(e) => setForm((f) => ({ ...f, slaDate: e.target.value }))}
              className="w-full px-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Descrição / Observações</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3} placeholder="Contexto do atendimento..."
              className="w-full px-4 py-2 text-sm border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
          <button onClick={onClose} className="px-5 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || (!selectedMember && !form.visitorName.trim())}
            className="flex items-center gap-1.5 px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Criar Atendimento
          </button>
        </div>
      </div>
    </div>
  );
}
