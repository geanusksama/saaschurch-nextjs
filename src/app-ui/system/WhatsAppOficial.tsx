/**
 * Sistema → WhatsApp Oficial (Meta Cloud API).
 * Conecta o número da igreja pelo Embedded Signup e mostra status, qualidade e limite.
 * Contrato HTTP: /api/meta/whatsapp/{config,conexao}.
 */
import { useEffect, useState } from 'react';
import { BadgeCheck, Loader2, AlertTriangle, CheckCircle2, Unplug } from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
import { Permissao } from '../../lib/permissoes/Permissao';
import { abrirEmbeddedSignup, carregarSdkMeta } from '../../lib/meta/embeddedSignup';

type Qualidade = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

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

const LIMITES: Record<string, string> = {
  TIER_250: '250 pessoas/dia',
  TIER_2K: '2.000/dia',
  TIER_10K: '10.000/dia',
  TIER_100K: '100.000/dia',
  TIER_UNLIMITED: 'Ilimitado',
};

const QUALIDADES: Record<Qualidade, { texto: string; classe: string }> = {
  GREEN: { texto: 'Alta', classe: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  YELLOW: { texto: 'Média', classe: 'bg-amber-50 text-amber-700 border-amber-200' },
  RED: { texto: 'Baixa', classe: 'bg-red-50 text-red-700 border-red-200' },
  UNKNOWN: { texto: 'Ainda sem avaliação', classe: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const BASE = `${apiBase}/meta/whatsapp`;

function cabecalhos(json = false): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') : null;
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token ?? ''}`,
  };
}

async function lerErro(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { error?: string };
    if (j?.error) return j.error;
  } catch {
    /* corpo vazio */
  }
  if (r.status === 401) return 'Sessão expirada. Entre novamente.';
  if (r.status === 403) return 'Você não tem permissão para esta ação.';
  return `Erro ${r.status} ao falar com o servidor.`;
}

export default function WhatsAppOficial() {
  const [conexao, setConexao] = useState<Conexao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    let vivo = true;
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
    setOcupado(true);
    setErro(null);
    try {
      const rc = await fetch(`${BASE}/config`, { headers: cabecalhos() });
      if (!rc.ok) throw new Error(await lerErro(rc));
      const cfg = (await rc.json()) as { appId: string; configId: string; graphVersion: string };
      await carregarSdkMeta(cfg.appId, cfg.graphVersion);
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

  const botaoConectar = (rotulo: string) => (
    <Permissao chave="whatsapp_oficial.conexao.conectar" rotulo="Conectar com a Meta" herda="whatsapp_oficial.edit">
      <button
        onClick={() => void conectar()}
        disabled={ocupado}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {ocupado ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
        {rotulo}
      </button>
    </Permissao>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">WhatsApp Oficial</h1>
        <p className="text-sm text-slate-500">Número oficial da igreja pela API da Meta (WhatsApp Cloud API).</p>
      </header>

      {erro && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {carregando && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}

      {!carregando && conexao && !conexao.conectado && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4 shadow-sm">
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
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4 shadow-sm">
          {conexao.status === 'erro' && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 space-y-2">
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
                {conexao.status}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Qualidade</dt>
              <dd>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${QUALIDADES[conexao.qualidade]?.classe ?? QUALIDADES.UNKNOWN.classe}`}>
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {ocupado && <Loader2 className="size-3.5 animate-spin" />} Confirmar
                </button>
                <button
                  onClick={() => setConfirmando(false)}
                  disabled={ocupado}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <Permissao chave="whatsapp_oficial.conexao.desconectar" rotulo="Desconectar número" herda="whatsapp_oficial.delete">
                <button
                  onClick={() => setConfirmando(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
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
