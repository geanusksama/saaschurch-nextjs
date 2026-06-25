import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, Trash2, Plus, ArrowRight, X, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { apiBase } from '../../../lib/apiBase';

// Helper to parse message content and render markdown links as clickable elements
function renderMessageContent(content: string) {
  if (!content) return null;

  // Regex to match Markdown links: [Link Text](URL)
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mdLinkRegex.exec(content)) !== null) {
    const text = match[1];
    const url = match[2];
    
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    // Resolve URL to current host origin
    let absoluteUrl = url;
    if (url.startsWith('/')) {
      absoluteUrl = window.location.origin + url;
    } else if (url.includes('temp-reports/')) {
      const fileName = url.split('temp-reports/').pop();
      absoluteUrl = `${window.location.origin}/temp-reports/${fileName}`;
    }

    // Add the link element
    parts.push(
      <a 
        key={match.index} 
        href={absoluteUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold underline inline-flex items-center gap-1 mx-0.5"
        download
      >
        {text}
      </a>
    );

    lastIndex = mdLinkRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  if (parts.length === 0) {
    return content;
  }

  return <>{parts}</>;
}

interface AiChatAssistantProps {
  storedUser: any;
  isOpen?: boolean;
  onClose?: () => void;
}

export function AiChatAssistant({ storedUser, isOpen = false, onClose }: AiChatAssistantProps) {
  // ─── AI Chat Assistant States ───
  const [showAiChat, setShowAiChat] = useState(isOpen);

  React.useEffect(() => {
    setShowAiChat(isOpen);
  }, [isOpen]);
  const [aiAgents, setAiAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Estados extras para histórico de conversas (sessões)
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'sessions' | 'select-agent' | 'chat'>('sessions');

  // Estados extras para confirmações no padrão do sistema
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatLoading]);

  // Carrega as sessões de chat do usuário
  const loadChatSessions = async () => {
    setSessionsLoading(true);
    try {
      const token = localStorage.getItem('mrm_token');
      const res = await fetch(`${apiBase}/ai/chat`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setChatSessions(data);
      }
    } catch (err) {
      console.error('Erro ao carregar sessões de chat:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Carrega os agentes especialistas ativos
  const loadAiAgents = async () => {
    setAgentLoading(true);
    try {
      const token = localStorage.getItem('mrm_token');
      const res = await fetch(`${apiBase}/ai/agents`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAiAgents(data.filter((a: any) => a.isActive));
      }
    } catch (err) {
      console.error('Erro ao carregar agentes de IA:', err);
    } finally {
      setAgentLoading(false);
    }
  };

  // Carregar dados de acordo com o estado do chat
  useEffect(() => {
    if (showAiChat) {
      if (viewMode === 'sessions') {
        loadChatSessions();
      } else if (viewMode === 'select-agent') {
        loadAiAgents();
      }
    }
  }, [showAiChat, viewMode]);

  // Inicia um chat NOVO com o especialista selecionado
  const handleSelectAgent = (agent: any) => {
    setSelectedAgent(agent);
    setChatMessages([]);
    setCurrentSessionId(null);
    setViewMode('chat');
    
    const userName = storedUser.fullName || 'Usuário';
    const greeting = `Olá, ${userName}! Sou o ${agent.name} (${agent.role === 'financeiro' ? 'Especialista Financeiro' : agent.role === 'secretaria' ? 'Especialista em Secretaria' : 'Assistente'}). Como posso ajudar você hoje? Você pode me perguntar sobre lançamentos, registros de caixa, totalizadores ou análises financeiras!`;
    setChatMessages([
      { id: 'greeting', role: 'assistant', content: greeting, createdAt: new Date().toISOString() }
    ]);
  };

  // Retoma o histórico de uma conversa anterior selecionada da lista
  const handleResumeSession = async (session: any) => {
    setSelectedAgent(session.agent);
    setCurrentSessionId(session.id);
    setChatMessages([]);
    setChatLoading(true);
    setViewMode('chat');

    try {
      const token = localStorage.getItem('mrm_token');
      const resHistory = await fetch(`${apiBase}/ai/chat?sessionId=${session.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (resHistory.ok) {
        const historyData = await resHistory.json();
        setChatMessages(historyData.messages || []);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico da sessão:', err);
    } finally {
      setChatLoading(false);
    }
  };

  // Envia a mensagem do usuário
  const handleSendChatMessage = async () => {
    if (!inputMessage.trim() || !selectedAgent || chatLoading) return;
    
    const userMsgText = inputMessage.trim();
    setInputMessage('');
    
    const tempUserMsg = {
      id: String(Date.now()),
      role: 'user',
      content: userMsgText,
      createdAt: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, tempUserMsg]);
    setChatLoading(true);

    try {
      const token = localStorage.getItem('mrm_token');
      const res = await fetch(`${apiBase}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          message: userMsgText,
          sessionId: currentSessionId
        })
      });

      if (!res.ok) {
        throw new Error('Falha ao obter resposta do agente.');
      }

      const data = await res.json();
      setCurrentSessionId(data.sessionId);
      setChatMessages(prev => [...prev, data.message]);
    } catch (err: any) {
      console.error(err);
      setChatMessages(prev => [...prev, {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao tentar processar sua mensagem. Por favor, tente novamente.'
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Exclui a sessão de chat ativa (limpa histórico)
  const handleDeleteSession = () => {
    if (!currentSessionId || !selectedAgent) return;
    
    setPendingConfirm({
      title: 'Excluir Histórico',
      message: 'Deseja realmente limpar todo o histórico de conversas com este agente?',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('mrm_token');
          const res = await fetch(`${apiBase}/ai/chat?sessionId=${currentSessionId}`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          
          if (res.ok) {
            setCurrentSessionId(null);
            setSelectedAgent(null);
            setChatMessages([]);
            setViewMode('sessions');
            loadChatSessions();
          } else {
            alert('Erro ao excluir histórico de chat.');
          }
        } catch (err) {
          console.error('Erro ao excluir sessão de chat:', err);
          alert('Erro de rede ao excluir histórico.');
        }
      }
    });
  };

  // Exclui uma sessão de chat diretamente da lista de conversas
  const handleDeleteSessionFromList = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setPendingConfirm({
      title: 'Excluir Conversa',
      message: 'Deseja realmente excluir esta conversa?',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('mrm_token');
          const res = await fetch(`${apiBase}/ai/chat?sessionId=${sessionId}`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          
          if (res.ok) {
            setChatSessions(prev => prev.filter(s => s.id !== sessionId));
            if (currentSessionId === sessionId) {
              setCurrentSessionId(null);
              setSelectedAgent(null);
              setChatMessages([]);
            }
          } else {
            alert('Erro ao excluir histórico de chat.');
          }
        } catch (err) {
          console.error('Erro ao excluir sessão de chat:', err);
          alert('Erro de rede ao excluir histórico.');
        }
      }
    });
  };

  return (
    <>
      {/* Popover */}
      {showAiChat && (
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-24 z-[9999] w-auto sm:w-[550px] md:w-[700px] lg:w-[850px] bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col h-[550px] sm:h-[650px] max-h-[80vh] animate-slide-up">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white flex items-center justify-between shadow-sm flex-shrink-0">
              <div className="flex items-center gap-2.5 border-none">
                {viewMode === 'chat' && selectedAgent ? (
                  <>
                    <button
                      onClick={() => { setSelectedAgent(null); setViewMode('sessions'); loadChatSessions(); }}
                      className="p-1 hover:bg-white/20 rounded-md text-xs font-semibold mr-1 cursor-pointer"
                    >
                      ← Voltar
                    </button>
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold border border-white/20">
                      {selectedAgent.avatarUrl ? (
                        <img src={selectedAgent.avatarUrl} alt={selectedAgent.name} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <Bot className="w-4.5 h-4.5 text-white" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs truncate max-w-[150px]">{selectedAgent.name}</h4>
                      <p className="text-[10px] text-indigo-100 font-semibold uppercase">{selectedAgent.role}</p>
                    </div>
                  </>
                ) : viewMode === 'select-agent' ? (
                  <>
                    <button
                      onClick={() => setViewMode('sessions')}
                      className="p-1 hover:bg-white/20 rounded-md text-xs font-semibold mr-1 cursor-pointer"
                    >
                      ← Voltar
                    </button>
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">Novo Chat</h4>
                      <p className="text-[10px] text-indigo-100">Escolha o seu especialista</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">Assistente de IA</h4>
                      <p className="text-[10px] text-indigo-100">Minhas Conversas</p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                {viewMode === 'chat' && selectedAgent && currentSessionId && (
                  <button 
                    onClick={handleDeleteSession}
                    className="p-1.5 hover:bg-white/20 rounded-lg cursor-pointer text-white/90 hover:text-white transition-colors"
                    title="Limpar histórico de conversas"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                )}
                <button 
                  onClick={() => { setShowAiChat(false); if (onClose) onClose(); }}
                  className="p-1.5 hover:bg-white/20 rounded-lg cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/40">
              
              {/* TELA 1: LISTA DE SESSÕES */}
              {viewMode === 'sessions' && (
                <div className="space-y-4">
                  <button
                    onClick={() => setViewMode('select-agent')}
                    className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nova Conversa</span>
                  </button>

                  <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-2">Conversas Recentes</div>

                  {sessionsLoading ? (
                    <div className="flex flex-col items-center justify-center p-8">
                      <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
                      <p className="text-[11px] text-slate-400">Carregando conversas...</p>
                    </div>
                  ) : chatSessions.length === 0 ? (
                    <div className="text-center p-8 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/80">
                      <p className="text-xs text-slate-400 dark:text-slate-500">Nenhuma conversa recente encontrada.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {chatSessions.map((session) => (
                        <div
                          key={session.id}
                          className="bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xs hover:border-slate-350 dark:hover:border-slate-700/80 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-slate-700/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                              {session.agent?.avatarUrl ? (
                                <img src={session.agent.avatarUrl} alt={session.agent.name} className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                <Bot className="w-5 h-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs text-slate-750 dark:text-slate-200 truncate">{session.agent?.name || 'Agente'}</h4>
                              <p className="text-[11px] text-slate-450 dark:text-slate-400 truncate mt-0.5">{session.title}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mr-1">
                              {new Date(session.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                            <button
                              onClick={() => handleResumeSession(session)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 rounded-lg text-slate-650 dark:text-slate-300 transition-colors cursor-pointer"
                              title="Entrar na conversa"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteSessionFromList(session.id, e)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-slate-700 dark:hover:bg-slate-650 rounded-lg text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                              title="Excluir conversa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TELA 2: SELECIONAR AGENTE */}
              {viewMode === 'select-agent' && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider mb-2">Especialistas Disponíveis</p>
                  
                  {agentLoading ? (
                    <div className="flex flex-col items-center justify-center p-8">
                      <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
                      <p className="text-[11px] text-slate-400">Carregando especialistas...</p>
                    </div>
                  ) : aiAgents.length === 0 ? (
                    <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-500">Nenhum agente ativo cadastrado.</p>
                    </div>
                  ) : (
                    aiAgents.map((agent) => (
                      <div
                        key={agent.id}
                        onClick={() => handleSelectAgent(agent)}
                        className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl p-3.5 hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all flex items-start gap-3 group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform flex-shrink-0">
                          {agent.avatarUrl ? (
                            <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Bot className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{agent.name}</h4>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 rounded uppercase flex-shrink-0 ml-1">
                              {agent.role === 'financeiro' ? 'Financeiro' : agent.role === 'secretaria' ? 'Secretaria' : 'Geral'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{agent.description || 'Analista especialista pronto para ajudar.'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TELA 3: CONVERSA ATIVA */}
              {viewMode === 'chat' && selectedAgent !== null && (
                <div className="space-y-3.5">
                  {chatMessages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role !== 'user' && (
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {selectedAgent.avatarUrl ? (
                            <img src={selectedAgent.avatarUrl} alt={selectedAgent.name} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <Bot className="w-4.5 h-4.5 text-indigo-700" />
                          )}
                        </div>
                      )}
                      
                      <div className={`p-3 rounded-2xl max-w-[80%] text-xs shadow-xs leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-tl-none'
                      }`}>
                        {renderMessageContent(msg.content)}
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex gap-2.5 justify-start">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {selectedAgent.avatarUrl ? (
                          <img src={selectedAgent.avatarUrl} alt={selectedAgent.name} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <Bot className="w-4.5 h-4.5 text-indigo-700" />
                        )}
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-none text-xs flex items-center gap-1.5 shadow-xs">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                        <span>Digitando...</span>
                      </div>
                    </div>
                  )}
                  
                  <div ref={chatMessagesEndRef} />
                </div>
              )}

            </div>

            {/* Input Footer */}
            {viewMode === 'chat' && selectedAgent !== null && (
              <div className="p-3 border-t border-slate-200/60 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2 flex-shrink-0">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendChatMessage(); }}
                  placeholder="Escreva sua pergunta..."
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleSendChatMessage}
                  disabled={!inputMessage.trim() || chatLoading}
                  className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-sm disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

          </div>
        )}

      {pendingConfirm && (
        <ConfirmDialog
          open={Boolean(pendingConfirm)}
          title={pendingConfirm.title}
          message={pendingConfirm.message}
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          variant="danger"
          loading={confirmLoading}
          onConfirm={async () => {
            try {
              setConfirmLoading(true);
              await pendingConfirm.onConfirm();
              setPendingConfirm(null);
            } finally {
              setConfirmLoading(false);
            }
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </>
  );
}
