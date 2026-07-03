/**
 * Envio de WhatsApp em Massa — aba da tela de Gestão Pastoral.
 *
 * Busca membros ou contatos do pipeline pastoral, seleciona destinatários,
 * escreve mensagem com variáveis {{...}} (+ imagem em anexo e link), escolhe
 * instâncias e acompanha a orquestração com resumo/ETA em tempo real.
 * Mensagem individual por contato via instância marcada (não usa WhatsApp Web).
 *
 * Spec: docs/modules/whatsapp-mass-send/SPEC.md
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Pause,
  Play,
  Square,
  Users,
  Smartphone,
  MessageCircle,
  RefreshCw,
  ListChecks,
  Radio,
  Timer,
  Hourglass,
  Image as ImageIcon,
  Link2,
  X,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { ATTENDANCE_TYPE_LABELS, type AttendanceType } from '../../lib/pastoralKanbanService';
import { useWhatsAppInstances } from '../../hooks/useWhatsAppInstances';
import DateRangeFilter, { currentMonthRange } from './DateRangeFilter';
import { usePermissions } from '../../lib/usePermissions';
import { exportRows } from './exportUtils';

function currentProfileType(): string {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}').profileType || 'church';
  } catch {
    return 'church';
  }
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ContactSource = 'members' | 'pipeline';

interface MassContact {
  key: string;
  source: 'member' | 'pipeline';
  sourceId: string;
  name: string;
  phone: string;
  church: string | null;
  regional: string | null;
  category: string | null;
  createdAt: string;
  variables: Record<string, string>;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

interface RegionalOption {
  id: string;
  name: string;
  campoId?: string;
}

interface ChurchOption {
  id: string;
  name: string;
  regionalId?: string;
  regional?: { id: string; name: string };
}

interface TitleOption {
  id: string;
  name: string;
}

interface RecipientRow {
  id: string;
  name: string | null;
  phone: string;
  status: 'pending' | 'sending' | 'sent' | 'error' | 'cancelled';
  error_message: string | null;
  sent_at: string | null;
}

interface CampaignProgress {
  campaignId: string;
  status: string;
  total: number;
  sent: number;
  errors: number;
  pending: number;
  intervalSeconds: number;
  startedAt: string | null;
  finishedAt: string | null;
  etaSeconds: number | null;
  perInstance: Array<{
    instanceId: string;
    name: string;
    sent: number;
    errors: number;
    connected: boolean;
    cooldownMs: number;
  }>;
}

const TEMPLATE_VARS = [
  'nome', 'primeiro_nome', 'telefone', 'igreja', 'regional',
  'tipo', 'rol', 'cargo', 'email', 'data_cadastro', 'protocolo',
];

const MEMBER_STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'ativ', label: 'Ativos' },
  { value: 'visit', label: 'Visitantes' },
  { value: 'aguard', label: 'Aguardando ativação' },
  { value: 'inativ', label: 'Inativos' },
];

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

function fmtDuration(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return '—';
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function renderPreview(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => vars[key] ?? `⟦${key}?⟧`);
}

/**
 * Relógio de tempo decorrido isolado num componente próprio: seu próprio
 * setInterval re-renderiza SÓ este texto a cada segundo, sem forçar a tela
 * inteira (com a lista de contatos, filtros etc.) a reconciliar a cada tick —
 * o que antes causava piscar/flicker visual ao passar o mouse pelos botões.
 */
