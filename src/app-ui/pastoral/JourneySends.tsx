/**
 * Acompanhamento do Cronograma — a tela de resultado dos disparos.
 *
 * Responde o que o kanban não responde: o que foi enviado, para quem, quando,
 * por qual etapa da matriz, se a pessoa respondeu — e permite continuar a
 * conversa ali mesmo, como num chat. Filtra por dia, semana, mês ou intervalo.
 *
 * A conversa recarrega ao reabrir a linha e no botão de atualizar; ainda não é
 * realtime (a Caixa de Entrada é quem tem o canal aberto do Supabase).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Loader2,
  Send,
  RefreshCw,
  Smartphone,
  CalendarClock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  X,
  PauseCircle,
  PlayCircle,
  Ban,
  Sparkles,
  TrendingUp,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  JOURNEY_PROFILES,
  JOURNEY_PROFILE_LABELS,
  JOURNEY_PROFILE_COLORS,
  type JourneyProfile,
} from '../../lib/pastoralJourneyDefault';
import { getCurrentChurchId } from '../../lib/pastoralKanbanService';
import { useWhatsAppInstances } from '../../hooks/useWhatsAppInstances';
import DateRangeFilter, { currentMonthRange } from './DateRangeFilter';
import { exportRows } from './exportUtils';
import { JourneyAnalysisModal } from './JourneyAnalysisModal';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function fmtPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length >= 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface JourneySendRow {
  id: string;
  enrollmentId: string;
  stepId: string;
  /** posição da mensagem na jornada da pessoa (1 de 13, 2 de 13…) */
  sequence: number | null;
  totalSteps: number | null;
  aiPolished: boolean;
  originalMessage: string | null;
  stepPosition: number;
  stepLabel: string;
  stepProgram: string;
  channel: string;
  attendanceId: string | null;
  profile: JourneyProfile;
  name: string | null;
  phone: string;
  message: string;
  status: 'pending' | 'sending' | 'sent' | 'error' | 'skipped' | 'cancelled';
  scheduledAt: string;
  sentAt: string | null;
  errorMessage: string | null;
  conversationId: string | null;
  replied: boolean;
  lastInboundAt: string | null;
  lastMessage: string | null;
}

interface StepOption {
  id: string;
  position: number;
  moment_label: string;
}

interface ChatMessage {
  id: string;
  content: string | null;
  type: string;
  direction: 'inbound' | 'outbound';
  status: string;
  created_at: string;
}

interface JourneyOption {
  id: string;
  name: string;
}

const STATUS_LABELS: Record<JourneySendRow['status'], string> = {
  pending: 'Na fila',
  sending: 'Enviando',
  sent: 'Enviada',
  error: 'Erro',
  skipped: 'Ignorada',
  cancelled: 'Cancelada',
};

const STATUS_STYLES: Record<JourneySendRow['status'], string> = {
  pending: 'bg-slate-100 text-slate-500',
  sending: 'bg-blue-50 text-blue-600',
  sent: 'bg-emerald-50 text-emerald-700',
  error: 'bg-red-50 text-red-600',
  skipped: 'bg-slate-100 text-slate-400',
  cancelled: 'bg-slate-100 text-slate-400',
};

