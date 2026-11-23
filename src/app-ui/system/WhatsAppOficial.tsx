/**
 * Sistema → WhatsApp Oficial (Meta Cloud API).
 * Conecta o número da igreja pelo Embedded Signup e mostra status, qualidade e limite.
 * Contrato HTTP: /api/meta/whatsapp/{config,conexao}.
 */
import { useEffect, useState } from 'react';
import { BadgeCheck, Loader2, AlertTriangle, CheckCircle2, Unplug, Info } from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
import { cabecalhos, lerErro } from '../../lib/meta/clienteHttp';
import { Permissao } from '../../lib/permissoes/Permissao';
import { abrirEmbeddedSignup, carregarSdkMeta } from '../../lib/meta/embeddedSignup';

export type Qualidade = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

type Conexao =
  | { conectado: false }
  | {
      conectado: true;
      status: string;
      numero: string | null;
      nomeExibicao: string | null;
      qualidade: Qualidade;
      limiteDiario: string | null;
      ultimoErro: string | null;
    };

export const LIMITES: Record<string, string> = {
  TIER_250: '250 pessoas/dia',
  TIER_2K: '2.000/dia',
  TIER_10K: '10.000/dia',
  TIER_100K: '100.000/dia',
  TIER_UNLIMITED: 'Ilimitado',
};

