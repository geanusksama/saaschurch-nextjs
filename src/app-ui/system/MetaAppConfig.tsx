/**
 * Sistema → Meta – App oficial (somente master).
 * Configuração central do app da Meta usada por todas as igrejas.
 * Contrato HTTP: /api/meta/app-config (PUT) e /api/meta/app-config/admin (GET).
 * A chave secreta nunca é exibida: só dá para trocá-la.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, ExternalLink, Save } from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
import { cabecalhos, lerErro } from '../../lib/meta/clienteHttp';
import { Permissao } from '../../lib/permissoes/Permissao';
import { LINK_TABELA_OFICIAL } from '../../lib/meta/custoFormato';

type Visao = {
  appId: string;
  configId: string;
  graphVersion: string;
  verifyToken: string;
  appSecretDefinido: boolean;
  conexaoLiberada: boolean;
  base: boolean;
};

type Alerta = {
  id: string;
  campoId: string | null;
  campoNome?: string | null;
  tipo: string;
  mensagem: string;
  proposta: unknown;
  criadoEm: string;
};

type LinhaPreco = { categoria: string; moeda: string; preco: string; vigencia: string };
const CATEGORIAS_PRECO = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const ROTULO_CATEGORIA: Record<string, string> = { MARKETING: 'Marketing', UTILITY: 'Utilidade', AUTHENTICATION: 'Autenticação' };

const BASE = `${apiBase}/meta/app-config`;
const LINK_EMPRESA = 'https://business.facebook.com/settings/security?business_id=2291140898081009';
const LINK_APP = 'https://developers.facebook.com/apps/3371798666355530/';

const campoClasse =
  'w-full rounded-xl border-[1.5px] border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:shadow-[0_0_0_4px_rgba(15,23,42,.08)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-300';

/** `embutido`: só esconde o cabeçalho de página (usado dentro da central Meta Oficial). */
export default function MetaAppConfig({ embutido = false }: { embutido?: boolean } = {}) {
  const [visao, setVisao] = useState<Visao | null>(null);
  const [form, setForm] = useState({ appId: '', configId: '', graphVersion: '', verifyToken: '', appSecret: '' });
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [webhook, setWebhook] = useState<'ok' | 'falhou' | 'testando' | null>(null);

  const [precos, setPrecos] = useState<LinhaPreco[]>([]);
  const [precosOcupado, setPrecosOcupado] = useState(false);
  const [precosMsg, setPrecosMsg] = useState<string | null>(null);

  // linhas da tabela: as que já existem + as 3 categorias na moeda delas (ou USD), para o master preencher
  const montarLinhas = (lista: Array<{ categoria: string; moeda: string; preco: number; vigencia: string | null }>): LinhaPreco[] => {
    const moeda = lista[0]?.moeda ?? 'USD';
    const linhas: LinhaPreco[] = lista.map((x) => ({ categoria: x.categoria, moeda: x.moeda, preco: String(x.preco), vigencia: x.vigencia ?? '' }));
    for (const c of CATEGORIAS_PRECO) {
      if (!linhas.some((l) => l.categoria === c)) linhas.push({ categoria: c, moeda, preco: '', vigencia: '' });
    }
    return linhas.sort((a, b) => CATEGORIAS_PRECO.indexOf(a.categoria) - CATEGORIAS_PRECO.indexOf(b.categoria));
  };

  const salvarPrecos = async () => {
    const preenchidas = precos.filter((l) => l.preco.trim() !== '');
    if (!preenchidas.length) {
      setErro('Preencha ao menos um preço.');
      return;
    }
    setPrecosOcupado(true);
    setErro(null);
    setAviso(null);
    setPrecosMsg(null);
    try {
      const corpo = { precos: preenchidas.map((l) => ({ categoria: l.categoria, moeda: l.moeda, preco: l.preco, vigencia: l.vigencia || null })) };
      const r = await fetch(`${BASE}/precos`, { method: 'PUT', headers: cabecalhos(true), body: JSON.stringify(corpo) });
      if (!r.ok) throw new Error(await lerErro(r));
      const j = (await r.json()) as { precos?: Array<{ categoria: string; moeda: string; preco: number; vigencia: string | null }> };
      setPrecos(montarLinhas(j.precos ?? []));
      setPrecosMsg('Tabela de preços salva.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a tabela de preços.');
    } finally {
      setPrecosOcupado(false);
    }
  };

  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [alertaOcupado, setAlertaOcupado] = useState<string | null>(null);

  const carregarAlertas = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/alertas`, { headers: cabecalhos() });
      if (!r.ok) return;
      const j = (await r.json()) as { alertas?: Alerta[] };
      setAlertas(j.alertas ?? []);
    } catch {
      /* lista fica como está */
    }
  }, []);

  const tratarAlerta = async (id: string, acao: 'resolver' | 'aprovar') => {
    setAlertaOcupado(id);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch(`${BASE}/alertas/${id}`, { method: 'POST', headers: cabecalhos(true), body: JSON.stringify({ acao }) });
      if (!r.ok) throw new Error(await lerErro(r));
      setAviso(acao === 'aprovar' ? 'Proposta aplicada e alerta resolvido.' : 'Alerta resolvido.');
      await carregarAlertas();
      if (acao === 'aprovar') {
        const rv = await fetch(`${BASE}/admin`, { headers: cabecalhos() });
        if (rv.ok) aplicar((await rv.json()) as Visao);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível tratar o alerta.');
    } finally {
      setAlertaOcupado(null);
    }
  };

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
    fetch(`${BASE}/precos`, { headers: cabecalhos(), cache: 'no-store' })
      .then(async (r) => (r.ok ? ((await r.json()) as { precos?: Array<{ categoria: string; moeda: string; preco: number; vigencia: string | null }> }) : null))
      .then((j) => {
        if (vivo && j) setPrecos(montarLinhas(j.precos ?? []));
      })
      .catch(() => {
        /* a tabela fica com as linhas vazias */
      });
    fetch(`${BASE}/alertas`, { headers: cabecalhos() })
      .then(async (r) => (r.ok ? ((await r.json()) as { alertas?: Alerta[] }) : null))
      .then((j) => {
        if (vivo && j) setAlertas(j.alertas ?? []);
      })
      .catch(() => {
        /* lista fica vazia */
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
        disabled={!visao?.base}
      />
      {dica && <span className="text-xs text-slate-500">{dica}</span>}
    </label>
  );

  return (
    <div className={`space-y-3 ${embutido ? '' : 'px-3 py-3 md:px-7 md:py-4'}`}>
      {!embutido && (
        <header>
          <h1 className="text-[17px] font-bold text-slate-900 dark:text-slate-100">Meta – App oficial</h1>
          <p className="text-sm text-slate-500">
            Configuração central do app da Meta (WhatsApp Cloud API), usada por todas as igrejas.
          </p>
        </header>
      )}

      {erro && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}
      {aviso && (
        <div role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
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
          <section className="rounded-[18px] border border-[#e8ecf1] bg-white p-5 md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Liberação para as igrejas</h2>
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
                  disabled={ocupado || !visao.base}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${visao.conexaoLiberada ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block size-5 rounded-full bg-white transition-transform ${visao.conexaoLiberada ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </Permissao>
            </div>
          </section>

          <section className="rounded-[18px] border border-[#e8ecf1] bg-white p-5 md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Configuração do app</h2>
            {!visao.base && (
              <p role="note" className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                Edite no sistema base (Campinas).
              </p>
            )}
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
                disabled={!visao.base}
                onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
                placeholder="Nova chave secreta (deixe vazio para manter a atual)"
                autoComplete="new-password"
              />
            </div>
            {visao.base && (
            <Permissao chave="meta_app.config.editar" rotulo="Alterar a configuração do app da Meta" herda="meta_app.view">
              <button
                onClick={salvar}
                disabled={ocupado}
                className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-slate-900 px-3.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar
              </button>
            </Permissao>
            )}
          </section>

          <section className="rounded-[18px] border border-[#e8ecf1] bg-white p-5 md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800 space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Tabela de preços da Meta</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Usada para mostrar o valor estimado antes de cada envio e o gasto do mês em todas as igrejas. A Meta cobra por mensagem entregue,
              direto no cartão de cada campo; o sistema só estima. Sem preço preenchido, a tela diz “preço não configurado”.
            </p>
            {!visao.base && (
              <p role="note" className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                Edite no sistema base (Campinas).
              </p>
            )}
            <div className="space-y-2">
              {precos.map((l, i) => (
                <div key={`${l.categoria}-${l.moeda}`} className="grid grid-cols-2 sm:grid-cols-[1fr_90px_140px_160px] gap-2 items-end">
                  <p className="col-span-2 sm:col-span-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{ROTULO_CATEGORIA[l.categoria] ?? l.categoria}</p>
                  <label className="block text-xs text-slate-500">
                    Moeda
                    <input className={campoClasse} value={l.moeda} maxLength={3} disabled={!visao.base}
                      onChange={(e) => setPrecos(precos.map((x, j) => (j === i ? { ...x, moeda: e.target.value.toUpperCase() } : x)))} />
                  </label>
                  <label className="block text-xs text-slate-500">
                    Preço por mensagem
                    <input className={campoClasse} inputMode="decimal" placeholder="0,0068" value={l.preco} disabled={!visao.base}
                      onChange={(e) => setPrecos(precos.map((x, j) => (j === i ? { ...x, preco: e.target.value } : x)))} />
                  </label>
                  <label className="block text-xs text-slate-500">
                    Vigência (a partir de)
                    <input type="date" className={campoClasse} value={l.vigencia} disabled={!visao.base}
                      onChange={(e) => setPrecos(precos.map((x, j) => (j === i ? { ...x, vigencia: e.target.value } : x)))} />
                  </label>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Tabela oficial da Meta:{' '}
              <a className="inline-flex items-center gap-1 underline" href={LINK_TABELA_OFICIAL} target="_blank" rel="noreferrer">
                Ver preços por país <ExternalLink className="size-3" />
              </a>
            </p>
            {precosMsg && <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{precosMsg}</p>}
            {visao.base && (
              <Permissao chave="meta_app.precos.editar" rotulo="Editar tabela de preços da Meta" herda="meta_app.config.editar">
                <button
                  onClick={() => void salvarPrecos()}
                  disabled={precosOcupado}
                  className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-slate-900 px-3.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {precosOcupado ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Salvar preços
                </button>
              </Permissao>
            )}
          </section>

          <section className="rounded-[18px] border border-[#e8ecf1] bg-white p-5 md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800 space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Status</h2>
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>ID do app: {visao.appId ? 'presente' : 'ausente'}</li>
              <li>Configuração do Embedded Signup: {visao.configId ? 'presente' : 'ausente'}</li>
              <li>Versão da Graph API: {visao.graphVersion || '—'}</li>
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void testarWebhook()}
                disabled={webhook === 'testando' || !visao.verifyToken}
                className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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

          <section className="rounded-[18px] border border-[#e8ecf1] bg-white p-5 md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800 space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Alertas</h2>
            {alertas.length === 0 && <p className="text-sm text-slate-500">Nenhum alerta em aberto.</p>}
            <ul className="space-y-2">
              {alertas.map((a) => (
                <li key={a.id} className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                  {a.campoNome && <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{a.campoNome}</p>}
                  <p>{a.mensagem}</p>
                  <p className="text-xs text-slate-500">{new Date(a.criadoEm).toLocaleString('pt-BR')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.proposta != null && (
                      <Permissao chave="meta_app.config.editar" rotulo="Alterar a configuração do app da Meta" herda="meta_app.view">
                        <button
                          onClick={() => void tratarAlerta(a.id, 'aprovar')}
                          disabled={alertaOcupado === a.id}
                          className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                        >
                          Aprovar
                        </button>
                      </Permissao>
                    )}
                    <Permissao chave="meta_app.config.editar" rotulo="Alterar a configuração do app da Meta" herda="meta_app.view">
                      <button
                        onClick={() => void tratarAlerta(a.id, 'resolver')}
                        disabled={alertaOcupado === a.id}
                        className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        Marcar como resolvido
                      </button>
                    </Permissao>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
