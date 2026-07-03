/**
 * Lista de Envios — aba da tela de Gestão Pastoral.
 *
 * Histórico dos envios em massa com estado da conversa:
 *  🟢 verde = pessoa respondeu · 🟡 amarelo = sem resposta
 * Clique na linha abre o histórico da conversa (com reenvio manual pela
 * instância selecionada). Seleção em lote + ícone de IA atribui um agente de
 * IA (ai_agents) para atender as conversas marcadas; desmarcar desliga a IA.
 * Botão Smart (✨) gera resumo da conversa + mensagem sugerida clicável.
 *
 * Spec: docs/modules/whatsapp-mass-send/SPEC.md
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Loader2,
  Send,
  Bot,
  Sparkles,
  X,
  RefreshCw,
  Smartphone,
  MessageCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { ATTENDANCE_TYPE_LABELS, type AttendanceType } from '../../lib/pastoralKanbanService';
import { useWhatsAppInstances } from '../../hooks/useWhatsAppInstances';
import DateRangeFilter, { currentMonthRange } from './DateRangeFilter';
import { ConfirmDialog } from '../../components/app-ui/shared/ConfirmDialog';
import { usePermissions } from '../../lib/usePermissions';

function currentProfileType(): string {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}').profileType || 'church';
  } catch {
    return 'church';
  }
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface SendRow {
  recipientId: string;
  campaignId: string;
  campaignName: string;
  source: 'member' | 'pipeline';
  name: string | null;
  phone: string;
  category: string | null;
  church: string | null;
  sentAt: string | null;
  conversationId: string | null;
  replied: boolean;
  lastInboundAt: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  aiEnabled: boolean;
  aiAgentId: string | null;
}

interface AiAgent {
  id: string;
  name: string;
  role: string;
  description?: string | null;
  isActive: boolean;
}

interface ChatMessage {
  id: string;
  content: string | null;
  type: string;
  direction: 'inbound' | 'outbound';
  status: string;
  created_at: string;
}

interface SmartResult {
  resumo: string;
  quem_mais_falou: string;
  analise: string;
  mensagem_sugerida: string;
}

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
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function PastoralSendHistory() {
  // filtros
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [{ from: dateFrom, to: dateTo }, setDateRange] = useState(currentMonthRange);

  // dados
  const [sends, setSends] = useState<SendRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // recipientIds (cada linha é independente)

  // instância para reenvio manual (apenas UMA)
  const { instances } = useWhatsAppInstances();
  const { canCreate, canEdit } = usePermissions(currentProfileType());
  const canResend = canCreate('whatsapp_campaigns');
  const canManageAi = canEdit('whatsapp_campaigns');
  const connectedInstances = instances.filter(i => i.status === 'connected');
  const [instanceId, setInstanceId] = useState('');
  useEffect(() => {
    if (!instanceId && connectedInstances.length) setInstanceId(connectedInstances[0].id);
  }, [connectedInstances, instanceId]);

  // agentes de IA
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiApplying, setAiApplying] = useState(false);

  // drawer de conversa
  const [openSend, setOpenSend] = useState<SendRow | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  // smart
  const [smartLoading, setSmartLoading] = useState(false);
  const [smart, setSmart] = useState<SmartResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/ai/agents', { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        setAgents((Array.isArray(data) ? data : []).filter((a: AiAgent) => a.isActive));
      } catch { /* sem agentes */ }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (q.trim()) params.set('q', q.trim());
      if (category) params.set('category', category);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/whatsapp/sends?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao buscar envios');
      setSends(data.sends ?? []);
      setSelected(new Set());
    } catch (err) {
      console.error('[send-history]', err);
      setSends([]);
    } finally {
      setLoading(false);
    }
  }, [q, category, dateFrom, dateTo]);

  // roda na montagem e sempre que o período mudar (presets são clique, sem Enter)
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  // seleção é por LINHA (recipientId) — cada envio marca independentemente,
  // mesmo que outra linha aponte para a mesma conversa (mesmo telefone).
  const selectableRowIds = useMemo(
    () => sends.filter(s => s.conversationId).map(s => s.recipientId),
    [sends]
  );
  const allSelected = selectableRowIds.length > 0 && selected.size === selectableRowIds.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectableRowIds));
  };

  // quantos envios (linhas) apontam para a mesma conversa — só informativo
  const conversationCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sends) {
      if (!s.conversationId) continue;
      map.set(s.conversationId, (map.get(s.conversationId) ?? 0) + 1);
    }
    return map;
  }, [sends]);
  const toggleRow = (recipientId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(recipientId)) next.delete(recipientId); else next.add(recipientId);
      return next;
    });
  };

  // conversationIds distintos por trás de um conjunto de recipientIds selecionados
  const conversationIdsFor = (recipientIds: string[]): string[] => {
    const ids = new Set<string>();
    for (const s of sends) {
      if (recipientIds.includes(s.recipientId) && s.conversationId) ids.add(s.conversationId);
    }
    return Array.from(ids);
  };

  // ── IA em lote / individual ──────────────────────────────────────────────────
  const updateAi = async (conversationIds: string[], agentId: string | null) => {
    if (!conversationIds.length) return;
    const res = await fetch('/api/whatsapp/conversations/assign-ai', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ conversationIds, agentId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Erro ao atualizar IA');
    const idSet = new Set(conversationIds);
    setSends(prev => prev.map(s =>
      s.conversationId && idSet.has(s.conversationId)
        ? { ...s, aiEnabled: !!agentId, aiAgentId: agentId }
        : s
    ));
  };

  const assignAi = async (agentId: string | null) => {
    if (!selected.size || aiApplying) return;
    setAiApplying(true);
    try {
      await updateAi(conversationIdsFor(Array.from(selected)), agentId);
      setAiModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar IA');
    } finally {
      setAiApplying(false);
    }
  };

  const [removingAiId, setRemovingAiId] = useState<string | null>(null);
  const removeAiFromRow = async (conversationId: string) => {
    if (removingAiId) return;
    setRemovingAiId(conversationId);
    try {
      await updateAi([conversationId], null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover IA');
    } finally {
      setRemovingAiId(null);
    }
  };

  const [removingAllAi, setRemovingAllAi] = useState(false);
  const [confirmRemoveAllAi, setConfirmRemoveAllAi] = useState(false);
  const aiConversationIds = useMemo(
    () => Array.from(new Set(sends.filter(s => s.aiEnabled && s.conversationId).map(s => s.conversationId!))),
    [sends]
  );
  const removeAllAi = async () => {
    if (!aiConversationIds.length || removingAllAi) return;
    setRemovingAllAi(true);
    try {
      await updateAi(aiConversationIds, null);
      setConfirmRemoveAllAi(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover IA');
    } finally {
      setRemovingAllAi(false);
    }
  };

  // ── conversa ────────────────────────────────────────────────────────────────
  const openConversation = async (send: SendRow) => {
    setOpenSend(send);
    setMessages([]);
    setSmart(null);
    setReplyText('');
    if (!send.conversationId) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/whatsapp/messages?conversationId=${send.conversationId}&limit=200`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch { /* histórico vazio */ } finally {
      setLoadingMessages(false);
    }
  };

  const sendReply = async (text?: string) => {
    const content = (text ?? replyText).trim();
    if (!openSend || !content || replySending) return;
    if (!instanceId) { alert('Selecione uma instância para o reenvio.'); return; }
    setReplySending(true);
    try {
      const res = await fetch('/api/whatsapp/send-direct', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          instanceId,
          phone: openSend.phone,
          message: content,
          contactName: openSend.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha no envio');
      setMessages(prev => [...prev, {
        id: `local_${Date.now()}`,
        content,
        type: 'text',
        direction: 'outbound',
        status: 'sent',
        created_at: new Date().toISOString(),
      }]);
      setReplyText('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha no envio');
    } finally {
      setReplySending(false);
    }
  };

  // ── smart ───────────────────────────────────────────────────────────────────
  const runSmart = async (send: SendRow) => {
    if (!send.conversationId || smartLoading) return;
    if (!openSend || openSend.recipientId !== send.recipientId) await openConversation(send);
    setSmartLoading(true);
    setSmart(null);
    try {
      const res = await fetch(`/api/whatsapp/conversations/${send.conversationId}/smart`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar resumo');
      setSmart(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar resumo');
    } finally {
      setSmartLoading(false);
    }
  };

  const agentName = (id: string | null) => agents.find(a => a.id === id)?.name ?? 'Agente IA';

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Filtros ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-end gap-2">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo}
          onChange={(from, to) => setDateRange({ from, to })} />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Categoria</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white min-w-[170px]">
            <option value="">Todas</option>
            {(Object.entries(ATTENDANCE_TYPE_LABELS) as Array<[AttendanceType, string]>).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-xs font-medium text-slate-500">Nome ou telefone</label>
          <input value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Digite para buscar..."
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm" />
        </div>
        <button onClick={load} disabled={loading}
          className="h-9 px-4 rounded-lg bg-slate-800 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-slate-700 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar
        </button>

        {/* instância p/ reenvio (apenas UMA) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Smartphone className="w-3 h-3" /> Instância (reenvio)
          </label>
          <select value={instanceId} onChange={e => setInstanceId(e.target.value)}
            className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white min-w-[140px]">
            {!connectedInstances.length && <option value="">Nenhuma conectada</option>}
            {connectedInstances.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>

        {/* IA em lote */}
        <button onClick={() => setAiModalOpen(true)} disabled={!selected.size || !canManageAi}
          title={!canManageAi ? 'Sem permissão para gerenciar agentes de IA' : 'Atribuir agente de IA aos envios selecionados'}
          className="h-9 px-3 rounded-lg bg-violet-600 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-violet-500 disabled:opacity-40">
          <Bot className="w-4 h-4" />
          IA ({selected.size})
        </button>
        <button onClick={() => setConfirmRemoveAllAi(true)} disabled={removingAllAi || !aiConversationIds.length || !canManageAi}
          title={!canManageAi ? 'Sem permissão para gerenciar agentes de IA' : 'Remover o agente de IA de todas as conversas atendidas por IA nesta lista'}
          className="h-9 px-3 rounded-lg border border-red-200 text-red-600 text-sm font-semibold inline-flex items-center gap-2 hover:bg-red-50 disabled:opacity-40">
          {removingAllAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          Remover IA de todos
        </button>
      </div>

      <ConfirmDialog
        open={confirmRemoveAllAi}
        title="Remover IA de todas as conversas?"
        message={`O agente de IA será desligado de ${aiConversationIds.length} conversa(s) atendidas por IA nesta lista. Esta ação não afeta conversas fora do período/filtro atual.`}
        confirmLabel="Remover IA"
        variant="danger"
        loading={removingAllAi}
        onConfirm={removeAllAi}
        onCancel={() => setConfirmRemoveAllAi(false)}
      />

      {/* ── Lista ── */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col min-h-[300px] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allSelected} onChange={toggleAll}
            className="w-4 h-4 rounded border-slate-300" />
          <MessageCircle className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">{sends.length} envio{sends.length === 1 ? '' : 's'}</span>
          <span className="text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />respondeu
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 ml-3 mr-1" />sem resposta
          </span>
          {selected.size > 0 && (
            <span className="text-xs text-violet-600 font-medium">
              {selected.size} envio(s) selecionado(s)
            </span>
          )}
          <button onClick={load} className="ml-auto p-1 rounded hover:bg-slate-100">
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {loading && (
            <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          )}
          {!loading && sends.map(s => (
            <div key={s.recipientId}
              onClick={() => openConversation(s)}
              className={`px-3 py-2 flex items-center gap-3 text-sm cursor-pointer hover:bg-slate-50
                border-l-4 ${s.replied ? 'border-l-emerald-500' : 'border-l-amber-400'}`}>
              <input type="checkbox"
                checked={selected.has(s.recipientId)}
                disabled={!s.conversationId}
                onClick={e => e.stopPropagation()}
                onChange={() => toggleRow(s.recipientId)}
                className="w-4 h-4 rounded border-slate-300" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-700 truncate flex items-center gap-1.5">
                  {s.name ?? fmtPhone(s.phone)}
                  {s.aiEnabled && (
                    <span title={`Atendida por ${agentName(s.aiAgentId)}`}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase pl-1.5 pr-1 py-0.5 rounded bg-violet-50 text-violet-600">
                      <Bot className="w-3 h-3" /> IA
                      <button
                        onClick={e => { e.stopPropagation(); s.conversationId && removeAiFromRow(s.conversationId); }}
                        disabled={removingAiId === s.conversationId || !canManageAi}
                        title={canManageAi ? 'Remover IA desta conversa' : 'Sem permissão para gerenciar agentes de IA'}
                        className="rounded-full hover:bg-violet-200 p-0.5 disabled:opacity-40">
                        {removingAiId === s.conversationId
                          ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          : <X className="w-2.5 h-2.5" />}
                      </button>
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {fmtPhone(s.phone)}
                  {s.category ? ` · ${ATTENDANCE_TYPE_LABELS[s.category as AttendanceType] ?? s.category}` : ''}
                  {s.church ? ` · ${s.church}` : ''}
                  {s.lastMessage ? ` · "${s.lastMessage.slice(0, 40)}"` : ''}
                  {s.conversationId && (conversationCounts.get(s.conversationId) ?? 0) > 1 && (
                    <span className="text-violet-500 font-medium"
                      title="Este telefone recebeu mais de um envio. Aplicar/remover IA aqui afeta a conversa inteira, mesmo marcando só esta linha.">
                      {' '}· mesmo contato ({conversationCounts.get(s.conversationId)}x)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end text-[11px] text-slate-400 flex-shrink-0">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {fmtDateTime(s.sentAt)}
                </span>
                {s.replied && (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> respondeu {fmtDateTime(s.lastInboundAt)}
                  </span>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); runSmart(s); }}
                disabled={!s.conversationId}
                title="Smart: resumo da conversa + sugestão de mensagem"
                className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 disabled:opacity-30">
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          ))}
          {!loading && !sends.length && (
            <div className="p-8 text-center text-sm text-slate-400">
              Nenhum envio encontrado. Faça um envio em massa na aba anterior ou ajuste os filtros.
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: agentes de IA ── */}
      {aiModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setAiModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-violet-600" />
              <div className="font-semibold text-slate-800">
                Agente de IA · {selected.size} envio(s)
              </div>
              <button onClick={() => setAiModalOpen(false)} className="ml-auto p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              O agente escolhido responderá automaticamente as mensagens das conversas por trás dos
              envios selecionados. Use o X no badge IA de uma linha para remover individualmente,
              ou &quot;Remover IA de todos&quot; para limpar tudo de uma vez.
            </p>
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
              {!agents.length && (
                <div className="text-sm text-slate-400 p-3 text-center">
                  Nenhum agente de IA cadastrado. Crie um em Configurações → Agentes de IA.
                </div>
              )}
              {agents.map(a => (
                <button key={a.id} onClick={() => assignAi(a.id)} disabled={aiApplying}
                  className="flex items-center gap-2 text-left text-sm rounded-lg border border-slate-200 px-3 py-2 hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50">
                  <Bot className="w-4 h-4 text-violet-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-700">{a.name}</div>
                    <div className="text-xs text-slate-400 truncate">{a.role}{a.description ? ` · ${a.description}` : ''}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => assignAi(null)} disabled={aiApplying}
              className="h-9 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50">
              Remover IA das selecionadas
            </button>
          </div>
        </div>
      )}

      {/* ── Drawer: conversa ── */}
      {openSend && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end"
          onClick={() => { setOpenSend(null); setSmart(null); }}>
          <div className="bg-white w-full max-w-lg h-full flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}>
            {/* header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${openSend.replied ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800 truncate">{openSend.name ?? fmtPhone(openSend.phone)}</div>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  {fmtPhone(openSend.phone)} · campanha: {openSend.campaignName}
                  {openSend.aiEnabled && (
                    <span className="inline-flex items-center gap-1 text-violet-600">
                      · <Bot className="w-3 h-3" /> {agentName(openSend.aiAgentId)}
                      <button
                        onClick={() => openSend.conversationId && removeAiFromRow(openSend.conversationId).then(() =>
                          setOpenSend(prev => prev ? { ...prev, aiEnabled: false, aiAgentId: null } : prev))}
                        disabled={removingAiId === openSend.conversationId || !canManageAi}
                        title={canManageAi ? 'Remover IA desta conversa' : 'Sem permissão para gerenciar agentes de IA'}
                        className="rounded-full hover:bg-violet-100 p-0.5 disabled:opacity-40">
                        {removingAiId === openSend.conversationId
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <X className="w-3 h-3" />}
                      </button>
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => runSmart(openSend)} disabled={smartLoading || !openSend.conversationId}
                title="Smart: resumo + sugestão"
                className="p-2 rounded-lg text-amber-500 hover:bg-amber-50 disabled:opacity-40">
                {smartLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              </button>
              <button onClick={() => { setOpenSend(null); setSmart(null); }}
                className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* smart result */}
            {smart && (
              <div className="px-4 py-3 border-b border-amber-100 bg-amber-50/60 flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-1.5 font-semibold text-amber-700">
                  <Sparkles className="w-4 h-4" /> Análise da conversa
                </div>
                <div className="text-slate-700"><b>Resumo:</b> {smart.resumo}</div>
                {smart.quem_mais_falou && <div className="text-slate-600 text-xs"><b>Quem mais falou:</b> {smart.quem_mais_falou}</div>}
                {smart.analise && <div className="text-slate-600 text-xs"><b>O que pode ser feito:</b> {smart.analise}</div>}
                {smart.mensagem_sugerida && (
                  <div className="bg-white rounded-lg border border-amber-200 p-2 flex flex-col gap-2">
                    <div className="text-xs font-semibold text-slate-400">Mensagem sugerida</div>
                    <div className="text-slate-700">{smart.mensagem_sugerida}</div>
                    <button onClick={() => sendReply(smart.mensagem_sugerida)} disabled={replySending || !canResend}
                      title={!canResend ? 'Sem permissão para enviar mensagens de WhatsApp' : undefined}
                      className="h-8 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-emerald-500 disabled:opacity-50">
                      {replySending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Enviar sugestão
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* mensagens */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-slate-50">
              {loadingMessages && <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />}
              {!loadingMessages && !messages.length && (
                <div className="text-center text-sm text-slate-400 py-8">
                  {openSend.conversationId ? 'Sem mensagens registradas.' : 'Conversa ainda não registrada para este envio.'}
                </div>
              )}
              {messages.map(m => (
                <div key={m.id}
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap
                    ${m.direction === 'outbound'
                      ? 'self-end bg-emerald-600 text-white rounded-br-sm'
                      : 'self-start bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}`}>
                  {m.content ?? `[${m.type}]`}
                  <div className={`text-[10px] mt-0.5 ${m.direction === 'outbound' ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {fmtDateTime(m.created_at)}
                  </div>
                </div>
              ))}
            </div>

            {/* reenvio manual */}
            <div className="p-3 border-t border-slate-100 flex flex-col gap-1.5">
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                {instanceId
                  ? `Enviando pela instância ${connectedInstances.find(i => i.id === instanceId)?.name ?? ''}`
                  : 'Selecione uma instância nos filtros acima para enviar'}
              </div>
              <div className="flex gap-2">
                <input value={replyText} onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendReply()}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 h-10 px-3 rounded-lg border border-slate-200 text-sm" />
                <button onClick={() => sendReply()} disabled={replySending || !replyText.trim() || !instanceId || !canResend}
                  title={!canResend ? 'Sem permissão para enviar mensagens de WhatsApp' : undefined}
                  className="h-10 px-4 rounded-lg bg-emerald-600 text-white inline-flex items-center gap-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50">
                  {replySending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
