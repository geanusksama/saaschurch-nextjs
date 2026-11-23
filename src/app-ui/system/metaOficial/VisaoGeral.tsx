/**
 * Meta Oficial → Visão geral. Resume conexão, modelos e liberação.
 * Lê /api/meta/whatsapp/{conexao,config,modelos}; a falha de uma chamada não derruba as outras.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ExternalLink, Loader2, Smartphone, FileText, ShieldCheck } from 'lucide-react';
import { apiBase } from '../../../lib/apiBase';
import { cabecalhos } from '../../../lib/meta/clienteHttp';
import { LIMITES, QUALIDADES, type Qualidade } from '../WhatsAppOficial';

type Conexao = { conectado: false } | { conectado: true; numero: string | null; qualidade: Qualidade; limiteDiario: string | null };
type Modelo = { status: string };
type Pedido<T> = { estado: 'carregando' } | { estado: 'erro' } | { estado: 'ok'; dados: T };

const BASE = `${apiBase}/meta/whatsapp`;
const LINK_MANAGER = 'https://business.facebook.com/wa/manage/home/';
const LINK_PAGAMENTOS = 'https://business.facebook.com/billing_hub/payment_settings';

async function buscar<T>(caminho: string): Promise<Pedido<T>> {
  try {
    const r = await fetch(`${BASE}/${caminho}`, { headers: cabecalhos() });
    if (!r.ok) return { estado: 'erro' };
    return { estado: 'ok', dados: (await r.json()) as T };
  } catch {
    return { estado: 'erro' };
  }
}

const cartao = 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3 shadow-sm';
const titulo = 'flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200';

function Indisponivel() {
  return <p className="text-sm text-slate-500">Não foi possível carregar agora.</p>;
}

function Carregando() {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" /> Carregando…
    </div>
  );
}

export default function VisaoGeral({ irPara }: { irPara: (aba: string) => void }) {
  const [conexao, setConexao] = useState<Pedido<Conexao>>({ estado: 'carregando' });
  const [config, setConfig] = useState<Pedido<{ conexaoLiberada?: boolean }>>({ estado: 'carregando' });
  const [modelos, setModelos] = useState<Pedido<{ modelos: Modelo[]; conectado: boolean }>>({ estado: 'carregando' });

  useEffect(() => {
    let vivo = true;
    void buscar<Conexao>('conexao').then((p) => vivo && setConexao(p));
    void buscar<{ conexaoLiberada?: boolean }>('config').then((p) => vivo && setConfig(p));
    void buscar<{ modelos: Modelo[]; conectado: boolean }>('modelos').then((p) => vivo && setModelos(p));
    return () => {
      vivo = false;
    };
  }, []);

  const conectado = conexao.estado === 'ok' && conexao.dados.conectado;
  const liberada = config.estado === 'ok' && config.dados.conexaoLiberada === true;
  const lista = modelos.estado === 'ok' ? modelos.dados.modelos ?? [] : [];
  const contar = (s: string) => lista.filter((m) => m.status === s).length;
  const aprovados = contar('APPROVED');

  const passos: { feito: boolean; texto: string; aba?: string }[] = [
    { feito: liberada, texto: 'Conexão liberada para a igreja' },
    { feito: conectado, texto: 'Conectar o número oficial com a Meta', aba: 'conexao' },
    { feito: lista.length > 0, texto: 'Criar o primeiro modelo de mensagem', aba: 'modelos' },
    { feito: aprovados > 0, texto: 'Ter ao menos um modelo aprovado pela Meta', aba: 'modelos' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <section className={cartao}>
          <h2 className={titulo}><Smartphone className="size-4" /> Conexão</h2>
          {conexao.estado === 'carregando' && <Carregando />}
          {conexao.estado === 'erro' && <Indisponivel />}
          {conexao.estado === 'ok' && !conexao.dados.conectado && (
            <p className="text-sm text-slate-500">Nenhum número conectado.</p>
          )}
          {conexao.estado === 'ok' && conexao.dados.conectado && (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Número</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">{conexao.dados.numero || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Qualidade</dt>
                <dd>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${(QUALIDADES[conexao.dados.qualidade] ?? QUALIDADES.UNKNOWN).classe}`}>
                    {(QUALIDADES[conexao.dados.qualidade] ?? QUALIDADES.UNKNOWN).texto}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Limite diário</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">
                  {(conexao.dados.limiteDiario && LIMITES[conexao.dados.limiteDiario]) || '—'}
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section className={cartao}>
          <h2 className={titulo}><FileText className="size-4" /> Modelos</h2>
          {modelos.estado === 'carregando' && <Carregando />}
          {modelos.estado === 'erro' && <Indisponivel />}
          {modelos.estado === 'ok' && !modelos.dados.conectado && (
            <p className="text-sm text-slate-500">Conecte um número para ver os modelos.</p>
          )}
          {modelos.estado === 'ok' && modelos.dados.conectado && (
            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <dd className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{aprovados}</dd>
                <dt className="text-xs text-slate-500">Aprovados</dt>
              </div>
              <div>
                <dd className="text-xl font-bold text-amber-700 dark:text-amber-300">{contar('PENDING')}</dd>
                <dt className="text-xs text-slate-500">Em análise</dt>
              </div>
              <div>
                <dd className="text-xl font-bold text-red-700 dark:text-red-300">{contar('REJECTED')}</dd>
                <dt className="text-xs text-slate-500">Recusados</dt>
              </div>
            </dl>
          )}
        </section>

        <section className={cartao}>
          <h2 className={titulo}><ShieldCheck className="size-4" /> Liberação</h2>
          {config.estado === 'carregando' && <Carregando />}
          {config.estado === 'erro' && <Indisponivel />}
          {config.estado === 'ok' && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {liberada
                ? 'A conexão com a Meta está liberada para esta igreja.'
                : 'A conexão ainda não foi liberada. Assim que for, o botão de conectar aparece.'}
            </p>
          )}
        </section>
      </div>

      <section className={cartao}>
        <h2 className={titulo}>Próximos passos</h2>
        <ul className="space-y-2">
          {passos.map((p) => (
            <li key={p.texto} className="flex items-center gap-2 text-sm">
              {p.feito ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="size-4 shrink-0 text-slate-400" />
              )}
              <span className={p.feito ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}>{p.texto}</span>
              {!p.feito && p.aba && (
                <button onClick={() => irPara(p.aba as string)} className="ml-auto text-xs font-semibold underline text-slate-600 dark:text-slate-300">
                  Abrir
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={cartao}>
        <h2 className={titulo}>Atalhos na Meta</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <a className="inline-flex items-center gap-1.5 underline text-slate-700 dark:text-slate-200" href={LINK_MANAGER} target="_blank" rel="noreferrer">
            WhatsApp Manager <ExternalLink className="size-3.5" />
          </a>
          <a className="inline-flex items-center gap-1.5 underline text-slate-700 dark:text-slate-200" href={LINK_PAGAMENTOS} target="_blank" rel="noreferrer">
            Pagamentos da Meta <ExternalLink className="size-3.5" />
          </a>
        </div>
      </section>
    </div>
  );
}
