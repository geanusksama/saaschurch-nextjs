import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, ToggleLeft, ToggleRight, Trash2, Edit2, Check, AlertCircle, RefreshCw, User, Bot, Sparkles, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { apiBase } from '../../lib/apiBase';

interface AiAgent {
  id: string;
  name: string;
  description: string | null;
  role: string;
  systemPrompt: string;
  avatarUrl: string | null;
  isActive: boolean;
}

export default function AiAgents() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estados do Modal
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AiAgent | null>(null);

  // Estados do Formulário
  const [name, setName] = useState('');
  const [role, setRole] = useState('financeiro');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Carregar agentes
  const loadAgents = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('mrm_token');
      const res = await fetch(`${apiBase}/ai/agents`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      } else {
        throw new Error('Falha ao carregar agentes.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  // Abrir Modal de Criação
  const handleOpenCreate = () => {
    setEditingAgent(null);
    setName('');
    setRole('financeiro');
    setDescription('');
    setSystemPrompt('');
    setAvatarUrl('');
    setIsActive(true);
    setShowModal(true);
  };

  // Abrir Modal de Edição
  const handleOpenEdit = (agent: AiAgent) => {
    setEditingAgent(agent);
    setName(agent.name);
    setRole(agent.role);
    setDescription(agent.description || '');
    setSystemPrompt(agent.systemPrompt);
    setAvatarUrl(agent.avatarUrl || '');
    setIsActive(agent.isActive);
    setShowModal(true);
  };

  // Salvar Agente
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim() || !systemPrompt.trim()) {
      setError('Nome e Prompt do Sistema são obrigatórios.');
      return;
    }

    try {
      const token = localStorage.getItem('mrm_token');
      const url = editingAgent 
        ? `${apiBase}/ai/agents/${editingAgent.id}`
        : `${apiBase}/ai/agents`;
      const method = editingAgent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name,
          role,
          description,
          systemPrompt,
          avatarUrl: avatarUrl || null,
          isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar agente.');
      }

      setSuccess(editingAgent ? 'Agente atualizado!' : 'Agente criado!');
      setShowModal(false);
      loadAgents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Alternar status ativo
  const handleToggleActive = async (agent: AiAgent) => {
    try {
      const token = localStorage.getItem('mrm_token');
      const res = await fetch(`${apiBase}/ai/agents/${agent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          isActive: !agent.isActive,
        }),
      });

      if (res.ok) {
        loadAgents();
      }
    } catch (err: any) {
      setError('Erro ao alternar status do agente: ' + err.message);
    }
  };

  // Excluir Agente
  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este agente especialista?')) return;
    setError('');
    try {
      const token = localStorage.getItem('mrm_token');
      const res = await fetch(`${apiBase}/ai/agents/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error('Erro ao deletar.');
      }

      setSuccess('Agente excluído com sucesso.');
      loadAgents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app-ui/configuration-center')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Agentes de IA</h1>
            </div>
            <p className="text-sm text-slate-500">Gerencie e treine agentes inteligentes com especialidades financeiras ou administrativas</p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-indigo-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-indigo-700 active:scale-98 shadow-sm flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Agente</span>
        </button>
      </div>

      {/* Alertas */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{success}</span>
        </div>
      )}

      {loading && agents.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
          <p className="text-sm text-slate-500 font-medium">Carregando agentes especialistas...</p>
        </div>
      )}

      {(!loading || agents.length > 0) && (
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* Card Novo Agente (Dashed Placeholder) */}
          <div 
            onClick={handleOpenCreate}
            className="border-2 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/20 hover:shadow-md transition-all group min-h-[220px]"
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 mb-3 transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">Novo Agente</h3>
            <p className="text-xs text-slate-400 max-w-[200px] mt-1">Crie um assistente virtual com prompt e instrução personalizada</p>
          </div>

          {/* Cards dos Agentes */}
          {agents.map((agent) => (
            <div 
              key={agent.id}
              className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[220px] transition-all hover:shadow-md ${
                agent.isActive ? 'border-slate-200' : 'border-slate-100 bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      agent.isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {agent.avatarUrl ? (
                        <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <Bot className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{agent.name}</h3>
                      <span className="inline-block text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md px-1.5 py-0.5 uppercase tracking-wider mt-0.5">
                        {agent.role === 'financeiro' ? 'Financeiro' : agent.role === 'secretaria' ? 'Secretaria' : 'Geral'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleActive(agent)}
                    className="focus:outline-none active:scale-95 text-slate-500"
                  >
                    {agent.isActive ? (
                      <ToggleRight className="w-9 h-6 text-indigo-600 fill-indigo-100" />
                    ) : (
                      <ToggleLeft className="w-9 h-6 text-slate-400" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-500 mt-3.5 line-clamp-2 min-h-[32px]">{agent.description || 'Nenhuma descrição fornecida.'}</p>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>PROMPT PERSONALIZADO</span>
                  </span>
                  <span>{agent.isActive ? 'Ativo' : 'Inativo'}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  onClick={() => handleOpenEdit(agent)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                  title="Editar agente"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(agent.id)}
                  className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                  title="Excluir agente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

        </div>
      )}

      {/* Modal Criar/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-lg">
                {editingAgent ? 'Editar Agente Especialista' : 'Criar Novo Agente Especialista'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome do Agente *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Auxiliar Financeiro, Secretária Virtual"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Especialidade / Função *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-slate-50 font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white"
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
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:outline-none focus:border-indigo-500"
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
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Instruções / Prompt do Sistema *</label>
                <textarea
                  required
                  rows={5}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Defina as regras do agente, personalidade, restrições e escopo. Ex: 'Você é focado em relatórios financeiros, seja formal e use formatação de tabela quando listar valores...'"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-slate-800">Status do Agente</p>
                  <p className="text-[10px] text-slate-500">Agentes ativos ficam disponíveis para chat imediato.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className="focus:outline-none active:scale-95"
                >
                  {isActive ? (
                    <ToggleRight className="w-10 h-7 text-indigo-600 fill-indigo-100" />
                  ) : (
                    <ToggleLeft className="w-10 h-7 text-slate-400" />
                  )}
                </button>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold active:scale-98 transition-all"
                >
                  {editingAgent ? 'Atualizar Agente' : 'Criar Agente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
