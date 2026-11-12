import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AudioLines, Eye, EyeOff, Check, AlertCircle, RefreshCw, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { apiBase } from '../../../lib/apiBase';
import { Permissao } from '../../../lib/permissoes/Permissao';

/**
 * Integrações → ElevenLabs (voz do agente de IA no WhatsApp).
 * O agente entende as mensagens de voz (transcrição só interna, não aparece na
 * conversa) e responde com áudio: voz masculina para homem, feminina para mulher.
 * Grava em settings.elevenlabs_configuration — ver src/lib/elevenlabs.ts.
 */

type Voz = { id: string; nome: string; sexo: string; idioma: string };

const URL_API = `${apiBase}/integracoes/elevenlabs`;

function cabecalhos(): Record<string, string> {
  const token = localStorage.getItem('mrm_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function ElevenLabsConfig() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const [ativo, setAtivo] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [verChave, setVerChave] = useState(false);
  const [vozMasculina, setVozMasculina] = useState('');
  const [vozFeminina, setVozFeminina] = useState('');
  const [responderComAudio, setResponderComAudio] = useState(true);
  const [vozes, setVozes] = useState<Voz[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(URL_API, { headers: cabecalhos(), cache: 'no-store' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Falha ao carregar');
        setAtivo(!!d.ativo);
        setApiKey(d.apiKey || '');
        setVozMasculina(d.vozMasculina || '');
        setVozFeminina(d.vozFeminina || '');
        setResponderComAudio(d.responderComAudio !== false);
        setVozes(Array.isArray(d.vozes) ? d.vozes : []);
        if (d.erroVozes) setErro(`ElevenLabs: ${d.erroVozes}`);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Falha ao carregar');
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  // brasileiras primeiro: são as que falam português sem sotaque
  const vozesOrdenadas = useMemo(
    () => [...vozes].sort((a, b) => Number(b.idioma === 'pt' || /brazil/i.test(b.idioma)) - Number(a.idioma === 'pt' || /brazil/i.test(a.idioma)) || a.nome.localeCompare(b.nome)),
    [vozes],
  );

  const salvar = async () => {
    setSalvando(true); setErro(''); setAviso('');
    try {
      const r = await fetch(URL_API, {
        method: 'POST', headers: cabecalhos(), cache: 'no-store',
        body: JSON.stringify({ ativo, apiKey, vozMasculina, vozFeminina, responderComAudio }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Falha ao salvar');
      setApiKey(d.apiKey || '');
      setAviso('Configuração da ElevenLabs salva.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {
    setTestando(true); setErro(''); setAviso('');
    try {
      const r = await fetch(`${URL_API}?test=true`, { method: 'POST', headers: cabecalhos(), cache: 'no-store', body: JSON.stringify({ apiKey }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Falha na conexão');
      setVozes(Array.isArray(d.vozes) ? d.vozes : []);
      setAviso(d.message || 'Conexão ok.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha na conexão');
    } finally {
      setTestando(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-white focus:outline-none focus:border-pink-500';

  const seletorVoz = (valor: string, mudar: (v: string) => void) =>
    vozes.length ? (
      <select value={valor} onChange={(e) => mudar(e.target.value)} className={inputCls}>
        {!vozes.some((v) => v.id === valor) && valor && <option value={valor}>{valor}</option>}
        {vozesOrdenadas.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nome}{v.sexo ? ` · ${v.sexo === 'male' ? 'masculina' : v.sexo === 'female' ? 'feminina' : v.sexo}` : ''}{v.idioma ? ` · ${v.idioma}` : ''}
          </option>
        ))}
      </select>
    ) : (
      <input value={valor} onChange={(e) => mudar(e.target.value)} placeholder="ID da voz" className={`${inputCls} font-mono`} />
    );

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <button type="button" onClick={() => navigate('/app-ui/system-settings')} title="Voltar"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-pink-500 flex items-center justify-center">
              <AudioLines className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">ElevenLabs</h1>
          </div>
          <p className="text-sm text-slate-500">Voz do agente de IA no WhatsApp: entende os áudios e responde com áudio</p>
        </div>
      </div>

      {carregando ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-pink-500 animate-spin mb-4" />
          <p className="text-sm text-slate-500 font-medium">Carregando...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {erro && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" /><span className="text-sm font-semibold">{erro}</span>
            </div>
          )}
          {aviso && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3">
              <Check className="w-5 h-5 flex-shrink-0" /><span className="text-sm font-semibold">{aviso}</span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 text-base">{ativo ? 'Integração ligada' : 'Integração desligada'}</h3>
              <p className="text-sm text-slate-500">
                Ligada: as mensagens de voz são transcritas só para o agente entender (a transcrição não aparece na conversa).
              </p>
            </div>
            <button type="button" onClick={() => setAtivo((v) => !v)} className="focus:outline-none" title={ativo ? 'Desligar' : 'Ligar'}>
              {ativo ? <ToggleRight className="w-14 h-10 text-pink-500" /> : <ToggleLeft className="w-14 h-10 text-slate-400" />}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Chave de API (xi-api-key)</label>
              <div className="relative">
                <input type={verChave ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_..." className={`${inputCls} pr-10 font-mono`} autoComplete="off" />
                <button type="button" onClick={() => setVerChave((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" title="Mostrar/ocultar">
                  {verChave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Voz para homens</label>
                {seletorVoz(vozMasculina, setVozMasculina)}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Voz para mulheres</label>
                {seletorVoz(vozFeminina, setVozFeminina)}
              </div>
            </div>
            <p className="text-xs text-slate-500">
              O atendente tem o mesmo sexo da pessoa: homem ouve a voz masculina; mulher (ou quando ainda não se sabe) ouve a feminina.
            </p>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={responderComAudio} onChange={(e) => setResponderComAudio(e.target.checked)} className="w-4 h-4 mt-0.5 accent-pink-600" />
              <span>
                Quando a pessoa mandar áudio, responder com áudio
                <span className="block text-xs text-slate-500">
                  Antes do envio ela vê “Gravando áudio...”. Links, questionário e opções vão também por escrito logo depois.
                </span>
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <Permissao chave="elevenlabs_config.eleven_labs.testar" rotulo="Testar conexão — ElevenLabs" herda="elevenlabs_config.view">
              <button type="button" onClick={testar} disabled={testando}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2">
                {testando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Testar conexão
              </button>
            </Permissao>
            <Permissao chave="elevenlabs_config.eleven_labs.salvar" rotulo="Salvar — ElevenLabs" herda="elevenlabs_config.view">
              <button type="button" onClick={salvar} disabled={salvando}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2">
                {salvando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
              </button>
            </Permissao>
          </div>
        </div>
      )}
    </div>
  );
}
