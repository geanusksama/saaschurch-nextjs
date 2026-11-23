/**
 * Meta Oficial → Modelos. Lista (tabela no computador, cartões no celular), busca, filtro por situação,
 * atualizar (sincroniza com a Meta), criar, duplicar e excluir com confirmação na própria linha.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, FileText, Loader2, Plus, RefreshCw, Search, Smartphone, Trash2 } from 'lucide-react';
import { apiBase } from '../../../lib/apiBase';
import { cabecalhos, lerErro } from '../../../lib/meta/clienteHttp';
import { ROTULO_STATUS, type RascunhoModelo, type VariavelModelo } from '../../../lib/meta/modelos';
import { Permissao } from '../../../lib/permissoes/Permissao';
import EditorModelo from './EditorModelo';

type Modelo = {
  id: string;
  nome: string;
  categoria: string;
  status: string;
  motivoRecusa: string | null;
  componentes: unknown;
  variaveis: unknown;
  atualizadoEm: string;
};

const BASE = `${apiBase}/meta/whatsapp/modelos`;
const ROTULO_CATEGORIA: Record<string, string> = { MARKETING: 'Marketing', UTILITY: 'Utilidade', AUTHENTICATION: 'Autenticação' };

const COR_STATUS: Record<string, string> = {
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  REJECTED: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
};
const COR_NEUTRA = 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200';

function Selo({ m }: { m: Modelo }) {
  const dicaRecusa = m.status === 'REJECTED' && m.motivoRecusa ? `Motivo: ${m.motivoRecusa}` : undefined;
  return (
    <span
      title={dicaRecusa}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${COR_STATUS[m.status] ?? COR_NEUTRA}`}
    >
      {ROTULO_STATUS[m.status] ?? m.status}
    </span>
  );
}

function dataCurta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

type Comp = { type?: string; text?: string; buttons?: { text?: string }[] };

/** Reconstrói o rascunho a partir dos componentes e de `variaveis` (posicao 0 = variável do cabeçalho). */
function rascunhoDe(m: Modelo): RascunhoModelo {
  const comps: Comp[] = Array.isArray(m.componentes) ? (m.componentes as Comp[]) : [];
  const achar = (t: string) => comps.find((c) => c?.type === t);
  const vars: VariavelModelo[] = Array.isArray(m.variaveis) ? (m.variaveis as VariavelModelo[]) : [];
  const cab = vars.find((v) => v.posicao === 0);
  const r: RascunhoModelo = {
    nome: `${m.nome}_copia`.slice(0, 512),
    categoria: m.categoria === 'MARKETING' ? 'MARKETING' : 'UTILITY',
    corpo: achar('BODY')?.text ?? '',
    variaveis: vars.filter((v) => v.posicao > 0),
    botoes: (achar('BUTTONS')?.buttons ?? []).map((b) => ({ texto: b.text ?? '' })),
  };
  const h = achar('HEADER')?.text;
  if (h) {
    r.cabecalho = h;
    if (cab) {
      r.tipoCabecalho = cab.tipo;
      r.exemploCabecalho = cab.exemplo;
    }
  }
  const f = achar('FOOTER')?.text;
  if (f) r.rodape = f;
  return r;
}

const botaoSec =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50';

