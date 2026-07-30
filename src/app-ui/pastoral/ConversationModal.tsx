/**
 * Conversa de WhatsApp em modal — o histórico completo do contato.
 *
 * Abre a partir do ícone de chat de qualquer lista que tenha o telefone
 * (envio em massa, aba Envios). O modal anterior era só uma caixa de texto de
 * 448px: mandava a mensagem sem mostrar uma linha do que já havia sido
 * conversado, então quem atendia escrevia no escuro.
 *
 * Aqui a leitura é a mesma do WhatsApp: bolhas separando quem falou, e cada
 * tipo de mensagem exibido de verdade — foto, áudio com player, vídeo,
 * documento para baixar, figurinha, localização com link do mapa, contato
 * compartilhado, resposta de botão e de lista, reação e enquete. Os tipos vêm
 * do webhook via src/lib/zapiInbound.ts.
 *
 * Enquanto está aberto, recarrega a cada 8 segundos — a resposta do contato
 * aparece sem ninguém precisar fechar e abrir.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  Loader2,
  MapPin,
  MessageCircle,
  Send,
  Smartphone,
  User,
  X,
  AlertCircle,
  ListChecks,
  BarChart3,
  Bot,
  BotOff,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export interface ThreadMessage {
  id: string;
  content: string | null;
  type: string;
  direction: 'inbound' | 'outbound';
  status: string | null;
  sender_name: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ThreadConversation {
  id: string;
  instance_id: string;
  phone: string;
  contact_name: string | null;
  last_message_at: string | null;
  ai_enabled?: boolean;
  ai_agent_id?: string | null;
}

interface AgentOption {
  id: string;
  name: string;
  isActive?: boolean;
}

interface ThreadInstance {
  id: string;
  name: string;
  phone_number: string | null;
  status: string | null;
}

const fmtPhone = (raw: string) => {
  const d = (raw || '').replace(/\D/g, '');
  const n = d.startsWith('55') ? d.slice(2) : d;
  if (n.length === 11) return `+55 (${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `+55 (${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return raw;
};

const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const fmtDiaSeparador = (iso: string) => {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje.getTime() - 86_400_000);
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mesmoDia(d, hoje)) return 'Hoje';
  if (mesmoDia(d, ontem)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Tick de status da mensagem que saiu daqui. */