export const QUALIDADES: Record<Qualidade, { texto: string; classe: string }> = {
  GREEN: { texto: 'Alta', classe: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' },
  YELLOW: { texto: 'Média', classe: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900' },
  RED: { texto: 'Baixa', classe: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900' },
  UNKNOWN: { texto: 'Ainda sem avaliação', classe: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600' },
};

const ROTULOS_STATUS: Record<string, string> = { conectado: 'Conectado', erro: 'Erro', desconectado: 'Desconectado' };

const BASE = `${apiBase}/meta/whatsapp`;

/** `embutido`: só esconde o cabeçalho de página (usado dentro da central Meta Oficial). */
export default function WhatsAppOficial({ embutido = false }: { embutido?: boolean } = {}) {
  const [conexao, setConexao] = useState<Conexao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [liberada, setLiberada] = useState(false);
  const [modoTeste, setModoTeste] = useState(false);
  const [cfg, setCfg] = useState<{ appId: string; configId: string; graphVersion: string } | null>(null);
  const [sdkPronto, setSdkPronto] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`${BASE}/config`, { headers: cabecalhos() })
      .then(async (r) => {
        if (!r.ok) throw new Error(await lerErro(r));
        return (await r.json()) as { conexaoLiberada?: boolean; podeConectar?: boolean; appId?: string; configId?: string; graphVersion?: string };
      })
      .then(async (c) => {
        const pode = c.podeConectar ?? c.conexaoLiberada;
        if (!vivo || pode !== true || !c.appId || !c.configId || !c.graphVersion) return;
        setCfg({ appId: c.appId, configId: c.configId, graphVersion: c.graphVersion });
        setLiberada(true);
        setModoTeste(c.conexaoLiberada !== true);
        // SDK carregado ao abrir a tela: o clique precisa chamar FB.login direto (sem await antes).
        await carregarSdkMeta(c.appId, c.graphVersion);
        if (vivo) setSdkPronto(true);
      })
      .catch((e) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Falha ao carregar a configuração.');
      });
    fetch(`${BASE}/conexao`, { headers: cabecalhos() })
      .then(async (r) => {
        if (!r.ok) throw new Error(await lerErro(r));
        return (await r.json()) as Conexao;
      })
      .then((c) => {
        if (vivo) setConexao(c);
      })
      .catch((e) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Falha ao carregar a conexão.');
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const conectar = async () => {
    if (!cfg || !sdkPronto) return;
    setOcupado(true);
    setErro(null);
    try {
      const res = await abrirEmbeddedSignup(cfg.configId);
      const r = await fetch(`${BASE}/conexao`, {
        method: 'POST',
        headers: cabecalhos(true),
        body: JSON.stringify(res),
      });
      if (!r.ok) throw new Error(await lerErro(r));
      setConexao((await r.json()) as Conexao);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível conectar.');
    } finally {
      setOcupado(false);
    }
  };

  const desconectar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch(`${BASE}/conexao`, { method: 'DELETE', headers: cabecalhos() });
      if (!r.ok) throw new Error(await lerErro(r));
      setConexao((await r.json()) as Conexao);
      setConfirmando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível desconectar.');
    } finally {
      setOcupado(false);
    }
  };

  const botaoConectar = (rotulo: string) =>
    !liberada ? (
      <span className="inline-flex h-[26px] items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 text-xs font-bold text-slate-600 dark:text-slate-200">
        Em breve
      </span>
    ) : (
    <Permissao chave="whatsapp_oficial.conexao.conectar" rotulo="Conectar com a Meta" herda="whatsapp_oficial.edit">
      <button
        onClick={() => void conectar()}
        disabled={ocupado || !sdkPronto}
        className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-slate-900 px-3.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        {ocupado || !sdkPronto ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
        {sdkPronto ? rotulo : 'Carregando…'}
      </button>
    </Permissao>
  );

  return (
    <div className={`space-y-3 ${embutido ? '' : 'px-3 py-3 md:px-7 md:py-4'}`}>
      {!embutido && (
        <header>
          <h1 className="text-[17px] font-bold text-slate-900 dark:text-slate-100">WhatsApp Oficial</h1>
          <p className="text-sm text-slate-500">Número oficial da igreja pela API da Meta (WhatsApp Cloud API).</p>
        </header>
      )}

      {erro && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {modoTeste && (
        <div className="flex items-start gap-2 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
          <Info className="size-4 mt-0.5 shrink-0" />
          <span>Modo de teste do master: as igrejas ainda veem &quot;Em breve&quot;.</span>
        </div>
      )}

      {carregando && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}

      {!carregando && conexao && !conexao.conectado && (
        <section className="rounded-[18px] border border-[#e8ecf1] bg-white p-5 md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Conecte o número oficial de WhatsApp da igreja. A conexão é feita numa janela da própria Meta, sem
            você precisar copiar chaves.
          </p>
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Antes de começar</p>
            <ol className="list-decimal pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>A empresa precisa estar verificada no Gerenciador de Negócios da Meta.</li>
              <li>A conta do WhatsApp na Meta precisa ter uma forma de pagamento cadastrada.</li>
              <li>Clique em “Conectar com a Meta”, entre na sua conta e escolha o número.</li>
            </ol>
          </div>
          {botaoConectar('Conectar com a Meta')}
        </section>
      )}

      {!carregando && conexao && conexao.conectado && (
        <section className="rounded-[18px] border border-[#e8ecf1] bg-white p-5 md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800 space-y-4">
          {conexao.status === 'erro' && (
            <div role="alert" className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                <span>{conexao.ultimoErro || 'A conexão com a Meta apresentou erro.'}</span>
              </div>
              {botaoConectar('Reconectar')}
            </div>
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Número</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-100">{conexao.numero || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Nome de exibição</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-100">{conexao.nomeExibicao || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5">
                {conexao.status !== 'erro' && <CheckCircle2 className="size-4 text-emerald-600" />}
                {ROTULOS_STATUS[conexao.status] ?? conexao.status}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Qualidade</dt>
              <dd>
                <span className={`inline-flex h-[26px] items-center rounded-full border px-2.5 text-xs font-bold ${QUALIDADES[conexao.qualidade]?.classe ?? QUALIDADES.UNKNOWN.classe}`}>
                  {(QUALIDADES[conexao.qualidade] ?? QUALIDADES.UNKNOWN).texto}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Limite diário</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-100">
                {(conexao.limiteDiario && LIMITES[conexao.limiteDiario]) || '—'}
              </dd>
            </div>
          </dl>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
            {confirmando ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-700 dark:text-slate-200">Desconectar este número da igreja?</span>
                <button
                  onClick={() => void desconectar()}
                  disabled={ocupado}
                  className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
                >
                  {ocupado && <Loader2 className="size-3.5 animate-spin" />} Confirmar
                </button>
                <button
                  onClick={() => setConfirmando(false)}
                  disabled={ocupado}
                  className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <Permissao chave="whatsapp_oficial.conexao.desconectar" rotulo="Desconectar número" herda="whatsapp_oficial.delete">
                <button
                  onClick={() => setConfirmando(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-red-200 bg-white px-3.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 dark:border-red-900 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <Unplug className="size-4" /> Desconectar
                </button>
              </Permissao>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