export default function Modelos({ irPara }: { irPara: (aba: string) => void }) {
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'sem-permissao' | 'ok'>('carregando');
  const [erro, setErro] = useState('');
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [conectado, setConectado] = useState(true);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');
  const [atualizando, setAtualizando] = useState(false);
  const [editor, setEditor] = useState<{ inicial: RascunhoModelo | null } | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [aviso, setAviso] = useState('');

  const [recarga, setRecarga] = useState(0);
  const carregar = useCallback(() => setRecarga((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch(BASE, { headers: cabecalhos() });
        if (!vivo) return;
        if (r.status === 403) return setEstado('sem-permissao');
        if (!r.ok) {
          const msg = await lerErro(r);
          if (!vivo) return;
          setErro(msg);
          return setEstado('erro');
        }
        const j = (await r.json()) as { modelos?: Modelo[]; conectado?: boolean };
        if (!vivo) return;
        setModelos(j.modelos ?? []);
        setConectado(j.conectado !== false);
        setEstado('ok');
      } catch {
        if (!vivo) return;
        setErro('Não foi possível falar com o servidor.');
        setEstado('erro');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [recarga]);

  const repetir = () => {
    setEstado('carregando');
    carregar();
  };

  const atualizar = async () => {
    setAtualizando(true);
    setAviso('');
    try {
      const r = await fetch(`${BASE}/sincronizar`, { method: 'POST', headers: cabecalhos() });
      if (!r.ok) setAviso(await lerErro(r));
      else carregar();
    } catch {
      setAviso('Não foi possível falar com o servidor.');
    } finally {
      setAtualizando(false);
    }
  };

  const excluir = async (id: string) => {
    setExcluindo(true);
    setAviso('');
    try {
      const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: cabecalhos() });
      if (!r.ok) setAviso(await lerErro(r));
      else {
        setConfirmando(null);
        carregar();
      }
    } catch {
      setAviso('Não foi possível falar com o servidor.');
    } finally {
      setExcluindo(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return modelos.filter((m) => (!q || m.nome.toLowerCase().includes(q)) && (!situacao || m.status === situacao));
  }, [modelos, busca, situacao]);

  if (estado === 'carregando') {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (estado === 'sem-permissao') return <p className="text-sm text-slate-500">Você não tem permissão para ver os modelos.</p>;
  if (estado === 'erro') {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{erro}</p>
        <button type="button" className={botaoSec} onClick={repetir}>
          <RefreshCw className="size-3.5" /> Repetir
        </button>
      </div>
    );
  }
  if (!conectado) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center">
        <Smartphone className="size-8 text-slate-400" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nenhum número conectado</p>
        <p className="max-w-sm text-sm text-slate-500">Conecte o número do WhatsApp Oficial para criar e acompanhar os modelos de mensagem.</p>
        <button type="button" onClick={() => irPara('conexao')} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          <Smartphone className="size-4" /> Conectar o número
        </button>
      </div>
    );
  }

  const confirmacao = (m: Modelo) => (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
      <span className="font-semibold">Excluir &quot;{m.nome}&quot; também na Meta?</span>
      <button type="button" disabled={excluindo} onClick={() => setConfirmando(null)} className={botaoSec}>Cancelar</button>
      <Permissao chave="whatsapp_oficial.modelos.excluir" rotulo="Excluir modelo de mensagem" herda="whatsapp_oficial.modelos.view">
      <button
        type="button"
        disabled={excluindo}
        onClick={() => void excluir(m.id)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {excluindo ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Excluir
      </button>
      </Permissao>
    </div>
  );

  const acoes = (m: Modelo) => (
    <div className="flex flex-wrap justify-end gap-2">
      <Permissao chave="whatsapp_oficial.modelos.criar" rotulo="Criar modelo de mensagem" herda="whatsapp_oficial.modelos.view">
        <button type="button" className={botaoSec} onClick={() => setEditor({ inicial: rascunhoDe(m) })}>
          <Copy className="size-3.5" /> Duplicar
        </button>
      </Permissao>
      <Permissao chave="whatsapp_oficial.modelos.excluir" rotulo="Excluir modelo de mensagem" herda="whatsapp_oficial.modelos.view">
        <button type="button" className={`${botaoSec} !text-red-600 dark:!text-red-400`} onClick={() => setConfirmando(m.id)}>
          <Trash2 className="size-3.5" /> Excluir
        </button>
      </Permissao>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Buscar modelo por nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-slate-100"
          />
        </div>
        <select
          aria-label="Filtrar por situação"
          value={situacao}
          onChange={(e) => setSituacao(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
        >
          <option value="">Todas as situações</option>
          {Object.entries(ROTULO_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button type="button" className={`${botaoSec} justify-center py-2`} onClick={() => void atualizar()} disabled={atualizando}>
          <RefreshCw className={`size-4 ${atualizando ? 'animate-spin' : ''}`} /> {atualizando ? 'Atualizando…' : 'Atualizar'}
        </button>
        <Permissao chave="whatsapp_oficial.modelos.criar" rotulo="Criar modelo de mensagem" herda="whatsapp_oficial.modelos.view">
          <button
            type="button"
            onClick={() => setEditor({ inicial: null })}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> Novo modelo
          </button>
        </Permissao>
      </div>

      {aviso && <p role="alert" className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{aviso}</p>}

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center">
          <FileText className="size-8 text-slate-400" />
          <p className="text-sm text-slate-500">
            {modelos.length === 0 ? 'Nenhum modelo ainda. Crie o primeiro ou use Atualizar para trazer os da Meta.' : 'Nenhum modelo com esse filtro.'}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2">Atualizado em</th>
                  <th className="px-3 py-2"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100 dark:border-slate-700 align-top">
                    <td className="px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 break-all">{m.nome}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{ROTULO_CATEGORIA[m.categoria] ?? m.categoria}</td>
                    <td className="px-3 py-2">
                      <Selo m={m} />
                      {m.status === 'REJECTED' && m.motivoRecusa && <p className="mt-1 text-xs text-slate-500">{m.motivoRecusa}</p>}
                    </td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{dataCurta(m.atualizadoEm)}</td>
                    <td className="px-3 py-2">{confirmando === m.id ? confirmacao(m) : acoes(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {filtrados.map((m) => (
              <li key={m.id} className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                <p className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100 break-all">{m.nome}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Selo m={m} />
                  <span>{ROTULO_CATEGORIA[m.categoria] ?? m.categoria}</span>
                  <span>{dataCurta(m.atualizadoEm)}</span>
                </div>
                {m.status === 'REJECTED' && m.motivoRecusa && <p className="text-xs text-slate-500">Motivo: {m.motivoRecusa}</p>}
                {confirmando === m.id ? confirmacao(m) : acoes(m)}
              </li>
            ))}
          </ul>
        </>
      )}

      {editor && (
        <EditorModelo
          inicial={editor.inicial}
          onFechar={() => setEditor(null)}
          onCriado={() => {
            setEditor(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}
