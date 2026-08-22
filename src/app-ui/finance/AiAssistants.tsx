/**
 * Assistentes — central de criação E uso dos agentes de IA.
 *
 * Substitui a antiga tela "Agentes de IA" que ficava escondida no Centro de
 * Configurações: lá dava para criar o agente, mas para conversar era preciso
 * sair e abrir o widget do topo. Aqui os dois ficam no mesmo lugar — cada
 * assistente tem um botão de chat que abre a conversa na própria página.
 *
 * A lista abre em TABELA (é onde se compara visibilidade, acesso e status de
 * vários assistentes de uma vez); o modo cartões fica a um clique.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, ToggleLeft, ToggleRight, Trash2, Edit2, Check, AlertCircle, RefreshCw,
  Bot, Sparkles, X, MessageSquare, ArrowLeft, Send, Table2, LayoutGrid, Lock, Globe,
  ArrowRight, History, Search, Mic, Square, Snowflake,
} from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
import { renderMessageContent } from '../../components/app-ui/shared/renderMessageContent';

interface AiAgent {
  id: string;
  name: string;
  description: string | null;
  role: string;
  systemPrompt: string;
  avatarUrl: string | null;
  isActive: boolean;
  /** "global" = disponível em todo o sistema; "restrito" = só nesta tela */
  visibility?: string;
  /** usuários autorizados a usar o agente */
  userIds?: string[];
}

interface SystemUser {
  id: string;
  fullName: string | null;
  email: string | null;
  profileType?: string | null;
  role?: { name?: string | null } | null;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt?: string;
}

const roleLabel = (role: string) =>
  role === 'financeiro' ? 'Financeiro' : role === 'secretaria' ? 'Secretaria' : 'Geral';

