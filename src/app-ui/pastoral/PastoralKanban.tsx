/**
 * Pipeline de Atendimento Pastoral — Quadro Kanban
 *
 * Módulo EXCLUSIVO do pastoral. NÃO compartilha dados com a Secretaria/CRM.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Heart,
  Phone,
  Mail,
  MessageCircle,
  Clock,
  Flag,
  Star,
  AlertTriangle,
  CheckCircle2,
  Circle,
  XCircle,
  Loader2,
  User,
  RefreshCw,
  LayoutGrid,
  List,
  Zap,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Printer,
} from 'lucide-react';
import {
  type PastoralPipelineColumn,
  type PastoralAttendance,
  type AttendanceType,
  type ColumnKey,
  type Priority,
  ATTENDANCE_TYPE_LABELS,
  ATTENDANCE_TYPE_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  getCurrentChurchId,
  listPastoralColumns,
  listPastoralAttendances,
  movePastoralAttendance,
  getPastoralKanbanSummary,
  updatePastoralAttendance,
  listPastoralNotes,
  listPastoralActivities,
  listPastoralTimeline,
} from '../../lib/pastoralKanbanService';
import { supabase } from '../../lib/supabaseClient';
import { PastoralAttendanceDetail } from './PastoralAttendanceDetail';
import { PastoralAttendanceNew } from './PastoralAttendanceNew';

// ─── Ícone de coluna ─────────────────────────────────────────────────────────

function ColumnIcon({ columnKey }: { columnKey: ColumnKey }) {
  if (columnKey === 'todo')      return <Circle       className="w-3 h-3" />;
  if (columnKey === 'doing')     return <Zap          className="w-3 h-3" />;
  if (columnKey === 'done')      return <CheckCircle2 className="w-3 h-3" />;
  if (columnKey === 'cancelled') return <XCircle      className="w-3 h-3" />;
  return null;
}

// ─── Card de atendimento ──────────────────────────────────────────────────────

function AttendanceCard({
  card,
  onDragStart,
  onClick,
  onStar,
}: {
  card: PastoralAttendance;
  onDragStart: (e: React.DragEvent, card: PastoralAttendance) => void;
  onClick: (card: PastoralAttendance) => void;
  onStar: (card: PastoralAttendance) => void;
}) {
  const personName =
    card.members?.full_name ||
    card.visitor_name ||
    card.title ||
    'Sem identificação';

  const typeColor = ATTENDANCE_TYPE_COLORS[card.attendance_type] ?? '#6366f1';
  const isOverdue =
    card.sla_date &&
    new Date(card.sla_date) < new Date() &&
    card.status !== 'done' &&
    card.status !== 'cancelled';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      onClick={() => onClick(card)}
      className={`group bg-white rounded-lg border cursor-grab active:cursor-grabbing
        hover:shadow-md transition-all duration-150 select-none
        ${isOverdue ? 'border-red-200' : 'border-slate-200'}
        ${card.is_starred ? 'ring-1 ring-amber-300' : ''}
      `}
    >
      <div className="p-3">
        {/* Type badge + star */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
            style={{ backgroundColor: `${typeColor}18`, color: typeColor }}
          >
            {ATTENDANCE_TYPE_LABELS[card.attendance_type] ?? card.attendance_type}
          </span>
          <div className="flex items-center gap-1">
            {isOverdue && <AlertTriangle className="w-3 h-3 text-red-500" />}
            {(card.priority === 'urgent' || card.priority === 'high') && (
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_COLORS[card.priority] }} />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onStar(card); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Star className={`w-3 h-3 ${card.is_starred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
            </button>
          </div>
        </div>

        {/* Name */}
        <p className="font-bold text-slate-800 text-sm leading-tight mb-1">
          {personName.toUpperCase()}
        </p>

        {/* Title/subtitle */}
        {card.title && card.title !== personName && (
          <p className="text-xs text-slate-500 mb-1 truncate">{card.title}</p>
        )}

        {/* Responsible */}
        {card.users?.full_name && (
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <User className="w-3 h-3" />{card.users.full_name}
          </p>
        )}

        {/* Church */}
        {card.churches?.name && (
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1 truncate">
            <Heart className="w-3 h-3 flex-shrink-0" />{card.churches.name}
          </p>
        )}

        {/* Footer: date + quick actions */}
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
          <span className={`text-xs ${isOverdue ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
            {card.sla_date ? new Date(card.sla_date).toLocaleDateString('pt-BR') : new Date(card.created_at).toLocaleDateString('pt-BR')}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {card.phone && (
              <button onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${card.phone?.replace(/\D/g,'')}`, '_blank'); }}
                className="p-1 rounded hover:bg-green-50 hover:text-green-600 text-slate-400 transition-colors">
                <MessageCircle className="w-3 h-3" />
              </button>
            )}
            {card.phone && (
              <button onClick={(e) => { e.stopPropagation(); window.open(`tel:${card.phone}`, '_blank'); }}
                className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 text-slate-400 transition-colors">
                <Phone className="w-3 h-3" />
              </button>
            )}
            {card.email && (
              <button onClick={(e) => { e.stopPropagation(); window.open(`mailto:${card.email}`, '_blank'); }}
                className="p-1 rounded hover:bg-purple-50 hover:text-purple-600 text-slate-400 transition-colors">
                <Mail className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Coluna do Kanban ─────────────────────────────────────────────────────────

function KanbanColumn({
  column,
  cards,
  onDragOver,
  onDrop,
  onDragStart,
  onCardClick,
  onStar,
  onNewCard,
}: {
  column: PastoralPipelineColumn;
  cards: PastoralAttendance[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, column: PastoralPipelineColumn) => void;
  onDragStart: (e: React.DragEvent, card: PastoralAttendance) => void;
  onCardClick: (card: PastoralAttendance) => void;
  onStar: (card: PastoralAttendance) => void;
  onNewCard: (column: PastoralPipelineColumn) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column header — compact, secretaria style */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg mb-2">
        <span style={{ color: column.color }}>
          <ColumnIcon columnKey={column.column_key} />
        </span>
        <span className="font-semibold text-slate-700 text-sm flex-1 truncate">
          {column.name}
        </span>
        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {cards.length}
        </span>
        <button className="p-0.5 rounded hover:bg-slate-100 text-slate-400">
          <Search className="w-3.5 h-3.5" />
        </button>
        <button className="p-0.5 rounded hover:bg-slate-100 text-slate-400">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cards area */}
      <div
        className={`flex flex-col gap-2 flex-1 min-h-[120px] rounded-lg p-1.5 transition-all ${
          isDragOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : 'bg-slate-100/60'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); onDragOver(e); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { setIsDragOver(false); onDrop(e, column); }}
      >
        {cards.map((card) => (
          <AttendanceCard
            key={card.id}
            card={card}
            onDragStart={onDragStart}
            onClick={onCardClick}
            onStar={onStar}
          />
        ))}

        {/* Add card button */}
        {(column.column_key === 'todo' || column.column_key === 'doing') && (
          <button
            onClick={() => onNewCard(column)}
            className="flex items-center gap-1.5 px-3 py-2 rounded border-2 border-dashed border-slate-200 text-slate-400 hover:border-green-300 hover:text-green-600 hover:bg-white transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Novo atendimento
          </button>
        )}
      </div>
    </div>
  );
}
// ─── Componente principal ─────────────────────────────────────────────────────

export default function PastoralKanban() {
  const churchId = getCurrentChurchId();
  const queryClient = useQueryClient();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('mrm_user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const isSecretary = user.profileType === 'church';

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<AttendanceType | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const _now = new Date();
  const _firstDay = new Date(_now.getFullYear(), _now.getMonth(), 1).toISOString().slice(0, 10);
  const _lastDay = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(_firstDay);
  const [dateTo, setDateTo] = useState(_lastDay);
  const [selectedRegionals, setSelectedRegionals] = useState<string[]>([]);
  const [filterChurchId, setFilterChurchId] = useState<string>(() => {
    try {
      const u = JSON.parse(localStorage.getItem('mrm_user') || '{}');
      if (u.profileType === 'church' && u.churchId) {
        return u.churchId;
      }
    } catch {}
    return '';
  });
  const [showRegionalDropdown, setShowRegionalDropdown] = useState(false);
  const [showChurchDropdown, setShowChurchDropdown] = useState(false);
  const regionalDropdownRef = useRef<HTMLDivElement>(null);
  const churchDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click (bubble phase + contains check)
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (regionalDropdownRef.current && !regionalDropdownRef.current.contains(e.target as Node)) {
        setShowRegionalDropdown(false);
      }
      if (churchDropdownRef.current && !churchDropdownRef.current.contains(e.target as Node)) {
        setShowChurchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);
  const [selectedCard, setSelectedCard] = useState<PastoralAttendance | null>(null);
  const [newCardColumn, setNewCardColumn] = useState<PastoralPipelineColumn | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const dragCardRef = useRef<PastoralAttendance | null>(null);

  // Regionais + Churches queries for filters with tenant isolation
  const { data: regionais = [] } = useQuery({
    queryKey: ['regionais-list', user],
    queryFn: async () => {
      let q = supabase.from('regionais').select('id, name').order('name');
      if (user.profileType === 'campo' && user.campoId) {
        q = q.eq('campo_id', user.campoId);
      }
      const { data } = await q;
      return (data ?? []) as { id: string; name: string }[];
    },
    staleTime: 60_000,
  });

  const { data: allChurches = [] } = useQuery({
    queryKey: ['churches-by-regionals', selectedRegionals, user],
    queryFn: async () => {
      let q = supabase.from('churches').select('id, name, regional_id').order('name');
      if (selectedRegionals.length > 0) {
        q = q.in('regional_id', selectedRegionals);
      } else if (user.profileType === 'campo' && user.campoId) {
        const { data: regionaisOfCampo } = await supabase
          .from('regionais')
          .select('id')
          .eq('campo_id', user.campoId);
        const regIds = regionaisOfCampo?.map((r) => r.id) || [];
        q = q.in('regional_id', regIds);
      }
      const { data } = await q.limit(500);
      return (data ?? []) as { id: string; name: string; regional_id: string }[];
    },
    staleTime: 30_000,
  });

  // Queries
  const { data: columns = [], isLoading: loadingColumns } = useQuery({
    queryKey: ['pastoral-kanban-columns', churchId],
    enabled: !!churchId,
    queryFn: () => listPastoralColumns(churchId!),
    staleTime: 30_000,
  });

  const { data: allCards = [], isLoading: loadingCards } = useQuery({
    queryKey: ['pastoral-kanban-cards', churchId, filterChurchId, search, filterType, filterPriority, allChurches, user],
    enabled: !!churchId,
    queryFn: () => {
      const isCampo = user.profileType === 'campo';
      const useMultiChurch = isCampo && !filterChurchId;
      const churchIds = useMultiChurch ? allChurches.map((c) => c.id) : undefined;

      if (useMultiChurch && (!churchIds || churchIds.length === 0)) {
        return [];
      }

      return listPastoralAttendances({
        churchId: filterChurchId || (useMultiChurch ? undefined : churchId!),
        churchIds,
        search,
        attendanceType: filterType,
        priority: filterPriority,
      });
    },
    staleTime: 10_000,
  });

  const { data: summary } = useQuery({
    queryKey: ['pastoral-kanban-summary', churchId],
    enabled: !!churchId,
    queryFn: () => getPastoralKanbanSummary(churchId!),
    staleTime: 15_000,
  });

  // Move mutation
  const moveMutation = useMutation({
    mutationFn: movePastoralAttendance,
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['pastoral-kanban-cards'] });
      void queryClient.invalidateQueries({ queryKey: ['pastoral-kanban-summary'] });

      // Trigger status_changed notification
      const statusMap: Record<ColumnKey, string> = {
        todo: 'open',
        doing: 'doing',
        done: 'done',
        cancelled: 'cancelled',
      };

      const newStatus = statusMap[variables.targetColumnKey];
      void fetch('/api/pastoral/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'status_changed',
          attendanceId: variables.attendanceId,
          newStatus,
        }),
      }).catch((err) => {
        console.error('Failed to trigger status_changed notification:', err);
      });
    },
  });

  // Star mutation
  const starMutation = useMutation({
    mutationFn: ({ id, is_starred }: { id: string; is_starred: boolean }) =>
      updatePastoralAttendance(id, { is_starred }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['pastoral-kanban-cards'] }),
  });

  const isLoading = loadingColumns || loadingCards;

  // Apply date + regional filter client-side (kanban + table)
  const regionalChurchIds = selectedRegionals.length > 0
    ? new Set(allChurches.map((c) => c.id))
    : null;
  const dateFilteredCards = allCards.filter((c) => {
    if (dateFrom && new Date(c.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(c.created_at) > new Date(dateTo + 'T23:59:59')) return false;
    if (regionalChurchIds && !filterChurchId && !regionalChurchIds.has(c.church_id)) return false;
    return true;
  });
  const tableCards = dateFilteredCards;

  async function handlePrintPipeline() {
    if (dateFilteredCards.length === 0) {
      alert("Não há atendimentos para imprimir com os filtros aplicados.");
      return;
    }

    try {
      setIsPrinting(true);

      // Fetch details for all cards in parallel
      const cardsWithDetails = await Promise.all(
        dateFilteredCards.map(async (card) => {
          const [notes, activities, timeline] = await Promise.all([
            listPastoralNotes(card.id).catch(() => []),
            listPastoralActivities(card.id).catch(() => []),
            listPastoralTimeline(card.id).catch(() => []),
          ]);
          return {
            ...card,
            notesList: notes,
            activitiesList: activities,
            timelineList: timeline,
          };
        })
      );

      const printDate = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      // Build HTML content
      let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Relatório do Pipeline Pastoral</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #1e293b; padding: 15px; background: white; }
    .header { border-bottom: 2px solid #22c55e; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header-title { font-size: 16px; font-weight: bold; color: #1e293b; text-transform: uppercase; }
    .header-sub { font-size: 9px; color: #64748b; margin-top: 3px; }
    .header-brand { font-size: 10px; font-weight: bold; color: #22c55e; }
    
    .card-section { margin-bottom: 25px; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; background: #fff; }
    .card-header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
    .card-person { font-size: 14px; font-weight: bold; color: #0f172a; text-transform: uppercase; }
    .card-type-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: bold; text-transform: uppercase; margin-top: 3px; }
    
    .card-meta-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 8px; font-size: 9.5px; color: #334155; margin-bottom: 8px; }
    .meta-item { background: #f8fafc; padding: 6px; border-radius: 4px; border: 1px solid #f1f5f9; }
    .meta-label { font-weight: bold; color: #64748b; font-size: 8px; text-transform: uppercase; display: block; margin-bottom: 2px; }
    
    .card-notes-desc { background: #fdfdfd; border-left: 3px solid #cbd5e1; padding: 8px; font-size: 9.5px; color: #334155; margin-top: 10px; white-space: pre-wrap; }
    
    .sub-section { margin-top: 15px; }
    .sub-section-title { font-size: 10px; font-weight: bold; color: #334155; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9px; }
    th, td { border: 1px solid #e2e8f0; padding: 5px 6px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: bold; color: #475569; text-transform: uppercase; font-size: 8px; }
    tr:nth-child(even) td { background: #fafafa; }
    .empty-text { font-style: italic; color: #94a3b8; font-size: 9px; padding: 4px 0; }
    
    .page-break { page-break-after: always; }
    @media print {
      body { padding: 0; }
      .page-break { page-break-after: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="header-title">Relatório de Atendimentos Pastorais</h1>
      <p class="header-sub">Filtros aplicados · Gerado em: ${printDate}</p>
    </div>
    <div class="header-brand">SISTEMA MRM</div>
  </div>
`;

      const typeLabels: Record<string, string> = {
        visita_pastoral: 'Visita Pastoral',
        aconselhamento: 'Aconselhamento',
        discipulado: 'Discipulado',
        pedido_oracao: 'Pedido de Oração',
        followup: 'Follow-up',
        emergencial: 'Atendimento Emergencial',
        reconciliacao: 'Reconciliação',
        familiar: 'Atendimento Familiar',
        jovem: 'Atendimento Jovem',
        infantil: 'Atendimento Infantil',
        financeiro: 'Atendimento Financeiro',
        ministerial: 'Atendimento Ministerial',
        online: 'Atendimento Online',
        presencial: 'Atendimento Presencial',
        casamento: 'Casamento',
        apresentacao_criancas: 'Apresentação de Crianças'
      };

      const priorityLabels: Record<string, string> = {
        low: 'Baixa',
        normal: 'Normal',
        high: 'Alta',
        urgent: 'Urgente'
      };

      const activityTypeLabels: Record<string, string> = {
        visit: 'Visita',
        call: 'Ligação',
        meeting: 'Reunião',
        prayer: 'Oração',
        counseling: 'Aconselhamento',
        other: 'Outro'
      };

      cardsWithDetails.forEach((card, index) => {
        const personName = card.members?.full_name || card.visitor_name || card.title || 'Sem identificação';
        const columnName = columns.find(c => c.id === card.column_id)?.name || 'Sem coluna';
        const typeColor = ATTENDANCE_TYPE_COLORS[card.attendance_type] ?? '#6366f1';
        const typeLabel = typeLabels[card.attendance_type] || card.attendance_type;

        htmlContent += `
        <div class="card-section ${index < cardsWithDetails.length - 1 ? 'page-break' : ''}">
          <div class="card-header-row">
            <div>
              <h2 class="card-person">${personName}</h2>
              <span class="card-type-badge" style="background-color: ${typeColor}15; color: ${typeColor};">${typeLabel}</span>
            </div>
            <div style="text-align: right; font-size: 9px; color: #64748b;">
              <strong>Abertura:</strong> ${new Date(card.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
          
          <div class="card-meta-grid">
            <div class="meta-item">
              <span class="meta-label">Status</span>
              <strong>${columnName}</strong>
            </div>
            <div class="meta-item">
              <span class="meta-label">Prioridade</span>
              <strong>${priorityLabels[card.priority] || card.priority}</strong>
            </div>
            <div class="meta-item">
              <span class="meta-label">Responsável</span>
              <strong>${card.users?.full_name || 'Sem responsável'}</strong>
            </div>
            <div class="meta-item">
              <span class="meta-label">Congregação</span>
              <strong>${card.churches?.name || 'Sem congregação'}</strong>
            </div>
          </div>

          <div class="card-meta-grid" style="grid-template-cols: 1fr 1fr; margin-top: 5px;">
            <div class="meta-item">
              <span class="meta-label">WhatsApp / Telefone</span>
              <strong>${card.phone || '—'}</strong>
            </div>
            <div class="meta-item">
              <span class="meta-label">E-mail</span>
              <strong>${card.email || '—'}</strong>
            </div>
          </div>

          ${card.notes ? `
          <div class="card-notes-desc">
            <strong>Notas/Descrição Inicial:</strong><br/>${card.notes}
          </div>
          ` : ''}

          <!-- NOTAS -->
          <div class="sub-section">
            <h3 class="sub-section-title">Notas / Comentários (${card.notesList.length})</h3>
            ${card.notesList.length === 0 ? '<p class="empty-text">Nenhuma nota cadastrada.</p>' : `
            <table>
              <thead>
                <tr>
                  <th style="width: 15%">Data</th>
                  <th style="width: 25%">Autor</th>
                  <th>Conteúdo</th>
                </tr>
              </thead>
              <tbody>
                ${card.notesList.map((n: any) => `
                  <tr>
                    <td>${new Date(n.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>${n.users?.full_name || '—'}</td>
                    <td>${n.content}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            `}
          </div>

          <!-- ATIVIDADES -->
          <div class="sub-section">
            <h3 class="sub-section-title">Atividades Agendadas (${card.activitiesList.length})</h3>
            ${card.activitiesList.length === 0 ? '<p class="empty-text">Nenhuma atividade registrada.</p>' : `
            <table>
              <thead>
                <tr>
                  <th style="width: 15%">Data/SLA</th>
                  <th style="width: 15%">Tipo</th>
                  <th style="width: 30%">Título</th>
                  <th style="width: 15%">Status</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                ${card.activitiesList.map((act: any) => `
                  <tr>
                    <td>${act.scheduled_date ? new Date(act.scheduled_date).toLocaleDateString('pt-BR') : '—'}</td>
                    <td>${activityTypeLabels[act.activity_type] || act.activity_type}</td>
                    <td>${act.title}</td>
                    <td>${act.completed ? 'Concluída' : 'Pendente'}</td>
                    <td>${act.description || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            `}
          </div>

          <!-- LINHA DO TEMPO -->
          <div class="sub-section">
            <h3 class="sub-section-title">Linha do Tempo / Histórico de Movimentações (${card.timelineList.length})</h3>
            ${card.timelineList.length === 0 ? '<p class="empty-text">Nenhuma movimentação registrada.</p>' : `
            <table>
              <thead>
                <tr>
                  <th style="width: 20%">Data/Hora</th>
                  <th style="width: 15%">Tipo</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                ${card.timelineList.map((t: any) => `
                  <tr>
                    <td>${new Date(t.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${t.event_type.toUpperCase()}</td>
                    <td>${t.description}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            `}
          </div>
        </div>
        `;
      });

      htmlContent += `
</body>
</html>
      `;

      // Print in hidden iframe
      const printFrame = document.createElement('iframe');
      printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(printFrame);
      const fw = printFrame.contentWindow!;
      fw.document.open();
      fw.document.write(htmlContent);
      fw.document.close();

      const cleanup = () => {
        if (document.body.contains(printFrame)) printFrame.remove();
      };
      window.addEventListener('focus', cleanup, { once: true });
      fw.focus();
      fw.print();
    } catch (error) {
      console.error("Failed to generate pipeline printout:", error);
      alert("Erro ao gerar a visualização de impressão. Tente novamente.");
    } finally {
      setIsPrinting(false);
    }
  }

  // Group cards by column (respecting date filter)
  const cardsByColumn = columns.reduce<Record<string, PastoralAttendance[]>>((acc, col) => {
    acc[col.id] = dateFilteredCards.filter((c) => c.column_id === col.id);
    return acc;
  }, {});

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, card: PastoralAttendance) => {
    dragCardRef.current = card;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetColumn: PastoralPipelineColumn) => {
      e.preventDefault();
      const card = dragCardRef.current;
      if (!card || card.column_id === targetColumn.id) return;

      moveMutation.mutate({
        attendanceId: card.id,
        targetColumnId: targetColumn.id,
        targetColumnKey: targetColumn.column_key,
        targetColumnName: targetColumn.name,
        churchId: churchId!,
      });

      dragCardRef.current = null;
    },
    [moveMutation, churchId],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* ── Topbar ── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-5 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
              <Heart className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Pipeline de Atendimento Pastoral</h1>
              <p className="text-xs text-slate-500">Gestão pastoral centralizada em kanban</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['pastoral-kanban-cards'] })}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrintPipeline}
              disabled={isPrinting}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              title="Imprimir Relatório do Pipeline"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
            </button>
            {/* View mode toggle */}
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${viewMode === 'kanban' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            {columns.length > 0 && (
              <button
                onClick={() => setNewCardColumn(columns.find((c) => c.column_key === 'todo') ?? columns[0])}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Atendimento
              </button>
            )}
          </div>
        </div>

        {/* Métricas */}
        {summary && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
            <MetricBadge label="Por fazer" value={summary.open} color="#94a3b8" />
            <MetricBadge label="Fazendo" value={summary.doing} color="#3b82f6" />
            <MetricBadge label="Concluído" value={summary.done} color="#22c55e" />
            <MetricBadge label="Cancelado" value={summary.cancelled} color="#ef4444" />
            {summary.overdue > 0 && (
              <MetricBadge label="Atrasados" value={summary.overdue} color="#ef4444" icon={<AlertTriangle className="w-3 h-3" />} />
            )}
            {summary.urgent > 0 && (
              <MetricBadge label="Urgentes" value={summary.urgent} color="#f59e0b" icon={<AlertTriangle className="w-3 h-3" />} />
            )}
          </div>
        )}

        {/* Filtros — sempre visível, linha única */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar pessoa, título..."
                  className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-44"
                />
              </div>
              {/* Type */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as AttendanceType | 'all')}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white"
              >
                <option value="all">Todos os tipos</option>
                {(Object.entries(ATTENDANCE_TYPE_LABELS) as [AttendanceType, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              {/* Priority */}
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as Priority | 'all')}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white"
              >
                <option value="all">Todas as prioridades</option>
                <option value="urgent">Urgente</option>
                <option value="high">Alta</option>
                <option value="normal">Normal</option>
                <option value="low">Baixa</option>
              </select>
              {/* Date range */}
              <div className="flex items-center gap-1">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white" />
                <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white" />
              </div>

              {!isSecretary && (
                <>
                  {/* Regionais multi-select */}
                  <div className="relative" ref={regionalDropdownRef}>
                    <button
                      onClick={() => { setShowRegionalDropdown((v) => !v); setShowChurchDropdown(false); }}
                      className="flex items-center gap-2 min-w-[160px] text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 hover:border-slate-300"
                    >
                      <span className="flex-1 text-left truncate">
                        {selectedRegionals.length === 0
                          ? 'Todas as regionais'
                          : selectedRegionals.length === 1
                            ? (regionais.find((r) => r.id === selectedRegionals[0])?.name ?? '1 regional')
                            : `${selectedRegionals.length} regionais`}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    </button>
                    {showRegionalDropdown && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg w-56 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
                          <span className="text-xs text-slate-500 flex-1 font-medium">regional</span>
                          <button onClick={() => setSelectedRegionals(regionais.map((r) => r.id))}
                            className="text-xs text-blue-600 hover:underline">Marcar todas</button>
                          <button onClick={() => setSelectedRegionals([])}
                            className="text-xs text-slate-500 hover:underline">Desmarcar</button>
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {regionais.map((r) => {
                            const checked = selectedRegionals.includes(r.id);
                            return (
                              <label key={r.id}
                                className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                                <input
                                  type="checkbox" checked={checked}
                                  onChange={() => {
                                    setSelectedRegionals((prev) =>
                                      checked ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                                    );
                                    setFilterChurchId('');
                                  }}
                                  className="rounded border-slate-300 accent-green-600"
                                />
                                {r.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Igrejas select */}
                  <div className="relative" ref={churchDropdownRef}>
                    <button
                      onClick={() => { setShowChurchDropdown((v) => !v); setShowRegionalDropdown(false); }}
                      className="flex items-center gap-2 min-w-[180px] text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 hover:border-slate-300"
                    >
                      <span className="flex-1 text-left truncate">
                        {filterChurchId
                          ? (allChurches.find((c) => c.id === filterChurchId)?.name ?? 'Igreja selecionada')
                          : 'Todos as Igrejas'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    </button>
                    {showChurchDropdown && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg w-64 overflow-hidden">
                        <div className="max-h-60 overflow-y-auto">
                          <button
                            onClick={() => { setFilterChurchId(''); setShowChurchDropdown(false); }}
                            className={`flex items-center gap-2 w-full px-3 py-2.5 text-sm hover:bg-slate-50 text-left border-b border-slate-100 ${!filterChurchId ? 'text-green-700 font-semibold' : 'text-slate-700'}`}
                          >
                            {!filterChurchId && <Check className="w-3.5 h-3.5 text-green-600" />}
                            <span className={!filterChurchId ? '' : 'pl-5'}>Todos as Igrejas</span>
                          </button>
                          {allChurches.map((c) => (
                            <button key={c.id}
                              onClick={() => { setFilterChurchId(c.id); setShowChurchDropdown(false); }}
                              className={`flex items-center gap-2 w-full px-3 py-2.5 text-sm hover:bg-slate-50 text-left ${filterChurchId === c.id ? 'text-green-700 font-semibold' : 'text-slate-700'}`}
                            >
                              {filterChurchId === c.id && <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                              <span className={filterChurchId === c.id ? '' : 'pl-5'}>{c.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Limpar filtros */}
              {(search || filterType !== 'all' || filterPriority !== 'all' || (isSecretary ? filterChurchId !== user.churchId : filterChurchId) || selectedRegionals.length > 0) && (
                <button
                  onClick={() => {
                    setSearch(''); setFilterType('all'); setFilterPriority('all');
                    setDateFrom(_firstDay); setDateTo(_lastDay);
                    setSelectedRegionals([]); setFilterChurchId(isSecretary ? (user.churchId || '') : '');
                  }}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors ml-1"
                >
                  <X className="w-3 h-3" /> Limpar filtros
                </button>
              )}
            </div>
          </div>
      </div>

      {/* ── Board ── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Carregando pipeline pastoral...
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="flex gap-4 p-5 h-full items-start overflow-x-auto overflow-y-auto">
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                cards={cardsByColumn[col.id] ?? []}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onDragStart={handleDragStart}
                onCardClick={setSelectedCard}
                onStar={(card) => starMutation.mutate({ id: card.id, is_starred: !card.is_starred })}
                onNewCard={setNewCardColumn}
              />
            ))}
          </div>
        ) : (
          /* ── Table View ── */
          <div className="p-5">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Pessoa</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Etapa</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Responsável</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Abertura</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">SLA</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Prioridade</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {tableCards.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        Nenhum atendimento encontrado.
                      </td>
                    </tr>
                  ) : tableCards.map((card) => {
                    const personName = card.members?.full_name || card.visitor_name || card.title || '—';
                    const colName = columns.find((c) => c.id === card.column_id)?.name ?? '—';
                    const colColor = columns.find((c) => c.id === card.column_id)?.color ?? '#94a3b8';
                    const typeColor = ATTENDANCE_TYPE_COLORS[card.attendance_type] ?? '#6366f1';
                    const isOverdue = card.sla_date && new Date(card.sla_date) < new Date() && card.status !== 'done' && card.status !== 'cancelled';
                    return (
                      <tr key={card.id} onClick={() => setSelectedCard(card)}
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800 uppercase text-sm">{personName}</p>
                          {card.title && card.title !== personName && <p className="text-xs text-slate-400 truncate max-w-[200px]">{card.title}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold"
                            style={{ backgroundColor: `${typeColor}18`, color: typeColor }}>
                            {ATTENDANCE_TYPE_LABELS[card.attendance_type]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold"
                            style={{ backgroundColor: `${colColor}18`, color: colColor }}>
                            {colName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{card.users?.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{new Date(card.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3 text-xs">
                          {card.sla_date ? (
                            <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                              {new Date(card.sla_date).toLocaleDateString('pt-BR')}
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold"
                            style={{ backgroundColor: `${PRIORITY_COLORS[card.priority]}18`, color: PRIORITY_COLORS[card.priority] }}>
                            {PRIORITY_LABELS[card.priority]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button className="p-1 rounded hover:bg-slate-100 text-slate-400">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {selectedCard && (
        <PastoralAttendanceDetail
          attendanceId={selectedCard.id}
          columns={columns}
          onClose={() => setSelectedCard(null)}
          onMoved={() => {
            void queryClient.invalidateQueries({ queryKey: ['pastoral-kanban-cards'] });
            setSelectedCard(null);
          }}
        />
      )}

      {/* ── New Card Modal ── */}
      {newCardColumn && (
        <PastoralAttendanceNew
          column={newCardColumn}
          columns={columns}
          onClose={() => setNewCardColumn(null)}
          onCreated={() => {
            void queryClient.invalidateQueries({ queryKey: ['pastoral-kanban-cards'] });
            void queryClient.invalidateQueries({ queryKey: ['pastoral-kanban-summary'] });
            setNewCardColumn(null);
          }}
        />
      )}
    </div>
  );
}

function MetricBadge({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-600">
      {icon ? <span style={{ color }}>{icon}</span> : <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
      <span>{label}:</span>
      <span className="font-bold" style={{ color }}>{value}</span>
    </div>
  );
}