function StatusIcon({ status }: { status: string | null }) {
  if (status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-sky-500" />;
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-slate-400" />;
  if (status === 'sent') return <Check className="w-3.5 h-3.5 text-slate-400" />;
  if (status === 'error') return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
  return <Clock className="w-3.5 h-3.5 text-slate-300" />;
}

/** Leitura segura do metadata (jsonb livre gravado pelo webhook). */
const txt = (m: Record<string, unknown>, k: string): string | null => {
  const v = m[k];
  return typeof v === 'string' && v ? v : null;
};
const num = (m: Record<string, unknown>, k: string): number | null => {
  const v = m[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const list = (m: Record<string, unknown>, k: string): string[] => {
  const v = m[k];
  return Array.isArray(v) ? v.map(String) : [];
};

/** Corpo da bolha conforme o tipo — é aqui que "ler tudo" acontece. */
function MessageBody({ msg }: { msg: ThreadMessage }) {
  const meta = (msg.metadata ?? {}) as Record<string, unknown>;
  const legenda = msg.content?.trim();

  switch (msg.type) {
    case 'image':
      return (
        <div className="flex flex-col gap-1">
          {msg.media_url ? (
            <a href={msg.media_url} target="_blank" rel="noreferrer">
              <img
                src={msg.media_url}
                alt={legenda || 'Foto recebida'}
                className="rounded-lg max-h-72 w-auto object-contain bg-slate-100"
              />
            </a>
          ) : (
            <span className="text-xs italic text-slate-400">Foto sem link disponível</span>
          )}
          {legenda && <span className="whitespace-pre-wrap">{legenda}</span>}
        </div>
      );

    case 'sticker':
      return msg.media_url ? (
        <img src={msg.media_url} alt="Figurinha" className="w-28 h-28 object-contain" />
      ) : (
        <span className="text-xs italic text-slate-400">Figurinha</span>
      );

    case 'audio':
      return (
        <div className="flex flex-col gap-1 min-w-[220px]">
          <span className="text-[11px] font-semibold opacity-70">
            {meta.ptt ? 'Mensagem de voz' : 'Áudio'}
            {num(meta, 'seconds') ? ` · ${num(meta, 'seconds')}s` : ''}
          </span>
          {msg.media_url ? (
            <audio controls src={msg.media_url} className="w-full max-w-[260px]" />
          ) : (
            <span className="text-xs italic text-slate-400">Áudio sem link disponível</span>
          )}
        </div>
      );

    case 'video':
      return (
        <div className="flex flex-col gap-1">
          {msg.media_url ? (
            <video controls src={msg.media_url} className="rounded-lg max-h-72 max-w-full" />
          ) : (
            <span className="text-xs italic text-slate-400">Vídeo sem link disponível</span>
          )}
          {legenda && <span className="whitespace-pre-wrap">{legenda}</span>}
        </div>
      );

    case 'document':
      return (
        <a
          href={msg.media_url ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg bg-white/60 border border-slate-200 px-2.5 py-2 hover:bg-white"
        >
          <FileText className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm truncate">
              {txt(meta, 'fileName') ?? legenda ?? 'Documento'}
            </span>
            {msg.media_mime_type && (
              <span className="block text-[11px] text-slate-400">{msg.media_mime_type}</span>
            )}
          </span>
          <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </a>
      );

    case 'location':
      return (
        <a
          href={txt(meta, 'mapUrl') ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 hover:underline"
        >
          <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <span>
            {txt(meta, 'address') ?? 'Localização compartilhada'}
            {num(meta, 'latitude') != null && (
              <span className="block text-[11px] opacity-60">
                {num(meta, 'latitude')?.toFixed(5)}, {num(meta, 'longitude')?.toFixed(5)}
              </span>
            )}
          </span>
        </a>
      );

    case 'contact':
      return (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <span>
            {txt(meta, 'displayName') ?? legenda ?? 'Contato'}
            {list(meta, 'phones').length > 0 && (
              <span className="block text-[11px] opacity-60">{list(meta, 'phones').join(', ')}</span>
            )}
          </span>
        </div>
      );

    case 'button_reply':
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold opacity-70">Respondeu no botão</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {legenda ?? txt(meta, 'buttonLabel') ?? txt(meta, 'buttonId') ?? '—'}
          </span>
        </div>
      );

    case 'list_reply':
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold opacity-70">Escolheu na lista</span>
          <span className="inline-flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5 text-violet-500" />
            {txt(meta, 'title') ?? legenda ?? '—'}
          </span>
          {txt(meta, 'title') && legenda && legenda !== txt(meta, 'title') && (
            <span className="text-[11px] opacity-60">{legenda}</span>
          )}
        </div>
      );

    case 'reaction':
      return (
        <span className="text-2xl leading-none" title="Reagiu a uma mensagem">
          {legenda ?? txt(meta, 'emoji') ?? '👍'}
        </span>
      );

    case 'poll':
      return (
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <BarChart3 className="w-4 h-4 text-violet-500" />
            {legenda ?? 'Enquete'}
          </span>
          {list(meta, 'options').length > 0 && (
            <ul className="text-[12px] opacity-80 list-disc list-inside">
              {list(meta, 'options').map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          )}
        </div>
      );

    case 'poll_vote':
      return (
        <span className="inline-flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-violet-500" />
          Votou: {legenda ?? '—'}
        </span>
      );

    case 'unsupported':
      return (
        <span className="text-xs italic text-slate-400">
          Mensagem de tipo não suportado{txt(meta, 'rawType') ? ` (${txt(meta, 'rawType')})` : ''} — veja no WhatsApp
        </span>
      );

    default:
      return legenda ? (
        <span className="whitespace-pre-wrap break-words">{legenda}</span>
      ) : (
        <span className="text-xs italic text-slate-400">Mensagem sem conteúdo</span>
      );
  }
}

export default function ConversationModal({
  phone,
  contactName,
  instanceId,
  instanceName,
  canSend = true,
  onClose,
  onSent,
}: {
  phone: string;
  contactName?: string | null;
  /** instância pela qual enviar; sem ela o servidor escolhe a conversa mais recente */
  instanceId?: string | null;
  instanceName?: string | null;
  canSend?: boolean;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [conversation, setConversation] = useState<ThreadConversation | null>(null);
  const [instance, setInstance] = useState<ThreadInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── auxiliar de IA ──
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const agentMenuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (scroll: boolean) => {
      try {
        const params = new URLSearchParams({ phone });
        if (instanceId) params.set('instanceId', instanceId);
        const res = await fetch(`/api/whatsapp/conversations/thread?${params}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Falha ao carregar a conversa');
        setMessages(data.messages ?? []);
        setConversation(data.conversation ?? null);
        setInstance(data.instance ?? null);
        if (scroll) {
          requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: 'end' }));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Falha ao carregar a conversa');
      } finally {
        setLoading(false);
      }
    },
    [phone, instanceId]
  );

  // Carrega ao abrir e segue atualizando a cada 8 s enquanto o modal está
  // aberto, sem roubar a rolagem de quem está lendo mensagem antiga: só rola
  // para o fim se o usuário já estiver no fim.
  useEffect(() => {
    // load é assíncrono: o setState só acontece depois do fetch, não no corpo
    // do efeito. A regra não distingue os dois casos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(true);
    const timer = setInterval(() => {
      const el = listRef.current;
      const noFim = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      void load(noFim);
    }, 8000);
    return () => clearInterval(timer);
  }, [load]);

  // agentes que este usuário pode usar (a lista já vem filtrada pelo servidor)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/ai/agents', { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        setAgents((Array.isArray(data) ? data : []).filter((a: AgentOption) => a.isActive !== false));
      } catch { /* sem agentes: os botões de IA ficam ocultos */ }
    })();
  }, []);

  useEffect(() => {
    if (!agentMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (agentMenuRef.current && !agentMenuRef.current.contains(e.target as Node)) {
        setAgentMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [agentMenuOpen]);

  /** Liga a IA nesta conversa (agentId) ou devolve o atendimento para a pessoa (null). */
  const alternarIa = async (agentId: string | null) => {
    if (!conversation || togglingAi) return;
    setTogglingAi(true);
    try {
      const res = await fetch('/api/whatsapp/conversations/assign-ai', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ conversationIds: [conversation.id], agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao mudar o atendimento');
      setConversation(c => (c ? { ...c, ai_enabled: !!agentId, ai_agent_id: agentId } : c));
      toast.success(
        agentId
          ? 'IA assumiu esta conversa — responde sozinha às próximas mensagens.'
          : 'Atendimento devolvido para você. A IA não responde mais aqui.'
      );
      setAgentMenuOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao mudar o atendimento');
    } finally {
      setTogglingAi(false);
    }
  };

  /** Pede um rascunho de resposta com base no que já foi conversado. */
  const sugerir = async () => {
    if (!conversation || suggesting) return;
    setSuggesting(true);
    try {
      const res = await fetch(`/api/whatsapp/conversations/${conversation.id}/suggest`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ lastMessages: 5, instruction: instruction.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao gerar a sugestão');
      setSuggestion(data.suggestion as string);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao gerar a sugestão');
    } finally {
      setSuggesting(false);
    }
  };

  const enviar = async () => {
    const corpo = text.trim();
    if (!corpo || sending || !canSend) return;
    const alvoInstancia = instanceId ?? conversation?.instance_id;
    if (!alvoInstancia) {
      toast.warning('Escolha uma instância conectada para enviar.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send-direct', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          instanceId: alvoInstancia,
          phone,
          message: corpo,
          contactName: contactName ?? conversation?.contact_name ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha no envio');
      setText('');
      onSent?.();
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no envio');
    } finally {
      setSending(false);
    }
  };

  const nome = contactName || conversation?.contact_name || fmtPhone(phone);
  const nomeInstancia = instanceName ?? instance?.name ?? null;

  let ultimoDia = '';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Cabeçalho ── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 bg-white">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-800 truncate">{nome}</div>
            <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
              <span>{fmtPhone(phone)}</span>
              {nomeInstancia && (
                <span className="inline-flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  {nomeInstancia}
                </span>
              )}
              <span>
                {messages.length} mensagem{messages.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* Quem responde: a IA ou eu. Um clique troca. */}
          {conversation && agents.length > 0 && (
            <div className="relative flex-shrink-0" ref={agentMenuRef}>
              <button
                onClick={() =>
                  conversation.ai_enabled ? void alternarIa(null) : setAgentMenuOpen(o => !o)
                }
                disabled={togglingAi}
                title={
                  conversation.ai_enabled
                    ? 'A IA está respondendo esta conversa — clique para assumir'
                    : 'Você está respondendo — clique para deixar a IA assumir'
                }
                className={`h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors disabled:opacity-50
                  ${conversation.ai_enabled
                    ? 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                {togglingAi ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : conversation.ai_enabled ? (
                  <Bot className="w-4 h-4" />
                ) : (
                  <BotOff className="w-4 h-4" />
                )}
                {conversation.ai_enabled ? 'IA respondendo' : 'Eu respondo'}
              </button>

              {agentMenuOpen && !conversation.ai_enabled && (
                <div className="absolute right-0 z-30 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-1">
                  <p className="px-3 py-2 text-[11px] text-slate-400">
                    Qual agente assume esta conversa?
                  </p>
                  {agents.map(a => (
                    <button
                      key={a.id}
                      onClick={() => void alternarIa(a.id)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 inline-flex items-center gap-2"
                    >
                      <Bot className="w-4 h-4 text-violet-500" />
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Histórico ── */}
        <div
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-4 bg-slate-50 flex flex-col gap-1.5"
        >
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
          ) : !messages.length ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-1 text-slate-400">
              <MessageCircle className="w-8 h-8" />
              <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
              <p className="text-xs">A primeira que você enviar abre a conversa.</p>
            </div>
          ) : (
            messages.map(msg => {
              const dia = fmtDiaSeparador(msg.created_at);
              const mostraDia = dia !== ultimoDia;
              ultimoDia = dia;
              const meu = msg.direction === 'outbound';

              return (
                <div key={msg.id} className="flex flex-col">
                  {mostraDia && (
                    <div className="self-center my-2 px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-500">
                      {dia}
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm
                      ${meu
                        ? 'self-end bg-emerald-600 text-white rounded-br-md'
                        : 'self-start bg-white text-slate-700 border border-slate-200 rounded-bl-md'}`}
                  >
                    {!meu && msg.sender_name && (
                      <div className="text-[11px] font-semibold text-emerald-600 mb-0.5">
                        {msg.sender_name}
                      </div>
                    )}
                    <MessageBody msg={msg} />
                    <div
                      className={`flex items-center gap-1 justify-end mt-0.5 text-[10px]
                        ${meu ? 'text-emerald-100' : 'text-slate-400'}`}
                    >
                      {fmtHora(msg.created_at)}
                      {meu && <StatusIcon status={msg.status} />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {/* ── Compositor ── */}
        <div className="border-t border-slate-200 p-3 bg-white">
          {!canSend ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Você pode ler a conversa, mas não tem permissão para enviar mensagens de WhatsApp.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {/* ── Auxiliar de IA: rascunho para revisar antes de enviar ── */}
              {conversation && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={sugerir}
                      disabled={suggesting}
                      title="Lê as últimas 5 mensagens e sugere uma resposta curta"
                      className="h-8 px-3 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-violet-100 disabled:opacity-50"
                    >
                      {suggesting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      Sugerir resposta
                    </button>
                    <input
                      value={instruction}
                      onChange={e => setInstruction(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && void sugerir()}
                      placeholder="Opcional: o que você quer dizer (ex.: convidar para o GF)"
                      className="flex-1 min-w-[220px] h-8 px-2.5 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>

                  {suggestion !== null && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700">
                        <Wand2 className="w-3.5 h-3.5" />
                        Sugestão da IA — revise antes de enviar
                        <button
                          onClick={() => setSuggestion(null)}
                          className="ml-auto p-0.5 rounded hover:bg-violet-100 text-violet-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* editável aqui mesmo: a palavra final é de quem atende */}
                      <textarea
                        value={suggestion}
                        onChange={e => setSuggestion(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-violet-200"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setText(suggestion);
                            setSuggestion(null);
                          }}
                          className="h-8 px-3 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-500"
                        >
                          Usar no campo de envio
                        </button>
                        <button
                          onClick={sugerir}
                          disabled={suggesting}
                          className="h-8 px-3 rounded-lg border border-violet-200 text-violet-700 text-xs font-semibold hover:bg-violet-100 disabled:opacity-50"
                        >
                          Gerar outra
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void enviar();
                  }
                }}
                rows={2}
                placeholder="Escreva a mensagem — Enter envia, Shift+Enter pula linha"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200"
                autoFocus
              />
              <button
                onClick={enviar}
                disabled={sending || !text.trim()}
                className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-emerald-500 disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar
              </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