function ElapsedClock({ startedAt, finishedAt }: { startedAt: string | null; finishedAt: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (finishedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [finishedAt]);

  if (!startedAt) return <>—</>;
  const end = finishedAt ? new Date(finishedAt).getTime() : now;
  const seconds = Math.max(0, (end - new Date(startedAt).getTime()) / 1000);
  return <>{fmtDuration(seconds)}</>;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function PastoralMassSend() {
  // filtros de busca
  const [source, setSource] = useState<ContactSource>('pipeline');
  const [typeFilter, setTypeFilter] = useState('');
  const [q, setQ] = useState('');
  const [{ from: dateFrom, to: dateTo }, setDateRange] = useState(currentMonthRange);

  // isolamento: regional/igreja/título eclesiástico (mesma regra de escopo do
  // módulo de Membros — servidor já restringe por campo/igreja do usuário)
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [titles, setTitles] = useState<TitleOption[]>([]);
  const [regionalId, setRegionalId] = useState('');
  const [churchId, setChurchId] = useState('');
  const [titleId, setTitleId] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [regRes, churchRes, titleRes] = await Promise.all([
          fetch('/api/regionais', { headers: authHeaders() }),
          fetch('/api/churches', { headers: authHeaders() }),
          fetch('/api/ecclesiastical-titles', { headers: authHeaders() }),
        ]);
        if (regRes.ok) setRegionais(await regRes.json());
        if (churchRes.ok) setChurches(await churchRes.json());
        if (titleRes.ok) setTitles(await titleRes.json());
      } catch { /* filtros ficam vazios; busca ainda funciona sem eles */ }
    })();
  }, []);

  // igreja some/reseta se a regional mudar e ela não pertencer mais à lista filtrada
  const churchesInRegional = useMemo(
    () => (regionalId ? churches.filter(c => (c.regionalId ?? c.regional?.id) === regionalId) : churches),
    [churches, regionalId]
  );
  useEffect(() => {
    if (churchId && !churchesInRegional.some(c => c.id === churchId)) setChurchId('');
  }, [regionalId, churchId, churchesInRegional]);

  // resultados + seleção
  const [contacts, setContacts] = useState<MassContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // mensagem + anexos + orquestração
  const [message, setMessage] = useState('Olá {{primeiro_nome}}, ');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [intervalSec, setIntervalSec] = useState(5);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // instâncias
  const { instances, isLoading: loadingInstances, refetch: refetchInstances } = useWhatsAppInstances();
  const { canCreate } = usePermissions(currentProfileType());
  const canSendCampaign = canCreate('whatsapp_campaigns');
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());

  // campanha ativa
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [starting, setStarting] = useState(false);
  const [viewSummary, setViewSummary] = useState(false);
  const loopActive = useRef(false);

  // mensagem individual
  const [directTarget, setDirectTarget] = useState<MassContact | null>(null);
  const [directMessage, setDirectMessage] = useState('');
  const [directSending, setDirectSending] = useState(false);
  const [directFeedback, setDirectFeedback] = useState<string | null>(null);

  const isRunning = progress?.status === 'running' && loopActive.current;

  // ── retoma campanha em andamento ao abrir a tela ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/whatsapp/campaigns', { headers: authHeaders() });
        if (!res.ok) return;
        const { campaigns } = await res.json();
        const active = (campaigns ?? []).find(
          (c: { status: string }) => c.status === 'running' || c.status === 'paused'
        );
        if (active) {
          setCampaignId(active.id);
          setViewSummary(true);
          await refreshCampaign(active.id);
        }
      } catch { /* sem campanha ativa */ }
    })();
    return () => { loopActive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── busca de contatos ───────────────────────────────────────────────────────
  const searchContacts = useCallback(async () => {
    setLoadingContacts(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ source, limit: '1000' });
      if (q.trim()) params.set('q', q.trim());
      if (typeFilter) params.set('type', typeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (regionalId) params.set('regionalId', regionalId);
      if (churchId) params.set('churchId', churchId);
      if (source === 'members' && titleId) params.set('titleId', titleId);
      const res = await fetch(`/api/whatsapp/campaigns/contacts?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro na busca');
      setContacts(data.contacts ?? []);
      setSelected(new Set());
    } catch (err) {
      console.error('[mass-send] busca', err);
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, [source, q, typeFilter, dateFrom, dateTo, regionalId, churchId, titleId]);

  // presets de período (clique, sem Enter) já refazem a busca automaticamente
  useEffect(() => {
    if (searched) searchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const toggleContact = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allSelected = contacts.length > 0 && selected.size === contacts.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(contacts.map(c => c.key)));
  };

  const selectedContacts = useMemo(
    () => contacts.filter(c => selected.has(c.key)),
    [contacts, selected]
  );

  // ── exportação CSV/Excel ─────────────────────────────────────────────────────
  const exportContacts = (format: 'csv' | 'xlsx') => {
    const list = selected.size ? selectedContacts : contacts;
    exportRows(
      list.map(c => ({
        Nome: c.name,
        Telefone: fmtPhone(c.phone),
        Igreja: c.church ?? '',
        Regional: c.regional ?? '',
        Categoria: c.category ? (ATTENDANCE_TYPE_LABELS[c.category as AttendanceType] ?? c.category) : '',
        Origem: c.source === 'member' ? 'Membro' : 'Pipeline',
        'Data de cadastro': c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '',
        'Última mensagem': c.lastMessage ?? '',
        'Última mensagem em': c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString('pt-BR') : '',
      })),
      'contatos-envio-massa',
      format
    );
  };

  // ── campanha ────────────────────────────────────────────────────────────────
  const refreshCampaign = useCallback(async (id: string) => {
    const res = await fetch(`/api/whatsapp/campaigns/${id}`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    setProgress(data.progress);
    setRecipients(data.recipients ?? []);
  }, []);

  const runLoop = useCallback(async (id: string) => {
    if (loopActive.current) return;
    loopActive.current = true;
    while (loopActive.current) {
      try {
        const res = await fetch(`/api/whatsapp/campaigns/${id}/process`, {
          method: 'POST',
          headers: authHeaders(),
        });
        if (!res.ok) break;
        const tick = await res.json();
        setProgress(tick.progress);
        if (tick.event) {
          setRecipients(prev => prev.map(r =>
            r.id === tick.event.recipientId
              ? { ...r, status: tick.event.status, error_message: tick.event.error ?? null, sent_at: tick.event.at }
              : r
          ));
        }
        if (tick.done) break;
        await new Promise(r => setTimeout(r, Math.max(tick.waitMs ?? 1000, 300)));
      } catch (err) {
        console.error('[mass-send] tick', err);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    loopActive.current = false;
    await refreshCampaign(id);
  }, [refreshCampaign]);

  const startCampaign = async () => {
    if (!selectedContacts.length || !message.trim() || !selectedInstances.size || starting) return;
    setStarting(true);
    try {
      const res = await fetch('/api/whatsapp/campaigns', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          messageTemplate: message,
          intervalSeconds: Math.max(5, intervalSec),
          instanceIds: Array.from(selectedInstances),
          imageUrl: imageUrl.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
          recipients: selectedContacts.map(c => ({
            source: c.source,
            sourceId: c.sourceId,
            name: c.name,
            phone: c.phone,
            variables: c.variables,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar campanha');
      setCampaignId(data.campaign.id);
      setViewSummary(true);
      await refreshCampaign(data.campaign.id);
      runLoop(data.campaign.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao iniciar campanha');
    } finally {
      setStarting(false);
    }
  };

  const patchCampaign = async (action: 'pause' | 'resume' | 'cancel') => {
    if (!campaignId) return;
    if (action !== 'resume') loopActive.current = false;
    const res = await fetch(`/api/whatsapp/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const data = await res.json();
      setProgress(data.progress);
      if (action === 'resume') runLoop(campaignId);
      if (action === 'cancel') await refreshCampaign(campaignId);
    }
  };

  const insertVar = (variable: string) => {
    const el = messageRef.current;
    const token = `{{${variable}}}`;
    if (!el) { setMessage(m => m + token); return; }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = message.slice(0, start) + token + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  // ── mensagem individual (instância marcada — nunca WhatsApp Web) ────────────
  const firstInstanceId = Array.from(selectedInstances)[0] ?? null;
  const firstInstance = instances.find(i => i.id === firstInstanceId) ?? null;

  const openDirect = (contact: MassContact) => {
    setDirectTarget(contact);
    setDirectMessage('');
    setDirectFeedback(null);
  };

  const sendDirect = async () => {
    if (!directTarget || !directMessage.trim() || !firstInstanceId || directSending) return;
    setDirectSending(true);
    setDirectFeedback(null);
    try {
      const res = await fetch('/api/whatsapp/send-direct', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          instanceId: firstInstanceId,
          phone: directTarget.phone,
          message: directMessage,
          contactName: directTarget.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha no envio');
      setDirectFeedback('✅ Mensagem enviada!');
      setDirectMessage('');
    } catch (err) {
      setDirectFeedback(`❌ ${err instanceof Error ? err.message : 'Falha no envio'}`);
    } finally {
      setDirectSending(false);
    }
  };

  const previewContact = selectedContacts[0] ?? contacts[0];
  const connectedSelected = instances.filter(
    i => selectedInstances.has(i.id) && i.status === 'connected'
  );

  const statusIcon = (status: RecipientRow['status'], error?: string | null) => {
    if (status === 'sent') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (status === 'error') return <span title={error ?? undefined}><XCircle className="w-4 h-4 text-red-500" /></span>;
    if (status === 'sending') return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    if (status === 'cancelled') return <Square className="w-4 h-4 text-slate-400" />;
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Área de pesquisa ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-end gap-2">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo}
          onChange={(from, to) => setDateRange({ from, to })} />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Fonte</label>
          <select value={source}
            onChange={e => { setSource(e.target.value as ContactSource); setTypeFilter(''); }}
            className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white">
            <option value="pipeline">Pipeline (contatos do site)</option>
            <option value="members">Membros</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Categoria</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white min-w-[180px]">
            {source === 'pipeline' ? (
              <>
                <option value="">Todos os tipos</option>
                {(Object.entries(ATTENDANCE_TYPE_LABELS) as Array<[AttendanceType, string]>).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </>
            ) : (
              MEMBER_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)
            )}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Regional</label>
          <select value={regionalId} onChange={e => setRegionalId(e.target.value)}
            className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white min-w-[140px]">
            <option value="">Todas</option>
            {regionais.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Igreja</label>
          <select value={churchId} onChange={e => setChurchId(e.target.value)}
            className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white min-w-[160px]">
            <option value="">Todas{regionalId ? ' desta regional' : ''}</option>
            {churchesInRegional.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {source === 'members' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Título eclesiástico</label>
            <select value={titleId} onChange={e => setTitleId(e.target.value)}
              className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white min-w-[160px]">
              <option value="">Todos</option>
              {titles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-xs font-medium text-slate-500">Nome, ROL ou telefone</label>
          <input value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchContacts()}
            placeholder="Digite para buscar..."
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm" />
        </div>
        <button onClick={searchContacts} disabled={loadingContacts}
          className="h-9 px-4 rounded-lg bg-slate-800 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-slate-700 disabled:opacity-50">
          {loadingContacts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar
        </button>
        {campaignId && (
          <button onClick={() => setViewSummary(v => !v)}
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm inline-flex items-center gap-2 hover:bg-slate-50">
            {viewSummary ? <ListChecks className="w-4 h-4" /> : <Radio className="w-4 h-4 text-emerald-500" />}
            {viewSummary ? 'Ver lista' : 'Resumo de envio'}
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-1 min-h-0 flex-col lg:flex-row">
        {/* ── Lista de pessoas / Resumo de envio ── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col min-h-[300px] overflow-hidden">
          {viewSummary && campaignId ? (
            <>
              <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Radio className="w-4 h-4 text-emerald-500" /> Resumo de envio
                <button onClick={() => refreshCampaign(campaignId)} className="ml-auto p-1 rounded hover:bg-slate-100">
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* cards de resumo + relógio */}
              {progress && (
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 border-b border-slate-100">
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="text-[11px] uppercase font-semibold text-slate-400">Total</div>
                    <div className="text-xl font-bold text-slate-800">{progress.total}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2.5">
                    <div className="text-[11px] uppercase font-semibold text-emerald-500">Enviadas</div>
                    <div className="text-xl font-bold text-emerald-700">{progress.sent}</div>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-2.5">
                    <div className="text-[11px] uppercase font-semibold text-blue-500">Enviando</div>
                    <div className="text-xl font-bold text-blue-700">
                      {progress.status === 'running' ? Math.min(1, progress.pending) : 0}
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2.5">
                    <div className="text-[11px] uppercase font-semibold text-amber-500">Pendentes</div>
                    <div className="text-xl font-bold text-amber-700">{progress.pending}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="text-[11px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                      <Timer className="w-3 h-3" /> Decorrido
                    </div>
                    <div className="text-xl font-bold text-slate-800">
                      <ElapsedClock startedAt={progress.startedAt} finishedAt={progress.finishedAt} />
                    </div>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-2.5">
                    <div className="text-[11px] uppercase font-semibold text-indigo-500 flex items-center gap-1">
                      <Hourglass className="w-3 h-3" /> Tempo restante
                    </div>
                    <div className="text-xl font-bold text-indigo-700">
                      {progress.status === 'running' && progress.etaSeconds != null
                        ? fmtDuration(progress.etaSeconds)
                        : progress.pending === 0 ? '0s' : '—'}
                    </div>
                  </div>
                  {progress.errors > 0 && (
                    <div className="rounded-lg bg-red-50 p-2.5 col-span-2">
                      <div className="text-[11px] uppercase font-semibold text-red-500">Erros</div>
                      <div className="text-xl font-bold text-red-700">{progress.errors}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {recipients.map(r => (
                  <div key={r.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                    {statusIcon(r.status, r.error_message)}
                    <span className="font-medium text-slate-700 truncate">{r.name ?? fmtPhone(r.phone)}</span>
                    <span className="text-slate-400 text-xs">{fmtPhone(r.phone)}</span>
                    <span className="ml-auto text-xs text-slate-400">
                      {r.status === 'sent' && r.sent_at && new Date(r.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {r.status === 'error' && <span className="text-red-500">{r.error_message ?? 'erro'}</span>}
                      {r.status === 'pending' && 'aguardando'}
                      {r.status === 'sending' && 'enviando...'}
                      {r.status === 'cancelled' && 'cancelado'}
                    </span>
                  </div>
                ))}
                {!recipients.length && (
                  <div className="p-6 text-center text-sm text-slate-400">Nenhum destinatário na campanha.</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  className="w-4 h-4 rounded border-slate-300" />
                <Users className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-700">
                  {contacts.length} contato{contacts.length === 1 ? '' : 's'}
                </span>
                {selected.size > 0 && (
                  <span className="text-xs text-emerald-600 font-medium">{selected.size} selecionado(s)</span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 hidden sm:inline">Exportar:</span>
                  <button onClick={() => exportContacts('csv')} disabled={!contacts.length}
                    title={selected.size ? 'Exportar selecionados (CSV)' : 'Exportar todos os listados (CSV)'}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-30">
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                  <button onClick={() => exportContacts('xlsx')} disabled={!contacts.length}
                    title={selected.size ? 'Exportar selecionados (Excel)' : 'Exportar todos os listados (Excel)'}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-30">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Excel
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {loadingContacts && (
                  <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                )}
                {!loadingContacts && contacts.map(c => (
                  <label key={c.key} className="px-3 py-2 flex items-center gap-3 text-sm hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggleContact(c.key)}
                      className="w-4 h-4 rounded border-slate-300" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-700 truncate flex items-center gap-1.5">
                        {c.name}
                        {c.lastMessage && (
                          <span title={`Já existe conversa · ${c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString('pt-BR') : ''}`}
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 flex-shrink-0">
                            <MessageCircle className="w-3 h-3" /> já conversou
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {fmtPhone(c.phone)}
                        {c.church ? ` · ${c.church}` : ''}
                        {c.category ? ` · ${ATTENDANCE_TYPE_LABELS[c.category as AttendanceType] ?? c.category}` : ''}
                        {c.lastMessage ? ` · "${c.lastMessage.slice(0, 40)}"` : ''}
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded
                      ${c.source === 'member' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}>
                      {c.source === 'member' ? 'Membro' : 'Pipeline'}
                    </span>
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); openDirect(c); }}
                      title="Enviar mensagem individual pela instância selecionada"
                      className="p-1 rounded hover:bg-emerald-50 text-emerald-600">
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </label>
                ))}
                {!loadingContacts && !contacts.length && (
                  <div className="p-8 text-center text-sm text-slate-400">
                    {searched ? 'Nenhum contato com telefone encontrado para os filtros.' : 'Use os filtros acima e clique em Buscar.'}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Painel direito ── */}
        <div className="w-full lg:w-[340px] flex flex-col gap-3 flex-shrink-0">
          {/* Mensagem */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-2">
            <div className="text-sm font-semibold text-slate-700">Mensagem</div>
            <textarea
              ref={messageRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              placeholder="Olá {{primeiro_nome}}, ..."
              className="w-full rounded-lg border border-slate-200 p-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_VARS.map(v => (
                <button key={v} onClick={() => insertVar(v)}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 font-mono">
                  {`{{${v}}}`}
                </button>
              ))}
            </div>

            {/* anexos */}
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                placeholder="URL da imagem (enviada em anexo)"
                className="flex-1 h-8 px-2 rounded-lg border border-slate-200 text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                placeholder="Link (ex.: vídeo) anexado ao final"
                className="flex-1 h-8 px-2 rounded-lg border border-slate-200 text-xs" />
            </div>
            {imageUrl.trim() && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="prévia do anexo" className="max-h-24 rounded-lg object-cover border border-slate-100" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}

            {previewContact && message.trim() && (
              <div className="text-xs bg-slate-50 rounded-lg p-2 text-slate-600 border border-slate-100">
                <span className="font-semibold text-slate-400 block mb-0.5">
                  Prévia · {previewContact.name}
                </span>
                {renderPreview(message, previewContact.variables)}
                {linkUrl.trim() && <div className="text-blue-500 mt-1 truncate">{linkUrl}</div>}
              </div>
            )}

            {/* intervalo de orquestração (mín. 5 s por instância) */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Timer className="w-4 h-4 text-slate-400" />
              Intervalo por instância:
              <input type="number" min={5} max={600} value={intervalSec}
                onChange={e => setIntervalSec(Number(e.target.value) || 5)}
                onBlur={() => setIntervalSec(v => Math.max(5, v))}
                className="w-16 h-7 px-1.5 rounded-lg border border-slate-200 text-xs text-center" />
              s <span className="text-slate-400">(mínimo 5s — proteção contra bloqueio)</span>
            </div>

            {/* botão único de envio em massa */}
            <div className="flex gap-2">
              {!isRunning && progress?.status !== 'paused' && (
                <button onClick={startCampaign}
                  disabled={starting || !selected.size || !message.trim() || !connectedSelected.length || !canSendCampaign}
                  title={!canSendCampaign ? 'Sem permissão para enviar campanhas de WhatsApp' : undefined}
                  className="flex-1 h-9 rounded-lg bg-emerald-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-emerald-500 disabled:opacity-50">
                  {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Iniciar envio em massa ({selected.size})
                </button>
              )}
              {isRunning && (
                <button onClick={() => patchCampaign('pause')}
                  className="flex-1 h-9 rounded-lg bg-amber-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-amber-400">
                  <Pause className="w-4 h-4" /> Pausar
                </button>
              )}
              {progress?.status === 'paused' && (
                <button onClick={() => patchCampaign('resume')}
                  className="flex-1 h-9 rounded-lg bg-emerald-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-emerald-500">
                  <Play className="w-4 h-4" /> Retomar
                </button>
              )}
              {campaignId && (progress?.status === 'running' || progress?.status === 'paused') && (
                <button onClick={() => patchCampaign('cancel')}
                  className="h-9 px-3 rounded-lg border border-red-200 text-red-600 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-red-50">
                  <Square className="w-4 h-4" /> Cancelar
                </button>
              )}
            </div>
          </div>

          {/* Instâncias */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-2">
            <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-slate-400" /> Instâncias
              <button onClick={refetchInstances} className="ml-auto p-1 rounded hover:bg-slate-100">
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
            {loadingInstances && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            {!loadingInstances && !instances.length && (
              <div className="text-xs text-slate-400">Nenhuma instância cadastrada.</div>
            )}
            {instances.map(inst => {
              const connected = inst.status === 'connected';
              return (
                <label key={inst.id}
                  className={`flex items-center gap-2 text-sm rounded-lg border px-2 py-1.5
                    ${connected ? 'border-slate-200 cursor-pointer hover:bg-slate-50' : 'border-slate-100 opacity-50'}`}>
                  <input type="checkbox" disabled={!connected}
                    checked={selectedInstances.has(inst.id)}
                    onChange={() => setSelectedInstances(prev => {
                      const next = new Set(prev);
                      if (next.has(inst.id)) next.delete(inst.id); else next.add(inst.id);
                      return next;
                    })}
                    className="w-4 h-4 rounded border-slate-300" />
                  <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  <span className="font-medium text-slate-700 truncate">{inst.name}</span>
                  <span className="ml-auto text-[11px] text-slate-400">
                    {inst.phone_number ?? (connected ? 'conectada' : 'offline')}
                  </span>
                </label>
              );
            })}
            {selectedInstances.size > 1 && (
              <div className="text-[11px] text-emerald-600">
                Distribuição inteligente: envios alternam entre as {selectedInstances.size} instâncias
                (cada uma respeita {Math.max(5, intervalSec)}s de intervalo). Mensagens individuais
                usam a primeira marcada.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Barra de orquestração ── */}
      {progress && (
        <div className="bg-slate-900 text-slate-100 rounded-xl px-4 py-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-mono">
          <span className="font-semibold text-emerald-400 uppercase tracking-wide">Orquestração</span>
          <span>intervalo {progress.intervalSeconds}s/instância</span>
          <span>total <b>{progress.sent + progress.errors}</b> de <b>{progress.total}</b></span>
          {progress.errors > 0 && <span className="text-red-400">erros {progress.errors}</span>}
          <span>pendentes {progress.pending}</span>
          {progress.status === 'running' && progress.etaSeconds != null && (
            <span className="text-indigo-300">⏱ resta ~{fmtDuration(progress.etaSeconds)}</span>
          )}
          {progress.perInstance.map(pi => (
            <span key={pi.instanceId} className={pi.connected ? '' : 'text-red-400'}>
              {pi.name}: {pi.sent}{pi.errors ? ` (+${pi.errors} err)` : ''}
              {pi.cooldownMs > 0 && ` ⏳${Math.ceil(pi.cooldownMs / 1000)}s`}
            </span>
          ))}
          <span className={`ml-auto font-semibold uppercase
            ${progress.status === 'running' ? 'text-emerald-400' :
              progress.status === 'completed' ? 'text-blue-400' :
              progress.status === 'paused' ? 'text-amber-400' : 'text-red-400'}`}>
            {progress.status === 'running' ? 'enviando' :
              progress.status === 'completed' ? 'concluído' :
              progress.status === 'paused' ? 'pausado' :
              progress.status === 'cancelled' ? 'cancelado' : progress.status}
          </span>
        </div>
      )}

      {/* ── Modal: mensagem individual ── */}
      {directTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setDirectTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 truncate">{directTarget.name}</div>
                <div className="text-xs text-slate-400">{fmtPhone(directTarget.phone)}</div>
              </div>
              <button onClick={() => setDirectTarget(null)} className="ml-auto p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {!firstInstance ? (
              <div className="text-sm bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-3">
                Selecione uma instância na lista à direita para enviar a mensagem individual.
              </div>
            ) : (
              <>
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  Enviando pela instância <b>{firstInstance.name}</b>
                  {selectedInstances.size > 1 && ' (a primeira selecionada — envio individual usa apenas uma)'}
                </div>
                <textarea
                  value={directMessage}
                  onChange={e => setDirectMessage(e.target.value)}
                  rows={4}
                  placeholder="Digite a mensagem..."
                  className="w-full rounded-lg border border-slate-200 p-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  autoFocus
                />
                {directFeedback && <div className="text-sm">{directFeedback}</div>}
                <button onClick={sendDirect}
                  disabled={directSending || !directMessage.trim() || !canSendCampaign}
                  title={!canSendCampaign ? 'Sem permissão para enviar mensagens de WhatsApp' : undefined}
                  className="h-9 rounded-lg bg-emerald-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-emerald-500 disabled:opacity-50">
                  {directSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar mensagem
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