function usuarioLogado(): any {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

export default function AiAssistants() {
  const usuario = usuarioLogado();
  const currentUserId = String(usuario?.id || '');
  const primeiroNome = String(usuario?.fullName || '').trim().split(/\s+/)[0] || '';

  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tabela é o padrão; cartões para quem prefere olhar em grade.
  const [layout, setLayout] = useState<'tabela' | 'cards'>('tabela');

  // ── Modal de criação/edição ──
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AiAgent | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('financeiro');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [visibility, setVisibility] = useState<'global' | 'restrito'>('restrito');
  const [allowedUserIds, setAllowedUserIds] = useState<Set<string>>(new Set());
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // ── Conversas (histórico) ──
  // O widget que ficava na barra superior guardava as sessões; ele saiu e o
  // histórico veio junto, para a conversa continuar de onde parou.
  const [tab, setTab] = useState<'assistentes' | 'conversas'>('assistentes');
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');

  // ── Pergunta falada ──
  const [gravando, setGravando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // ── Chat na própria página ──
  const [chatAgent, setChatAgent] = useState<AiAgent | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('mrm_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadAgents = async () => {
    setLoading(true);
    try {
      // scope=manage: esta é a tela de administração, então master/admin veem
      // todos os agentes mesmo sem estarem marcados neles. É também o único
      // scope que lista os assistentes de visão bloqueada.
      const res = await fetch(`${apiBase}/ai/agents?scope=manage`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Falha ao carregar assistentes.');
      setAgents(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSystemUsers = async () => {
    try {
      const activeFieldId = localStorage.getItem('mrm_active_field_id') || '';
      const url = `${apiBase}/users?limit=200` + (activeFieldId ? `&campoId=${activeFieldId}` : '');
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setSystemUsers(Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : []);
    } catch { /* lista de usuários é opcional para o resto da tela */ }
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`${apiBase}/ai/chat`, { headers: authHeaders() });
      if (res.ok) setSessions(await res.json());
    } catch { /* histórico ausente não impede iniciar conversa nova */ }
    finally { setSessionsLoading(false); }
  };

  useEffect(() => {
    loadAgents();
    loadSystemUsers();
    loadSessions();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // O campo cresce com o texto até um teto e então rola por dentro — assim uma
  // pergunta de várias linhas fica visível sem empurrar o chat para fora da tela.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputMessage, chatAgent]);

  const handleOpenCreate = () => {
    setEditingAgent(null);
    setName('');
    setRole('financeiro');
    setDescription('');
    setSystemPrompt('');
    setAvatarUrl('');
    setIsActive(true);
    setVisibility('restrito');
    // Quem cria já entra na lista de autorizados — sem isso o próprio autor
    // criaria o assistente e levaria 403 ao tentar conversar com ele.
    setAllowedUserIds(new Set(currentUserId ? [currentUserId] : []));
    setUserSearch('');
    setShowModal(true);
  };

  const handleOpenEdit = (agent: AiAgent) => {
    setEditingAgent(agent);
    setName(agent.name);
    setRole(agent.role);
    setDescription(agent.description || '');
    setSystemPrompt(agent.systemPrompt);
    setAvatarUrl(agent.avatarUrl || '');
    setIsActive(agent.isActive);
    setVisibility(agent.visibility === 'restrito' ? 'restrito' : 'global');
    setAllowedUserIds(new Set(agent.userIds ?? []));
    setUserSearch('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!name.trim() || !systemPrompt.trim()) {
      setError('Nome e Prompt do Sistema são obrigatórios.');
      return;
    }
    try {
      const url = editingAgent ? `${apiBase}/ai/agents/${editingAgent.id}` : `${apiBase}/ai/agents`;
      const res = await fetch(url, {
        method: editingAgent ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          name, role, description, systemPrompt,
          avatarUrl: avatarUrl || null,
          isActive, visibility,
          userIds: Array.from(allowedUserIds),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar assistente.');
      }
      setSuccess(editingAgent ? 'Assistente atualizado!' : 'Assistente criado!');
      setShowModal(false);
      loadAgents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleActive = async (agent: AiAgent) => {
    try {
      const res = await fetch(`${apiBase}/ai/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      if (res.ok) loadAgents();
    } catch (err: any) {
      setError('Erro ao alternar status do assistente: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este assistente?')) return;
    setError('');
    try {
      const res = await fetch(`${apiBase}/ai/agents/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error('Erro ao deletar.');
      setSuccess('Assistente excluído com sucesso.');
      loadAgents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── Chat ──
  const podeConversar = (agent: AiAgent) =>
    agent.isActive && (agent.userIds ?? []).includes(currentUserId);

  const motivoSemChat = (agent: AiAgent) =>
    !agent.isActive
      ? 'Assistente inativo — ative para conversar.'
      : 'Você não está na lista de quem pode usar este assistente. Edite-o e marque seu usuário.';

  const handleOpenChat = (agent: AiAgent) => {
    setChatAgent(agent);
    setSessionId(null);
    setInputMessage('');
    setChatMessages([{
      id: 'greeting',
      role: 'assistant',
      content: `Olá! Sou o ${agent.name} (${roleLabel(agent.role)}). Pode perguntar o que quiser sobre os dados do sistema — lançamentos, membros, totais e cruzamentos entre eles.`,
      createdAt: new Date().toISOString(),
    }]);
  };

  /** Retoma uma conversa antiga com todo o histórico de mensagens. */
  const handleResumeSession = async (session: any) => {
    setChatAgent(session.agent);
    setSessionId(session.id);
    setChatMessages([]);
    setInputMessage('');
    setChatLoading(true);
    try {
      const res = await fetch(`${apiBase}/ai/chat?sessionId=${session.id}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
      }
    } catch { /* já estamos na tela do chat; o erro aparece ao enviar */ }
    finally { setChatLoading(false); }
  };

  const handleDeleteSession = async (id: string) => {
    if (!window.confirm('Excluir esta conversa e todo o histórico dela?')) return;
    try {
      const res = await fetch(`${apiBase}/ai/chat?sessionId=${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error('Erro ao excluir conversa.');
      if (sessionId === id) { setSessionId(null); setChatAgent(null); }
      loadSessions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  /** Sai do chat e volta para a lista — recarrega o histórico porque a conversa
      que acabou de acontecer só vira sessão depois da primeira resposta. */
  const handleCloseChat = () => {
    setChatAgent(null);
    loadSessions();
  };

  /**
   * Grava a pergunta falada. O áudio vai para /ai/transcribe e o texto volta
   * para o campo de mensagem — quem perguntou revisa antes de enviar, porque
   * transcrição erra nome próprio e valor, e aqui isso vira consulta errada.
   */
  const iniciarGravacao = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        // Libera o microfone assim que para — senão o indicador do navegador
        // fica aceso durante toda a conversa.
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        await transcreverAudio(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setGravando(true);
    } catch {
      setError('Não consegui acessar o microfone. Verifique a permissão do navegador.');
    }
  };

  const pararGravacao = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setGravando(false);
  };

  const transcreverAudio = async (blob: Blob) => {
    setTranscrevendo(true);
    try {
      const form = new FormData();
      form.append('audio', blob, 'pergunta.webm');
      const res = await fetch(`${apiBase}/ai/transcribe`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao transcrever o áudio.');
      // Acrescenta ao que já estava escrito, em vez de sobrescrever.
      setInputMessage((prev) => (prev ? `${prev} ${data.texto}` : data.texto));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTranscrevendo(false);
    }
  };

  /**
   * Envia uma pergunta para um assistente. Recebe agente e texto por parâmetro
   * (em vez de ler do estado) porque a boas-vindas da tela principal dispara a
   * primeira pergunta no mesmo instante em que abre o chat — o estado ainda não
   * teria sido aplicado.
   */
  const enviarPergunta = async (agent: AiAgent, texto: string, sessao: string | null) => {
    setChatMessages(prev => [...prev, {
      id: String(Date.now()), role: 'user', content: texto, createdAt: new Date().toISOString(),
    }]);
    setChatLoading(true);
    try {
      const res = await fetch(`${apiBase}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ agentId: agent.id, message: texto, sessionId: sessao }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao obter resposta do assistente.');
      }
      const data = await res.json();
      const eraConversaNova = !sessao;
      setSessionId(data.sessionId);
      setChatMessages(prev => [...prev, data.message]);
      // A sessão só passa a existir depois da primeira resposta — sem isso ela
      // não apareceria na coluna de conversas até recarregar a tela.
      if (eraConversaNova) loadSessions();
    } catch (err: any) {
      setChatMessages(prev => [...prev, {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: err?.message || 'Desculpe, ocorreu um erro ao processar sua mensagem.',
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !chatAgent || chatLoading) return;
    const texto = inputMessage.trim();
    setInputMessage('');
    enviarPergunta(chatAgent, texto, sessionId);
  };

  // ── Boas-vindas da tela principal ──
  const saudacao = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  })();

  /** Conversas que casam com a palavra buscada (nome do assistente ou título). */
  const sessoesFiltradas = sessions.filter((sess: any) => {
    const q = sessionSearch.trim().toLowerCase();
    if (!q) return true;
    return `${sess.agent?.name || ''} ${sess.title || ''}`.toLowerCase().includes(q);
  });

  // ─── Chat em tela cheia ───────────────────────────────────────────────────
  if (chatAgent) {
    return (
      <div className="p-6 text-slate-900 dark:text-slate-100 flex flex-col h-[calc(100vh-80px)]">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleCloseChat}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Voltar para a lista"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center overflow-hidden">
            {chatAgent.avatarUrl
              ? <img src={chatAgent.avatarUrl} alt={chatAgent.name} className="w-full h-full object-cover" />
              : <Bot className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate">{chatAgent.name}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {roleLabel(chatAgent.role)}
              {chatAgent.visibility === 'restrito' && ' · visão bloqueada (só nesta tela)'}
              {sessionId ? ' · conversa salva no histórico' : ' · conversa nova'}
            </p>
          </div>

          <button
            onClick={() => handleOpenChat(chatAgent)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
            title="Começar uma conversa nova com este assistente"
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nova conversa</span>
          </button>
          {sessionId && (
            <button
              onClick={() => handleDeleteSession(sessionId)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              title="Excluir esta conversa"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {error && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-semibold flex-1">{error}</span>
            <button onClick={() => setError('')} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {/* A pergunta é texto puro (pre-wrap preserva as quebras que o
                  usuário digitou); a resposta vem em markdown e é renderizada. */}
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white whitespace-pre-wrap'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 leading-relaxed'
              }`}>
                {msg.role === 'user' ? msg.content : renderMessageContent(msg.content)}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Consultando os dados...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {gravando && (
          <p className="mt-3 -mb-1 text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            Gravando... fale a pergunta e clique no quadrado para transcrever.
          </p>
        )}
        {transcrevendo && (
          <p className="mt-3 -mb-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Transcrevendo o áudio...
          </p>
        )}

        <div className="mt-4 flex items-end gap-2 pr-16 lg:pr-0">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={gravando ? 'Gravando a pergunta...' : 'Pergunte sobre lançamentos, membros, totais... (Enter quebra a linha)'}
            className="flex-1 resize-none overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm leading-relaxed focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={gravando ? pararGravacao : iniciarGravacao}
            disabled={transcrevendo || chatLoading}
            title={gravando ? 'Parar e transcrever' : 'Perguntar falando'}
            className={`px-4 h-[46px] flex-shrink-0 rounded-xl border transition-colors disabled:opacity-40 ${
              gravando
                ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {gravando ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={handleSendMessage}
            disabled={chatLoading || !inputMessage.trim()}
            className="px-4 h-[46px] flex-shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        </div>

        {/* Últimas conversas. Além de trocar de conversa sem sair do chat, esta
            coluna encurta a linha de envio — o botão de enviar ficava embaixo do
            balão do chat interno, no canto inferior direito da tela. */}
        <aside className="hidden lg:flex w-80 flex-shrink-0 flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Últimas conversas
              </span>
              <button
                onClick={loadSessions}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Atualizar lista"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                placeholder="Buscar por palavra..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {sessoesFiltradas.length === 0 && (
              <p className="p-4 text-xs text-slate-400 dark:text-slate-500 text-center">
                {sessions.length === 0
                  ? 'Nenhuma conversa salva ainda.'
                  : 'Nenhuma conversa com essa palavra.'}
              </p>
            )}
            {sessoesFiltradas.map((sess: any) => (
              <div
                key={sess.id}
                onClick={() => handleResumeSession(sess)}
                className={`group flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                  sess.id === sessionId
                    ? 'bg-indigo-50 dark:bg-indigo-900/20'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {sess.agent?.avatarUrl
                    ? <img src={sess.agent.avatarUrl} alt={sess.agent?.name || ''} className="w-full h-full object-cover" />
                    : <Bot className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    {sess.agent?.name || 'Assistente removido'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {sess.title || 'Conversa sem título'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {new Date(sess.updatedAt || sess.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                  {/* Sempre visível: escondido atrás do hover, o botão não
                      existia para quem usa toque, e mesmo no desktop era preciso
                      descobrir que ele estava ali. Discreto por padrão, vermelho
                      ao passar o mouse — dá para achar sem convidar ao clique. */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(sess.id); }}
                    className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    title="Excluir conversa"
                    aria-label={`Excluir conversa ${sess.title || 'sem título'}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
        </div>
      </div>
    );
  }

  // ─── Lista ────────────────────────────────────────────────────────────────
  const badgeVisibilidade = (agent: AiAgent) =>
    agent.visibility === 'restrito' ? (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 uppercase tracking-wider">
        <Lock className="w-3 h-3" /> Bloqueado
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        <Globe className="w-3 h-3" /> Global
      </span>
    );

  const BotaoChat = ({ agent, grande = false }: { agent: AiAgent; grande?: boolean }) => {
    const liberado = podeConversar(agent);
    return (
      <button
        onClick={() => liberado && handleOpenChat(agent)}
        disabled={!liberado}
        title={liberado ? 'Conversar com este assistente' : motivoSemChat(agent)}
        className={grande
          ? 'flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors'
          : 'p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-30 disabled:hover:bg-transparent transition-colors'}
      >
        <MessageSquare className="w-4 h-4" />
        {grande && <span>Conversar</span>}
      </button>
    );
  };

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Snowflake className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Smart Report</h1>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                — {saudacao}{primeiroNome ? `, ${primeiroNome}` : ''}! Sobre o que posso te ajudar hoje?
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Crie seus assistentes de IA e converse com eles aqui mesmo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden ${tab === 'assistentes' ? '' : 'hidden'}`}>
            <button
              onClick={() => setLayout('tabela')}
              title="Ver em tabela"
              className={`p-2.5 transition-colors ${layout === 'tabela'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <Table2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayout('cards')}
              title="Ver em cartões"
              className={`p-2.5 transition-colors ${layout === 'cards'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleOpenCreate}
            className="bg-indigo-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-indigo-700 active:scale-98 shadow-sm flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Assistente</span>
          </button>
        </div>
      </div>

      {/* Abas: os assistentes que existem × as conversas já tidas com eles */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setTab('assistentes')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            tab === 'assistentes'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Bot className="w-4 h-4" /> Assistentes
        </button>
        <button
          onClick={() => { setTab('conversas'); loadSessions(); }}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            tab === 'conversas'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" /> Conversas
          {sessions.length > 0 && (
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full px-1.5 py-0.5">
              {sessions.length}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{success}</span>
        </div>
      )}

      {/* ── Conversas ── */}
      {tab === 'conversas' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
          {sessionsLoading && sessions.length === 0 && (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500 dark:text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin" /> Carregando conversas...
            </div>
          )}
          {!sessionsLoading && sessions.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma conversa ainda.</p>
              <button
                onClick={() => setTab('assistentes')}
                className="mt-3 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Escolher um assistente e começar
              </button>
            </div>
          )}
          {sessions.map((session: any) => (
            <div
              key={session.id}
              onClick={() => handleResumeSession(session)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                {session.agent?.avatarUrl
                  ? <img src={session.agent.avatarUrl} alt={session.agent?.name || ''} className="w-full h-full object-cover" />
                  : <Bot className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                  {session.agent?.name || 'Assistente removido'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {session.title || 'Conversa sem título'}
                </p>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 flex-shrink-0">
                {new Date(session.updatedAt || session.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleResumeSession(session); }}
                className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                title="Continuar esta conversa"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                title="Excluir conversa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'assistentes' && loading && agents.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Carregando assistentes...</p>
        </div>
      )}

      {/* ── Tabela ── */}
      {tab === 'assistentes' && (!loading || agents.length > 0) && layout === 'tabela' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 font-bold">Assistente</th>
                <th className="px-4 py-3 font-bold">Especialidade</th>
                <th className="px-4 py-3 font-bold">Visibilidade</th>
                <th className="px-4 py-3 font-bold">Acesso</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {agents.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                    Nenhum assistente criado ainda. Use "Criar Assistente" para começar.
                  </td>
                </tr>
              )}
              {agents.map((agent) => (
                <tr key={agent.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${agent.isActive ? '' : 'opacity-60'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {agent.avatarUrl
                          ? <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
                          : <Bot className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{agent.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[320px]">
                          {agent.description || 'Sem descrição'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{roleLabel(agent.role)}</td>
                  <td className="px-4 py-3">{badgeVisibilidade(agent)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {(agent.userIds?.length ?? 0) === 0
                      ? <span className="text-slate-400 dark:text-slate-500">ninguém marcado</span>
                      : `${agent.userIds!.length} usuário(s)`}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleActive(agent)} className="focus:outline-none active:scale-95" title={agent.isActive ? 'Desativar' : 'Ativar'}>
                      {agent.isActive
                        ? <ToggleRight className="w-9 h-6 text-indigo-600 fill-indigo-100 dark:fill-indigo-900/40" />
                        : <ToggleLeft className="w-9 h-6 text-slate-400" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <BotaoChat agent={agent} />
                      <button
                        onClick={() => handleOpenEdit(agent)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                        title="Editar assistente"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(agent.id)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                        title="Excluir assistente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Cartões ── */}
      {tab === 'assistentes' && (!loading || agents.length > 0) && layout === 'cards' && (
        <div className="grid md:grid-cols-3 gap-6">
          <div
            onClick={handleOpenCreate}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 hover:shadow-md transition-all group min-h-[240px]"
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 mb-3 transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">Novo Assistente</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[200px] mt-1">
              Crie um assistente virtual com prompt e instrução personalizada
            </p>
          </div>

          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[240px] transition-all hover:shadow-md ${
                agent.isActive ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden ${
                      agent.isActive ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {agent.avatarUrl
                        ? <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
                        : <Bot className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{agent.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="inline-block text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md px-1.5 py-0.5 uppercase tracking-wider">
                          {roleLabel(agent.role)}
                        </span>
                        {badgeVisibilidade(agent)}
                      </div>
                    </div>
                  </div>

                  <button onClick={() => handleToggleActive(agent)} className="focus:outline-none active:scale-95 text-slate-500">
                    {agent.isActive
                      ? <ToggleRight className="w-9 h-6 text-indigo-600 fill-indigo-100 dark:fill-indigo-900/40" />
                      : <ToggleLeft className="w-9 h-6 text-slate-400" />}
                  </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3.5 line-clamp-2 min-h-[32px]">
                  {agent.description || 'Nenhuma descrição fornecida.'}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>PROMPT PERSONALIZADO</span>
                  </span>
                  <span>{agent.isActive ? 'Ativo' : 'Inativo'}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 items-center">
                <BotaoChat agent={agent} grande />
                <button
                  onClick={() => handleOpenEdit(agent)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  title="Editar assistente"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(agent.id)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                  title="Excluir assistente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal criar/editar ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">
                {editingAgent ? 'Editar Assistente' : 'Criar Novo Assistente'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome do Assistente *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Auxiliar Financeiro, Secretária Virtual"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Especialidade / Função *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-sm bg-slate-50 dark:bg-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="financeiro">Financeiro (Lê livro caixa)</option>
                    <option value="secretaria">Secretaria (Membros/Agenda)</option>
                    <option value="geral">Geral / Auxiliar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Avatar (URL Opcional)</label>
                  <input
                    type="text"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://imagem.com/avatar.jpg"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Descrição Breve</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Tira dúvidas e analisa os relatórios do livro caixa."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Instruções / Prompt do Sistema *</label>
                <textarea
                  required
                  rows={5}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Defina as regras do assistente, personalidade, restrições e escopo. Ex: 'Você é focado em relatórios financeiros, seja formal e use formatação de tabela quando listar valores...'"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-sm focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              {/* Visibilidade */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Visibilidade</label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    visibility === 'restrito'
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}>
                    <input
                      type="radio"
                      name="visibility"
                      checked={visibility === 'restrito'}
                      onChange={() => setVisibility('restrito')}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                        <Lock className="w-3.5 h-3.5" /> Bloquear visão
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        O assistente existe apenas nesta tela. Não aparece no chat do topo,
                        nem nas listas de Envios, pastoral ou WhatsApp.
                      </span>
                    </span>
                  </label>

                  <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    visibility === 'global'
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}>
                    <input
                      type="radio"
                      name="visibility"
                      checked={visibility === 'global'}
                      onChange={() => setVisibility('global')}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                        <Globe className="w-3.5 h-3.5" /> Disponível no sistema
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Aparece também no chat do topo e nas demais telas, para quem estiver marcado abaixo.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Quem pode usar este assistente</label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  {allowedUserIds.size === 0
                    ? 'Ninguém marcado — ninguém poderá conversar com ele (nem o master). Ele só aparece aqui na lista.'
                    : `${allowedUserIds.size} usuário(s) marcado(s) — só eles poderão conversar com ele.`}
                </p>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Buscar por nome ou e-mail..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-sm mb-2 focus:outline-none focus:border-indigo-500"
                />
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {systemUsers.length === 0 && (
                    <p className="text-xs text-slate-400 p-3">Nenhum usuário carregado.</p>
                  )}
                  {systemUsers
                    .filter((u) => {
                      const q = userSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (u.fullName || '').toLowerCase().includes(q)
                        || (u.email || '').toLowerCase().includes(q);
                    })
                    .map((u) => (
                      <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowedUserIds.has(u.id)}
                          onChange={() => setAllowedUserIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(u.id)) next.delete(u.id); else next.add(u.id);
                            return next;
                          })}
                          className="rounded border-slate-300 accent-indigo-600"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-slate-700 dark:text-slate-200 truncate">
                            {u.fullName || u.email || u.id}
                            {u.id === currentUserId && <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold ml-1">(você)</span>}
                          </span>
                          <span className="block text-[10px] text-slate-400 truncate">
                            {[u.email, u.role?.name || u.profileType].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </label>
                    ))}
                </div>
                {allowedUserIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setAllowedUserIds(new Set())}
                    className="text-[11px] text-slate-500 hover:text-slate-700 underline mt-2"
                  >
                    limpar seleção (ninguém poderá usar)
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Status do Assistente</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Assistentes ativos ficam disponíveis para chat imediato.</p>
                </div>
                <button type="button" onClick={() => setIsActive(!isActive)} className="focus:outline-none active:scale-95">
                  {isActive
                    ? <ToggleRight className="w-10 h-7 text-indigo-600 fill-indigo-100 dark:fill-indigo-900/40" />
                    : <ToggleLeft className="w-10 h-7 text-slate-400" />}
                </button>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold active:scale-98 transition-all"
                >
                  {editingAgent ? 'Atualizar Assistente' : 'Criar Assistente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
