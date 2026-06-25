import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Key, Cpu, ToggleLeft, ToggleRight, Check, AlertCircle, RefreshCw, Eye, EyeOff, Save } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { apiBase } from '../../lib/apiBase';

export default function AiSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState('');

  // Estados das configurações
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiProvider, setAiProvider] = useState<'openai' | 'anthropic'>('openai');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiMaxTokens, setAiMaxTokens] = useState(2000);
  const [aiTranscriptionEnabled, setAiTranscriptionEnabled] = useState(false);
  const [aiTranscriptionLang, setAiTranscriptionLang] = useState('Português');

  // Visibilidade da chave
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  // Carregar configurações
  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const token = localStorage.getItem('mrm_token');
        const res = await fetch(`${apiBase}/ai/settings`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setAiEnabled(data.aiEnabled ?? true);
          setAiProvider(data.aiProvider || 'openai');
          setOpenaiApiKey(data.openaiApiKey || '');
          setAnthropicApiKey(data.anthropicApiKey || '');
          setAiModel(data.aiModel || 'gpt-4o-mini');
          setAiMaxTokens(data.aiMaxTokens || 2000);
          setAiTranscriptionEnabled(data.aiTranscriptionEnabled || false);
          setAiTranscriptionLang(data.aiTranscriptionLang || 'Português');
        }
      } catch (err: any) {
        setError('Erro ao carregar configurações: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Salvar configurações
  const handleSave = async () => {
    setSaveSuccess('');
    setError('');
    setLoading(true);
    try {
      const token = localStorage.getItem('mrm_token');
      const res = await fetch(`${apiBase}/ai/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          aiEnabled,
          aiProvider,
          openaiApiKey,
          anthropicApiKey,
          aiModel,
          aiMaxTokens,
          aiTranscriptionEnabled,
          aiTranscriptionLang,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar.');
      }

      setSaveSuccess('Configurações salvas com sucesso!');
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar configurações.');
    } finally {
      setLoading(false);
    }
  };

  // Testar Conexão
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const token = localStorage.getItem('mrm_token');
      const res = await fetch(`${apiBase}/ai/settings?test=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          aiProvider,
          openaiApiKey: aiProvider === 'openai' ? openaiApiKey : '',
          anthropicApiKey: aiProvider === 'anthropic' ? anthropicApiKey : '',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: data.message || 'Conexão estabelecida com sucesso!' });
      } else {
        setTestResult({ success: false, message: data.error || 'Falha na conexão. Verifique a chave de API.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: 'Erro de rede: ' + err.message });
    } finally {
      setTesting(false);
    }
  };

  // Ajustar modelos padrão quando provedor muda
  const handleProviderChange = (prov: 'openai' | 'anthropic') => {
    setAiProvider(prov);
    if (prov === 'openai') {
      setAiModel('gpt-4o-mini');
    } else {
      setAiModel('claude-3-5-sonnet-20241022');
    }
  };

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/app-ui/configuration-center')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Configurações de IA</h1>
          </div>
          <p className="text-sm text-slate-500">Configure integrações com provedores de inteligência artificial</p>
        </div>
      </div>

      {loading && !openaiApiKey && (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
          <p className="text-sm text-slate-500 font-medium">Carregando configurações...</p>
        </div>
      )}

      {(!loading || openaiApiKey) && (
        <div className="space-y-6">
          {/* Alertas */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-semibold">{error}</span>
            </div>
          )}
          {saveSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-semibold">{saveSuccess}</span>
            </div>
          )}

          {/* Toggle IA Habilitada */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">IA Habilitada</h3>
                <p className="text-sm text-emerald-700 font-medium">Transcrição de áudio e sugestões automáticas ativas</p>
              </div>
            </div>
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className="text-emerald-600 focus:outline-none transition-transform active:scale-95"
            >
              {aiEnabled ? (
                <ToggleRight className="w-14 h-10 text-emerald-500 fill-emerald-100" />
              ) : (
                <ToggleLeft className="w-14 h-10 text-slate-400" />
              )}
            </button>
          </div>

          {/* Grid de Configurações */}
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Coluna Esquerda: API Keys & Features */}
            <div className="space-y-6">
              
              {/* Card API Keys */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
                  <Key className="w-5 h-5 text-slate-500" />
                  <h3 className="font-bold text-slate-800 text-base">Provedor & API Key</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Provedor Ativo</label>
                    <select
                      value={aiProvider}
                      onChange={(e) => handleProviderChange(e.target.value as 'openai' | 'anthropic')}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-slate-50 font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white"
                    >
                      <option value="openai">OpenAI (Recomendado)</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                    </select>
                  </div>

                  {aiProvider === 'openai' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Chave de API OpenAI *</label>
                      <div className="relative">
                        <input
                          type={showOpenaiKey ? "text" : "password"}
                          value={openaiApiKey}
                          onChange={(e) => setOpenaiApiKey(e.target.value)}
                          placeholder="sk-proj-..."
                          className="w-full rounded-xl border border-slate-200 p-2.5 pr-10 text-sm font-mono focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-600 font-semibold mt-1 inline-block hover:underline"
                      >
                        Obter chave de API no painel da OpenAI
                      </a>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Chave de API Anthropic *</label>
                      <div className="relative">
                        <input
                          type={showAnthropicKey ? "text" : "password"}
                          value={anthropicApiKey}
                          onChange={(e) => setAnthropicApiKey(e.target.value)}
                          placeholder="sk-ant-..."
                          className="w-full rounded-xl border border-slate-200 p-2.5 pr-10 text-sm font-mono focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <a
                        href="https://console.anthropic.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-600 font-semibold mt-1 inline-block hover:underline"
                      >
                        Obter chave de API no console da Anthropic
                      </a>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testing}
                      className="w-full py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 active:scale-98 transition-all flex items-center justify-center gap-2"
                    >
                      {testing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                          <span>Testando Conexão...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-emerald-500" />
                          <span>Testar Conexão</span>
                        </>
                      )}
                    </button>
                  </div>

                  {testResult && (
                    <div className={`p-3.5 rounded-xl border text-xs font-medium ${
                      testResult.success ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
                    }`}>
                      <div className="flex gap-2 items-start">
                        {testResult.success ? <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                        <span>{testResult.message}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Features Info */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-slate-800 text-base">Funcionalidades de IA</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-sm text-slate-600">
                    <span className="text-base flex-shrink-0">🎙️</span>
                    <span><strong>Transcrição de áudios</strong> do WhatsApp (Whisper API)</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-600">
                    <span className="text-base flex-shrink-0">💡</span>
                    <span><strong>Sugestões inteligentes</strong> de respostas aos membros</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-600">
                    <span className="text-base flex-shrink-0">🧠</span>
                    <span><strong>Análise de sentimento</strong> de conversas</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-600">
                    <span className="text-base flex-shrink-0">📋</span>
                    <span><strong>Resumos automáticos</strong> de reuniões e chamadas</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm text-slate-600 text-slate-400">
                    <span className="text-base flex-shrink-0">🤖</span>
                    <span>Assistente virtual para vendas <em>(em breve)</em></span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Coluna Direita: Model Config & Audio */}
            <div className="space-y-6">
              
              {/* Card Modelo */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
                  <Cpu className="w-5 h-5 text-slate-500" />
                  <h3 className="font-bold text-slate-800 text-base">Configuração do Modelo</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Modelo de IA</label>
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-slate-50 font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white"
                    >
                      {aiProvider === 'openai' ? (
                        <>
                          <option value="gpt-4o-mini">GPT-4o Mini (Mais Rápido & Econômico)</option>
                          <option value="gpt-4o">GPT-4o (Mais Inteligente)</option>
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legado)</option>
                        </>
                      ) : (
                        <>
                          <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Excelente)</option>
                          <option value="claude-3-haiku-20240307">Claude 3 Haiku (Rápido)</option>
                          <option value="claude-3-opus-20240229">Claude 3 Opus (Raciocínio complexo)</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Máximo de Tokens</label>
                    <input
                      type="number"
                      value={aiMaxTokens}
                      onChange={(e) => setAiMaxTokens(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">Afeta o custo e o tamanho da resposta que o agente pode gerar.</p>
                  </div>
                </div>
              </div>

              {/* Card Transcrição e Idioma */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                  <h3 className="font-bold text-slate-800 text-base">Transcrição e Idioma</h3>
                  <button
                    onClick={() => setAiTranscriptionEnabled(!aiTranscriptionEnabled)}
                    className="focus:outline-none active:scale-95"
                  >
                    {aiTranscriptionEnabled ? (
                      <ToggleRight className="w-10 h-7 text-emerald-500 fill-emerald-100" />
                    ) : (
                      <ToggleLeft className="w-10 h-7 text-slate-400" />
                    )}
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Transcrição de Áudio</p>
                      <p className="text-xs text-slate-500">Transcrição automática de áudios recebidos no WhatsApp</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Idioma Padrão</label>
                    <select
                      value={aiTranscriptionLang}
                      onChange={(e) => setAiTranscriptionLang(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-slate-50 font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white"
                    >
                      <option value="Português">Português</option>
                      <option value="Inglês">Inglês</option>
                      <option value="Espanhol">Espanhol</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Botão de Ação Salvar */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-emerald-600 text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-emerald-700 active:scale-98 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Salvar Configurações</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