export default function JourneySends() {
  const churchId = getCurrentChurchId();
  const { instances } = useWhatsAppInstances();
  const connectedInstances = useMemo(
    () => instances.filter(i => i.status === 'connected'),
    [instances]
  );

  // filtros
  const [{ from: dateFrom, to: dateTo }, setDateRange] = useState(currentMonthRange);
  const [dateField, setDateField] = useState<'sent' | 'scheduled'>('sent');
  const [journeyId, setJourneyId] = useState('');
  const [status, setStatus] = useState('');
  const [profile, setProfile] = useState('');
  const [stepId, setStepId] = useState('');
  const [q, setQ] = useState('');

  const [journeys, setJourneys] = useState<JourneyOption[]>([]);
  const [rows, setRows] = useState<JourneySendRow[]>([]);
  const [steps, setSteps] = useState<StepOption[]>([]);
  const [loading, setLoading] = useState(false);

  // drawer de conversa
  const [openRow, setOpenRow] = useState<JourneySendRow | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [instanceId, setInstanceId] = useState('');
  const replyInputRef = useRef<HTMLInputElement>(null);

  // análise geral da campanha + parecer por conversa
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [smartLoadingId, setSmartLoadingId] = useState<string | null>(null);
  const [smart, setSmart] = useState<{
    resumo: string; quem_mais_falou: string; analise: string; mensagem_sugerida: string;
  } | null>(null);

  useEffect(() => {
    if (!instanceId && connectedInstances.length) setInstanceId(connectedInstances[0].id);
  }, [connectedInstances, instanceId]);

  useEffect(() => {
    (async () => {
      try {
        const params = churchId ? `?churchId=${churchId}` : '';
        const res = await fetch(`/api/pastoral/journeys${params}`, { headers: authHeaders() });
        const data = await res.json();
        setJourneys(data.journeys ?? []);
      } catch {
        setJourneys([]);
      }
    })();
  }, [churchId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '1000', dateField });
      if (churchId) params.set('churchId', churchId);
      if (journeyId) params.set('journeyId', journeyId);
      if (status) params.set('status', status);
      if (profile) params.set('profile', profile);
      if (stepId) params.set('stepId', stepId);
      if (q.trim()) params.set('q', q.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/pastoral/journeys/sends?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao buscar envios');
      setRows(data.sends ?? []);
      setSteps(data.steps ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar envios');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [churchId, journeyId, status, profile, stepId, q, dateFrom, dateTo, dateField]);

  // presets de data são clique (sem Enter), então recarrega junto com os selects
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, dateField, journeyId, status, profile, stepId]);

  const totals = useMemo(() => {
    const acc = { sent: 0, replied: 0, pending: 0, error: 0 };
    for (const r of rows) {
      if (r.status === 'sent') acc.sent++;
      if (r.status === 'pending' || r.status === 'sending') acc.pending++;
      if (r.status === 'error') acc.error++;
      if (r.replied) acc.replied++;
    }
    return acc;
  }, [rows]);

  // ── conversa ────────────────────────────────────────────────────────────────
  const openConversation = async (row: JourneySendRow) => {
    setOpenRow(row);
    setMessages([]);
    setReplyText('');
    if (!row.conversationId) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(
        `/api/whatsapp/messages?conversationId=${row.conversationId}&limit=200`,
        { headers: authHeaders() }
      );
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      /* sem histórico */
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendReply = async () => {
    const content = replyText.trim();
    if (!openRow || !content || replySending) return;
    if (!instanceId) {
      toast.warning('Selecione uma instância para responder.');
      return;
    }
    setReplySending(true);
    try {
      const res = await fetch('/api/whatsapp/send-direct', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          instanceId,
          phone: openRow.phone,
          message: content,
          contactName: openRow.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha no envio');
      setMessages(prev => [
        ...prev,
        {
          id: `local_${Date.now()}`,
          content,
          type: 'text',
          direction: 'outbound',
          status: 'sent',
          created_at: new Date().toISOString(),
        },
      ]);
      setReplyText('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no envio');
    } finally {
      setReplySending(false);
    }
  };

  /**
   * Parecer da IA sobre UMA conversa: resumo, o que houve e a mensagem
   * sugerida para retomar o contato quando a pessoa não respondeu.
   * Reaproveita o endpoint Smart já usado na aba Envios.
   */
  const runSmart = async (row: JourneySendRow) => {
    if (!row.conversationId || smartLoadingId) return;
    setSmartLoadingId(row.id);
    setSmart(null);
    try {
      if (!openRow || openRow.id !== row.id) await openConversation(row);
      const res = await fetch(`/api/whatsapp/conversations/${row.conversationId}/smart`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar o parecer');
      setSmart(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar o parecer');
    } finally {
      setSmartLoadingId(null);
    }
  };

  // ── controle do acompanhamento da pessoa ────────────────────────────────────
  const setEnrollmentStatus = async (
    enrollmentId: string,
    next: 'active' | 'paused' | 'cancelled'
  ) => {
    try {
      const res = await fetch('/api/pastoral/journeys/enrollments', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ enrollmentIds: [enrollmentId], status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao atualizar');
      toast.success(
        next === 'paused'
          ? 'Acompanhamento pausado'
          : next === 'cancelled'
            ? 'Acompanhamento encerrado'
            : 'Acompanhamento retomado'
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao atualizar');
    }
  };

  const exportSends = (format: 'csv' | 'xlsx') => {
    exportRows(
      rows.map(r => ({
        Nome: r.name ?? '',
        Telefone: fmtPhone(r.phone),
        Grupo: JOURNEY_PROFILE_LABELS[r.profile] ?? r.profile,
        Etapa: r.stepLabel,
        Programação: r.stepProgram,
        Canal: r.channel,
        Status: STATUS_LABELS[r.status] ?? r.status,
        'Agendada para': fmtDateTime(r.scheduledAt),
        'Enviada em': fmtDateTime(r.sentAt),
        Respondeu: r.replied ? 'Sim' : 'Não',
        'Respondeu em': r.lastInboundAt ? fmtDateTime(r.lastInboundAt) : '',
        Erro: r.errorMessage ?? '',
        Mensagem: r.message,
      })),
      'cronograma-envios',
      format
    );
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-end gap-2">
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(from, to) => setDateRange({ from, to })}
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Data por</label>
          <select
            value={dateField}
            onChange={e => setDateField(e.target.value as 'sent' | 'scheduled')}
            className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white"
          >
            <option value="sent">Envio</option>
            <option value="scheduled">Agendamento</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Cronograma</label>
          <select
            value={journeyId}
            onChange={e => setJourneyId(e.target.value)}
            className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white min-w-[150px]"
          >
            <option value="">Todos</option>
            {journeys.map(j => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Grupo</label>
          <select
            value={profile}
            onChange={e => setProfile(e.target.value)}
            className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white min-w-[150px]"
          >
            <option value="">Todos</option>
            {JOURNEY_PROFILES.map(p => (
              <option key={p} value={p}>
                {JOURNEY_PROFILE_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Etapa</label>
          <select
            value={stepId}
            onChange={e => setStepId(e.target.value)}
            className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white min-w-[160px] max-w-[220px]"
          >
            <option value="">Todas</option>
            {steps.map(s => (
              <option key={s.id} value={s.id}>
                {s.moment_label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Situação</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white"
          >
            <option value="">Todas</option>
            <option value="sent">Enviada</option>
            <option value="pending">Na fila</option>
            <option value="error">Erro</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-xs font-medium text-slate-500">Nome, telefone ou texto</label>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Digite para buscar..."
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="h-9 px-4 rounded-lg bg-slate-800 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar
        </button>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Smartphone className="w-3 h-3" /> Instância (resposta)
          </label>
          <select
            value={instanceId}
            onChange={e => setInstanceId(e.target.value)}
            className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white min-w-[140px]"
          >
            {!connectedInstances.length && <option value="">Nenhuma conectada</option>}
            {connectedInstances.map(i => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Enviadas', value: totals.sent, color: 'text-emerald-600' },
          { label: 'Responderam', value: totals.replied, color: 'text-violet-600' },
          { label: 'Na fila', value: totals.pending, color: 'text-amber-600' },
          { label: 'Com erro', value: totals.error, color: 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 px-3 py-2">
            <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-slate-400">{card.label}</div>
          </div>
        ))}
      </div>

      {/* lista */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col min-h-[300px] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 text-sm">
          <CalendarClock className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">
            {rows.length} registro{rows.length === 1 ? '' : 's'}
          </span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            clique na linha para abrir a conversa
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => exportSends('csv')}
              disabled={!rows.length}
              className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-30"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={() => exportSends('xlsx')}
              disabled={!rows.length}
              className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-30"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              onClick={() => setShowAnalysis(true)}
              disabled={!rows.length}
              title="Analisar a campanha com IA: taxa de resposta por grupo e por etapa, e o que fazer"
              className="h-8 px-3 rounded-lg bg-violet-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-violet-700 disabled:opacity-30"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Analisar campanha
            </button>
            <button
              onClick={load}
              className="h-8 w-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {loading && (
            <div className="p-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}

          {!loading &&
            rows.map(r => (
              <div
                key={r.id}
                onClick={() => openConversation(r)}
                className={`px-3 py-2 flex items-center gap-3 text-sm cursor-pointer hover:bg-slate-50 border-l-4 ${
                  r.replied
                    ? 'border-l-emerald-500'
                    : r.status === 'error'
                      ? 'border-l-red-500'
                      : r.status === 'sent'
                        ? 'border-l-amber-400'
                        : 'border-l-slate-200'
                }`}
              >
                {/* nº da mensagem na jornada da pessoa — a conferência rápida */}
                <span
                  title={`Mensagem ${r.sequence ?? '?'} de ${r.totalSteps ?? '?'} do cronograma desta pessoa`}
                  className={`flex-shrink-0 w-11 text-center text-[11px] font-bold rounded-md py-1 ${
                    r.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {r.sequence ?? '—'}
                  <span className="font-normal opacity-60">/{r.totalSteps ?? '?'}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-700 truncate flex items-center gap-1.5">
                    {r.name ?? fmtPhone(r.phone)}
                    <span
                      className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        backgroundColor: `${JOURNEY_PROFILE_COLORS[r.profile]}18`,
                        color: JOURNEY_PROFILE_COLORS[r.profile],
                      }}
                    >
                      {JOURNEY_PROFILE_LABELS[r.profile] ?? r.profile}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_STYLES[r.status]}`}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {fmtPhone(r.phone)} · {r.stepLabel}
                    {r.stepProgram ? ` · ${r.stepProgram}` : ''}
                  </div>
                  {r.errorMessage && (
                    <div className="text-[11px] text-red-500 truncate flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {r.errorMessage}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end text-[11px] text-slate-400 flex-shrink-0">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {r.status === 'sent' ? fmtDateTime(r.sentAt) : fmtDateTime(r.scheduledAt)}
                  </span>
                  {r.replied && (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> respondeu {fmtDateTime(r.lastInboundAt)}
                    </span>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); runSmart(r); }}
                  disabled={!r.conversationId || smartLoadingId === r.id}
                  title="Parecer da IA sobre esta conversa e como retomar o contato"
                  className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 disabled:opacity-30 flex-shrink-0"
                >
                  {smartLoadingId === r.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Sparkles className="w-4 h-4" />}
                </button>
              </div>
            ))}

          {!loading && !rows.length && (
            <div className="p-8 text-center text-sm text-slate-400">
              Nenhum registro no período. Anexe o cronograma a alguém no Pipeline (menu ⋯ do card ou
              da coluna) ou amplie o intervalo de datas.
            </div>
          )}
        </div>
      </div>

      {/* drawer de conversa */}
      {openRow && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex justify-end"
          onClick={() => setOpenRow(null)}
        >
          <div
            className="bg-white w-full max-w-2xl h-full flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              <div
                className={`w-2.5 h-2.5 rounded-full ${openRow.replied ? 'bg-emerald-500' : 'bg-amber-400'}`}
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800 truncate">
                  {openRow.name ?? fmtPhone(openRow.phone)}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {fmtPhone(openRow.phone)} · {JOURNEY_PROFILE_LABELS[openRow.profile]} ·{' '}
                  {openRow.stepLabel}
                </div>
              </div>
              <button
                onClick={() => setEnrollmentStatus(openRow.enrollmentId, 'paused')}
                title="Pausar o cronograma desta pessoa"
                className="p-2 rounded-lg text-amber-500 hover:bg-amber-50"
              >
                <PauseCircle className="w-5 h-5" />
              </button>
              <button
                onClick={() => setEnrollmentStatus(openRow.enrollmentId, 'active')}
                title="Retomar o cronograma desta pessoa"
                className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"
              >
                <PlayCircle className="w-5 h-5" />
              </button>
              <button
                onClick={() => setEnrollmentStatus(openRow.enrollmentId, 'cancelled')}
                title="Encerrar o acompanhamento (cancela o que falta)"
                className="p-2 rounded-lg text-red-500 hover:bg-red-50"
              >
                <Ban className="w-5 h-5" />
              </button>
              <button
                onClick={() => openConversation(openRow)}
                title="Atualizar a conversa"
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <RefreshCw className="w-5 h-5 text-slate-400" />
              </button>
              <button onClick={() => setOpenRow(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* parecer da IA sobre esta conversa */}
            {smart && (
              <div className="px-4 py-3 border-b border-amber-100 bg-amber-50/60 flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-1.5 font-semibold text-amber-700">
                  <Sparkles className="w-4 h-4" /> Parecer da conversa
                  <button onClick={() => setSmart(null)} className="ml-auto p-0.5 rounded hover:bg-amber-100">
                    <X className="w-3.5 h-3.5 text-amber-600" />
                  </button>
                </div>
                <div className="text-slate-700"><b>Resumo:</b> {smart.resumo}</div>
                {smart.analise && (
                  <div className="text-slate-600 text-xs"><b>O que pode ser feito:</b> {smart.analise}</div>
                )}
                {smart.mensagem_sugerida && (
                  <div className="bg-white rounded-lg border border-amber-200 p-2 flex flex-col gap-2">
                    <div className="text-xs font-semibold text-slate-400">Mensagem sugerida para retomar</div>
                    <div className="text-slate-700">{smart.mensagem_sugerida}</div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setReplyText(smart.mensagem_sugerida); replyInputRef.current?.focus(); }}
                        className="h-8 px-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50"
                      >
                        <Copy className="w-3.5 h-3.5" /> Editar antes de enviar
                      </button>
                      <button
                        onClick={() => { setReplyText(smart.mensagem_sugerida); setTimeout(sendReply, 0); }}
                        disabled={replySending}
                        className="flex-1 h-8 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-emerald-500 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" /> Enviar sugestão
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* mensagem desta etapa (mesmo quando ainda não saiu) */}
            <div className="px-4 py-2 bg-violet-50/60 border-b border-violet-100">
              <div className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide mb-0.5">
                {STATUS_LABELS[openRow.status]} ·{' '}
                {openRow.status === 'sent'
                  ? fmtDateTime(openRow.sentAt)
                  : `agendada para ${fmtDateTime(openRow.scheduledAt)}`}
              </div>
              <div className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-4">
                {openRow.message}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-slate-50">
              {loadingMessages && <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />}
              {!loadingMessages && !messages.length && (
                <div className="text-center text-sm text-slate-400 py-8">
                  {openRow.conversationId
                    ? 'Sem mensagens registradas.'
                    : 'A conversa aparece aqui depois que a primeira mensagem sair.'}
                </div>
              )}
              {messages.map(m => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.direction === 'outbound'
                      ? 'self-end bg-emerald-600 text-white rounded-br-sm'
                      : 'self-start bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
                  }`}
                >
                  {m.content ?? `[${m.type}]`}
                  <div
                    className={`text-[10px] mt-0.5 ${m.direction === 'outbound' ? 'text-emerald-100' : 'text-slate-400'}`}
                  >
                    {fmtDateTime(m.created_at)}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-100 flex flex-col gap-1.5">
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                {instanceId
                  ? `Enviando pela instância ${connectedInstances.find(i => i.id === instanceId)?.name ?? ''}`
                  : 'Selecione uma instância nos filtros acima para responder'}
              </div>
              <div className="flex gap-2">
                <input
                  ref={replyInputRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendReply()}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 h-10 px-3 rounded-lg border border-slate-200 text-sm"
                />
                <button
                  onClick={sendReply}
                  disabled={replySending || !replyText.trim() || !instanceId}
                  className="h-10 px-4 rounded-lg bg-emerald-600 text-white inline-flex items-center gap-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
                >
                  {replySending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAnalysis && (
        <JourneyAnalysisModal
          filters={{ journeyId: journeyId || undefined, dateFrom, dateTo, churchId }}
          onClose={() => setShowAnalysis(false)}
        />
      )}
    </div>
  );
}
