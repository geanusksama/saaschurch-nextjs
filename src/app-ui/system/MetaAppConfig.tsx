/**
 * Sistema → Meta – App oficial (somente master).
 * Configuração central do app da Meta usada por todas as igrejas.
 * Contrato HTTP: /api/meta/app-config (PUT) e /api/meta/app-config/admin (GET).
 * A chave secreta nunca é exibida: só dá para trocá-la.
 */
import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, ExternalLink, Save } from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
import { cabecalhos, lerErro } from '../../lib/meta/clienteHttp';
import { Permissao } from '../../lib/permissoes/Permissao';

type Visao = {
  appId: string;
  configId: string;
  graphVersion: string;
  verifyToken: string;
  appSecretDefinido: boolean;
  conexaoLiberada: boolean;
  base: boolean;
};

const BASE = `${apiBase}/meta/app-config`;
const LINK_EMPRESA = 'https://business.facebook.com/settings/security?business_id=2291140898081009';
const LINK_APP = 'https://developers.facebook.com/apps/3371798666355530/';

const campoClasse =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100';

export default function MetaAppConfig() {
  const [visao, setVisao] = useState<Visao | null>(null);
  const [form, setForm] = useState({ appId: '', configId: '', graphVersion: '', verifyToken: '', appSecret: '' });
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [webhook, setWebhook] = useState<'ok' | 'falhou' | 'testando' | null>(null);

  const aplicar = (v: Visao) => {
    setVisao(v);
    setForm({ appId: v.appId, configId: v.configId, graphVersion: v.graphVersion, verifyToken: v.verifyToken, appSecret: '' });
  };

  useEffect(() => {
    let vivo = true;
    fetch(`${BASE}/admin`, { headers: cabecalhos() })
      .then(async (r) => {
        if (!r.ok) throw new Error(await lerErro(r));
        return (await r.json()) as Visao;
      })
      .then((v) => {
        if (vivo) aplicar(v);
      })
      .catch((e) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Falha ao carregar a configuração.');
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const enviar = async (corpo: Record<string, unknown>, mensagem: string) => {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch(BASE, { method: 'PUT', headers: cabecalhos(true), body: JSON.stringify(corpo) });
      if (!r.ok) throw new Error(await lerErro(r));
      const v = (await r.json()) as Omit<Visao, 'base'>;
      aplicar({ ...v, base: visao?.base ?? true });
      setAviso(mensagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setOcupado(false);
    }
  };

  const salvar = () => {
    const corpo: Record<string, unknown> = {};
    const campos = ['appId', 'configId', 'graphVersion', 'verifyToken'] as const;
    for (const k of campos) {
      if (form[k].trim() !== (visao?.[k] ?? '')) corpo[k] = form[k];
    }
    if (form.appSecret.trim()) corpo.appSecret = form.appSecret;
    if (!Object.keys(corpo).length) {
      setErro(null);
      setAviso('Nada foi alterado.');
      return;
    }
    void enviar(corpo, 'Configuração salva.');
  };

  const alternar = () => {
    if (!visao) return;
    void enviar(
      { conexaoLiberada: !visao.conexaoLiberada },
      !visao.conexaoLiberada ? 'Conexão liberada para as igrejas.' : 'Conexão bloqueada: as igrejas veem “Em breve”.',
    );
  };

  const testarWebhook = async () => {
    if (!visao?.verifyToken) return;
    setWebhook('testando');
    try {
      const desafio = String(Math.floor(Math.random() * 1e9));
      const qs = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': visao.verifyToken, 'hub.challenge': desafio });
      const r = await fetch(`${apiBase}/meta/whatsapp/webhook?${qs.toString()}`);
      setWebhook(r.ok && (await r.text()) === desafio ? 'ok' : 'falhou');
    } catch {
      setWebhook('falhou');
    }
  };

  const campo = (rotulo: string, chave: 'appId' | 'configId' | 'graphVersion' | 'verifyToken', dica?: string) => (
    <label className="block text-sm">
      <span className="text-slate-600 dark:text-slate-300">{rotulo}</span>
      <input
        className={campoClasse}
        value={form[chave]}
        onChange={(e) => setForm({ ...form, [chave]: e.target.value })}
        autoComplete="off"
      />
      {dica && <span className="text-xs text-slate-500">{dica}</span>}
    </label>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Meta – App oficial</h1>
        <p className="text-sm text-slate-500">
          Configuração central do app da Meta (WhatsApp Cloud API), usada por todas as igrejas.
        </p>
      </header>

      {erro && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}
      {aviso && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {carregando && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}

      {!carregando && visao && (
        <>
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Liberação para as igrejas</h2>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Liberar conexão para as igrejas
                <span className="block text-xs text-slate-500">
                  Desligado, as igrejas veem “Em breve” no lugar de “Conectar com a Meta”.
                </span>
              </p>
              <Permissao chave="meta_app.config.editar" rotulo="Alterar a configuração do app da Meta" herda="meta_app.view">
                <button
                  role="switch"
                  aria-checked={visao.conexaoLiberada}
                  aria-label="Liberar conexão para as igrejas"
                  onClick={alternar}
                  disabled={ocupado}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${visao.conexaoLiberada ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block size-5 rounded-full bg-white transition-transform ${visao.conexaoLiberada ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </Permissao>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Configuração do app</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {campo('ID do app', 'appId')}
              {campo('Configuração do Embedded Signup', 'configId')}
              {campo('Versão da Graph API', 'graphVersion', 'Formato v25.0')}
              {campo('Token do webhook', 'verifyToken')}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Chave secreta:{' '}
                <span className={`font-semibold ${visao.appSecretDefinido ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {visao.appSecretDefinido ? 'definida' : 'não definida'}
                </span>
              </p>
              <input
                type="password"
                className={campoClasse}
                value={form.appSecret}
                onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
                placeholder="Nova chave secreta (deixe vazio para manter a atual)"
                autoComplete="new-password"
              />
            </div>
            <Permissao chave="meta_app.config.editar" rotulo="Alterar a configuração do app da Meta" herda="meta_app.view">
              <button
                onClick={salvar}
                disabled={ocupado}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar
              </button>
            </Permissao>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Status</h2>
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>ID do app: {visao.appId ? 'presente' : 'ausente'}</li>
              <li>Configuração do Embedded Signup: {visao.configId ? 'presente' : 'ausente'}</li>
              <li>Versão da Graph API: {visao.graphVersion || '—'}</li>
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void testarWebhook()}
                disabled={webhook === 'testando' || !visao.verifyToken}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50"
              >
                Testar webhook
              </button>
              {webhook === 'testando' && <Loader2 className="size-4 animate-spin text-slate-500" />}
              {webhook === 'ok' && <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">OK</span>}
              {webhook === 'falhou' && <span className="text-sm font-semibold text-red-700 dark:text-red-400">Falhou</span>}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <p>
                Verificação da empresa:{' '}
                <a className="inline-flex items-center gap-1 underline" href={LINK_EMPRESA} target="_blank" rel="noreferrer">
                  Ver na Meta <ExternalLink className="size-3" />
                </a>
              </p>
              <p>
                Análise do app:{' '}
                <a className="inline-flex items-center gap-1 underline" href={LINK_APP} target="_blank" rel="noreferrer">
                  Ver na Meta <ExternalLink className="size-3" />
                </a>
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
