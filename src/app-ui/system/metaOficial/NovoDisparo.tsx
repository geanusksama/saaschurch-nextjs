/**
 * Novo disparo em 3 passos (painel lateral; ocupa a tela no celular):
 * 1 Público (contagem ao vivo, um teto), 2 Modelo (aprovados, valores e prévia), 3 Revisão (quantidade,
 * limite, custo, Disparar agora / Agendar). A validação ao vivo usa a mesma função do servidor.
 * Nada é enviado antes do clique final; o número real vem na resposta da criação.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, Check, FileText, Info, Loader2, Send, Smartphone, Users, X } from 'lucide-react';
import { apiBase } from '../../../lib/apiBase';
import { cabecalhos, lerErro } from '../../../lib/meta/clienteHttp';
import type { VariavelModelo } from '../../../lib/meta/modelos';
import { validarEntradaDisparo, type FiltrosPublico } from '../../../lib/meta/servicoEnvio';
import { Permissao } from '../../../lib/permissoes/Permissao';
import PreviaWhatsApp from './PreviaWhatsApp';
import {
  ROTULO_CATEGORIA, alerta, botaoPri, botaoSecM, cartaoCls, dica, entrada, rotuloCls, Carregando,
} from './envioComum';

type ModeloOpcao = { id: string; nome: string; idioma: string; categoria: string; variaveis: unknown; componentes: unknown };
type Opcoes = {
  igrejas: { id: string; name: string }[];
  titulos: string[];
  origens: string[];
  modelos: ModeloOpcao[];
  conectado: boolean;
  limite: { limite: number | null; usados: number; restante: number | null; qualidade: string } | null;
};
type Resultado = { id: string; total: number; semCelular: number; excluidos: number; duplicados: number; status: string };
type Comp = { type?: string; text?: string; buttons?: { text?: string }[] };

const BASE = `${apiBase}/meta/whatsapp/envio`;
const SITUACOES: { v: string; r: string }[] = [
  { v: 'ATIVO', r: 'Ativo' },
  { v: 'INATIVO', r: 'Inativo' },
  { v: 'AGUARDANDO ATIVACAO', r: 'Aguardando ativação' },
  { v: 'DESLIGADO', r: 'Desligado' },
];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const PASSOS = ['Público', 'Modelo', 'Revisão'];

const lerVariaveis = (v: unknown): VariavelModelo[] => (Array.isArray(v) ? (v as VariavelModelo[]) : []);
const lerComps = (c: unknown): Comp[] => (Array.isArray(c) ? (c as Comp[]) : []);
const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

function Marcas({ titulo, itens, marcados, onAlt, vazio }: { titulo: string; itens: { v: string; r: string }[]; marcados: string[]; onAlt: (v: string) => void; vazio?: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className={rotuloCls}>{titulo} <span className="font-normal text-slate-500">(vazio = todos)</span></legend>
      {itens.length === 0 ? (
        <p className={dica}>{vazio ?? 'Nada cadastrado.'}</p>
      ) : (
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {itens.map((i) => {
            const on = marcados.includes(i.v);
            return (
              <label
                key={i.v}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  on
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <input type="checkbox" className="sr-only" checked={on} onChange={() => onAlt(i.v)} />
                {on && <Check className="size-3" />} {i.r}
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

export default function NovoDisparo({ onFechar, onCriado, irPara }: { onFechar: () => void; onCriado: () => void; irPara: (aba: string) => void }) {
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'sem-permissao' | 'ok'>('carregando');
  const [erroCarga, setErroCarga] = useState('');
  const [op, setOp] = useState<Opcoes | null>(null);
  const [passo, setPasso] = useState(0);

  const [usaMembros, setUsaMembros] = useState(true);
  const [usaInteressados, setUsaInteressados] = useState(false);
  const [mIgrejas, setMIgrejas] = useState<string[]>([]);
  const [mSituacoes, setMSituacoes] = useState<string[]>(['ATIVO']);
  const [mTitulos, setMTitulos] = useState<string[]>([]);
  const [mMes, setMMes] = useState('');
  const [iIgrejas, setIIgrejas] = useState<string[]>([]);
  const [iOrigens, setIOrigens] = useState<string[]>([]);
  const [iDe, setIDe] = useState('');
  const [iAte, setIAte] = useState('');

  const [contagem, setContagem] = useState<{ chave: string; estado: 'ok' | 'erro'; total: number; membros: number; interessados: number; msg: string }>({ chave: '', estado: 'ok', total: 0, membros: 0, interessados: 0, msg: '' });

  const [nome, setNome] = useState('');
  const [modeloId, setModeloId] = useState('');
  const [vData, setVData] = useState('');
  const [vLivre, setVLivre] = useState('');
  const [mexeu, setMexeu] = useState(false);
  const [quando, setQuando] = useState<'agora' | 'agendar'>('agora');
  const [agenda, setAgenda] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const travado = useRef(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) (resultado ? onCriado : onFechar)();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [enviando, onFechar, onCriado, resultado]);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch(`${BASE}/opcoes`, { headers: cabecalhos() });
        if (!vivo) return;
        if (r.status === 403) return setEstado('sem-permissao');
        if (!r.ok) {
          const m = await lerErro(r);
          if (!vivo) return;
          setErroCarga(m);
          return setEstado('erro');
        }
        const j = (await r.json()) as Opcoes;
        if (!vivo) return;
        setOp(j);
        setEstado('ok');
      } catch {
        if (!vivo) return;
        setErroCarga('Não foi possível falar com o servidor.');
        setEstado('erro');
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const filtros: FiltrosPublico = useMemo(
    () => ({
      membros: usaMembros ? { igrejaIds: mIgrejas, situacoes: mSituacoes, titulos: mTitulos, mesAniversario: mMes ? Number(mMes) : null } : null,
      interessados: usaInteressados ? { igrejaIds: iIgrejas, origens: iOrigens, cadastroDe: iDe || null, cadastroAte: iAte || null } : null,
    }),
    [usaMembros, usaInteressados, mIgrejas, mSituacoes, mTitulos, mMes, iIgrejas, iOrigens, iDe, iAte],
  );
  const chaveFiltros = JSON.stringify(filtros);

  // Contagem ao vivo (teto: ainda tira quem não tem celular válido ou saiu da lista).
  useEffect(() => {
    if (estado !== 'ok') return;
    if (!filtros.membros && !filtros.interessados) return;
    let vivo = true;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`${BASE}/publico`, { method: 'POST', headers: cabecalhos(true), body: JSON.stringify({ filtros }) });
          if (!vivo) return;
          if (!r.ok) {
            const m = await lerErro(r);
            if (!vivo) return;
            return setContagem({ chave: chaveFiltros, estado: 'erro', total: 0, membros: 0, interessados: 0, msg: m });
          }
          const j = (await r.json()) as { total: number; membros: number; interessados: number };
          if (!vivo) return;
          setContagem({ chave: chaveFiltros, estado: 'ok', total: j.total, membros: j.membros, interessados: j.interessados, msg: '' });
        } catch {
          if (!vivo) return;
          setContagem({ chave: chaveFiltros, estado: 'erro', total: 0, membros: 0, interessados: 0, msg: 'Não foi possível contar o público.' });
        }
      })();
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, chaveFiltros]);

  const contando = contagem.chave !== chaveFiltros;
  const modelo = op?.modelos.find((m) => m.id === modeloId) ?? null;
  const variaveis = useMemo(() => lerVariaveis(modelo?.variaveis), [modelo]);
  const usaData = variaveis.some((v) => v.tipo === 'data');
  const usaLivre = variaveis.some((v) => v.tipo === 'livre');

  const corpo = useMemo(
    () => ({
      nome,
      modeloId,
      filtros,
      valores: { ...(vData ? { data: vData } : {}), ...(vLivre ? { livre: vLivre } : {}) },
      agendadoPara: quando === 'agendar' && agenda ? new Date(agenda).toISOString() : null,
    }),
    [nome, modeloId, filtros, vData, vLivre, quando, agenda],
  );
  const validacao = useMemo(() => {
    if (quando === 'agendar' && !agenda) return { ok: false as const, erros: ['Escolha a data e a hora do agendamento.'] };
    if (quando === 'agendar' && Number.isNaN(new Date(agenda).getTime())) return { ok: false as const, erros: ['Data do agendamento inválida.'] };
    return validarEntradaDisparo(corpo, { variaveis, agora: new Date() });
  }, [corpo, variaveis, quando, agenda]);
  const erros = validacao.ok ? [] : validacao.erros;

  const publicoOk = (!!filtros.membros || !!filtros.interessados) && !contando && contagem.estado === 'ok' && contagem.total > 0;
  const errosModelo = erros.filter((e) => /nome|modelo|variável|valor/i.test(e));

  const igrejaExemplo = op?.igrejas.find((i) => (usaMembros ? mIgrejas : iIgrejas).includes(i.id))?.name ?? op?.igrejas[0]?.name ?? 'Igreja Central';
  const exemplo = (n: number): string | undefined => {
    const v = variaveis.find((x) => x.posicao === n);
    if (!v) return undefined;
    if (v.tipo === 'nome') return 'Maria';
    if (v.tipo === 'igreja') return igrejaExemplo;
    if (v.tipo === 'data') return vData || '[data]';
    return vLivre || '[texto livre]';
  };
  const comps = lerComps(modelo?.componentes);
  const achar = (t: string) => comps.find((c) => c?.type === t);
  const varCab = variaveis.find((v) => v.posicao === 0);
  const exemploCab = varCab ? exemplo(0) : undefined;

  const disparar = async () => {
    if (travado.current || !validacao.ok) return;
    travado.current = true;
    setEnviando(true);
    setErroEnvio('');
    try {
      const r = await fetch(BASE, { method: 'POST', headers: cabecalhos(true), body: JSON.stringify(validacao.valor) });
      if (!r.ok) {
        setErroEnvio(await lerErro(r));
        travado.current = false;
        return;
      }
      setResultado((await r.json()) as Resultado);
    } catch {
      setErroEnvio('Não foi possível falar com o servidor. Confira a lista antes de tentar de novo.');
      travado.current = false;
    } finally {
      setEnviando(false);
    }
  };

  const lim = op?.limite ?? null;
  const restante = lim ? lim.restante : null;
  const semModelo = op && op.modelos.length === 0;

  const vazio = (icone: React.ReactNode, titulo: string, texto: string, rotulo: string, aba: string) => (
    <div className="flex flex-col items-center gap-1.5 rounded-[18px] border border-[#e8ecf1] bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-800">
      <span className="mb-2 grid size-12 place-items-center rounded-2xl bg-[#f1f5f9] text-slate-500 dark:bg-slate-700 dark:text-slate-300">{icone}</span>
      <p className="text-base font-bold">{titulo}</p>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{texto}</p>
      <button type="button" onClick={() => irPara(aba)} className={`mt-3 ${botaoPri}`}>{rotulo}</button>
    </div>
  );

  const avancar = () => {
    setMexeu(true);
    if (passo === 0 && !publicoOk) return;
    if (passo === 1 && errosModelo.length > 0) return;
    setPasso((p) => Math.min(2, p + 1));
  };

  const fechar = resultado ? onCriado : onFechar;
  const bloqueado = estado !== 'ok' || !op || !op.conectado || !!semModelo;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && !enviando && fechar()}>
      <div role="dialog" aria-modal="true" aria-label="Novo disparo" className="flex h-full w-full flex-col bg-[#f4f6f8] shadow-xl lg:max-w-5xl dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-[#e8ecf1] bg-white px-4 py-3 md:px-7 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-[17px] font-bold text-slate-900 dark:text-slate-100">Novo disparo</h2>
          <button type="button" onClick={fechar} disabled={enviando} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 md:px-7 md:py-4">
          {estado === 'carregando' && <Carregando />}
          {estado === 'sem-permissao' && <p className="text-sm text-slate-500">Você não tem permissão para ver as opções do envio.</p>}
          {estado === 'erro' && <p role="alert" className={alerta}>{erroCarga}</p>}
          {estado === 'ok' && op && !op.conectado && vazio(<Smartphone className="size-6" strokeWidth={1.8} />, 'Nenhum número conectado', 'Conecte o número do WhatsApp Oficial para fazer disparos.', 'Conectar o número', 'conexao')}
          {estado === 'ok' && op && op.conectado && semModelo && vazio(<FileText className="size-6" strokeWidth={1.8} />, 'Nenhum modelo aprovado', 'Só modelos aprovados pela Meta podem ser disparados. Crie um modelo ou atualize a lista na aba Modelos.', 'Ir para Modelos', 'modelos')}

          {!bloqueado && op && !resultado && (
            <div className="mx-auto max-w-3xl space-y-4">
              <ol className="flex gap-2" aria-label="Passos">
                {PASSOS.map((p, i) => (
                  <li
                    key={p}
                    aria-current={i === passo ? 'step' : undefined}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-2 py-2 text-xs font-bold md:text-sm ${
                      i === passo
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                        : i < passo
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {i < passo ? <Check className="size-4" /> : <span>{i + 1}</span>} {p}
                  </li>
                ))}
              </ol>

              {passo === 0 && (
                <div className="space-y-4">
                  <section className={`${cartaoCls} space-y-3`}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                      <input type="checkbox" checked={usaMembros} onChange={(e) => setUsaMembros(e.target.checked)} className="size-4 accent-slate-900 dark:accent-white" /> Membros
                    </label>
                    {usaMembros && (
                      <div className="space-y-3 border-l-2 border-slate-100 pl-3 dark:border-slate-700">
                        <Marcas titulo="Igreja" itens={op.igrejas.map((i) => ({ v: i.id, r: i.name }))} marcados={mIgrejas} onAlt={(v) => setMIgrejas((l) => alternar(l, v))} />
                        <Marcas titulo="Situação" itens={SITUACOES} marcados={mSituacoes} onAlt={(v) => setMSituacoes((l) => alternar(l, v))} />
                        <Marcas titulo="Título eclesiástico" itens={op.titulos.map((t) => ({ v: t, r: t }))} marcados={mTitulos} onAlt={(v) => setMTitulos((l) => alternar(l, v))} />
                        <div>
                          <label htmlFor="env-mes" className={rotuloCls}>Aniversariantes do mês</label>
                          <select id="env-mes" className={entrada} value={mMes} onChange={(e) => setMMes(e.target.value)}>
                            <option value="">Todos os meses</option>
                            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className={`${cartaoCls} space-y-3`}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                      <input type="checkbox" checked={usaInteressados} onChange={(e) => setUsaInteressados(e.target.checked)} className="size-4 accent-slate-900 dark:accent-white" /> Interessados
                    </label>
                    {usaInteressados && (
                      <div className="space-y-3 border-l-2 border-slate-100 pl-3 dark:border-slate-700">
                        <Marcas titulo="Igreja" itens={op.igrejas.map((i) => ({ v: i.id, r: i.name }))} marcados={iIgrejas} onAlt={(v) => setIIgrejas((l) => alternar(l, v))} />
                        <Marcas titulo="Origem" itens={op.origens.map((o) => ({ v: o, r: o }))} marcados={iOrigens} onAlt={(v) => setIOrigens((l) => alternar(l, v))} />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label htmlFor="env-de" className={rotuloCls}>Cadastrados a partir de</label>
                            <input id="env-de" type="date" className={entrada} value={iDe} onChange={(e) => setIDe(e.target.value)} />
                          </div>
                          <div>
                            <label htmlFor="env-ate" className={rotuloCls}>Cadastrados até</label>
                            <input id="env-ate" type="date" className={entrada} value={iAte} onChange={(e) => setIAte(e.target.value)} />
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  <div className="flex items-center gap-2 rounded-2xl border border-[#e8ecf1] bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800" aria-live="polite">
                    <Users className="size-5 shrink-0 text-slate-500" />
                    {!usaMembros && !usaInteressados && <span className="text-slate-500">Escolha membros e/ou interessados.</span>}
                    {(usaMembros || usaInteressados) && contando && <span className="flex items-center gap-2 text-slate-500"><Loader2 className="size-4 animate-spin" /> Contando…</span>}
                    {(usaMembros || usaInteressados) && !contando && contagem.estado === 'erro' && <span className="text-red-600 dark:text-red-400">{contagem.msg}</span>}
                    {(usaMembros || usaInteressados) && !contando && contagem.estado === 'ok' && (
                      <span>
                        <strong>Até {contagem.total.toLocaleString('pt-BR')} {contagem.total === 1 ? 'pessoa' : 'pessoas'}</strong>
                        <span className="text-slate-500 dark:text-slate-400"> ({contagem.membros.toLocaleString('pt-BR')} membros, {contagem.interessados.toLocaleString('pt-BR')} interessados). O número final sai depois de tirar quem não tem celular válido, quem pediu para sair e telefones repetidos.</span>
                      </span>
                    )}
                  </div>
                  {mexeu && !publicoOk && !contando && contagem.estado === 'ok' && <p role="alert" className={alerta}>Esse público está vazio. Ajuste os filtros.</p>}
                </div>
              )}

              {passo === 1 && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="min-w-0 space-y-4">
                    <div>
                      <label htmlFor="env-nome" className={rotuloCls}>Nome do disparo</label>
                      <input id="env-nome" className={entrada} value={nome} maxLength={120} onChange={(e) => { setMexeu(true); setNome(e.target.value); }} placeholder="Ex.: Convite do culto de domingo" />
                      <p className={dica}>Só para você achar depois; a pessoa não vê.</p>
                    </div>
                    <div>
                      <label htmlFor="env-modelo" className={rotuloCls}>Modelo aprovado</label>
                      <select id="env-modelo" className={entrada} value={modeloId} onChange={(e) => { setMexeu(true); setModeloId(e.target.value); }}>
                        <option value="">Escolha um modelo</option>
                        {op.modelos.map((m) => <option key={m.id} value={m.id}>{m.nome} ({ROTULO_CATEGORIA[m.categoria] ?? m.categoria})</option>)}
                      </select>
                    </div>
                    {modelo && (variaveis.some((v) => v.tipo === 'nome' || v.tipo === 'igreja')) && (
                      <p className={`${dica} flex items-start gap-1.5`}><Info className="mt-0.5 size-3.5 shrink-0" /> Nome e igreja são preenchidos sozinhos para cada pessoa.</p>
                    )}
                    {usaData && (
                      <div>
                        <label htmlFor="env-data" className={rotuloCls}>Valor da variável Data</label>
                        <input id="env-data" className={entrada} value={vData} maxLength={60} onChange={(e) => { setMexeu(true); setVData(e.target.value); }} placeholder="Ex.: domingo, 15/12 às 19h" />
                      </div>
                    )}
                    {usaLivre && (
                      <div>
                        <label htmlFor="env-livre" className={rotuloCls}>Valor do Texto livre</label>
                        <input id="env-livre" className={entrada} value={vLivre} maxLength={200} onChange={(e) => { setMexeu(true); setVLivre(e.target.value); }} />
                      </div>
                    )}
                    {mexeu && errosModelo.length > 0 && (
                      <ul role="alert" className={`${alerta} list-disc space-y-0.5 pl-6`}>{errosModelo.map((e) => <li key={e}>{e}</li>)}</ul>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={rotuloCls}>Como a pessoa vai ver (exemplo: Maria)</p>
                    {modelo ? (
                      <PreviaWhatsApp
                        cabecalho={achar('HEADER')?.text}
                        corpo={achar('BODY')?.text ?? ''}
                        rodape={achar('FOOTER')?.text}
                        botoes={(achar('BUTTONS')?.buttons ?? []).map((b) => b.text ?? '')}
                        exemplo={exemplo}
                        exemploCabecalho={exemploCab}
                      />
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600">Escolha um modelo para ver a prévia.</p>
                    )}
                  </div>
                </div>
              )}

              {passo === 2 && modelo && (
                <div className="space-y-4">
                  <section className={`${cartaoCls} space-y-3`}>
                    <h3 className="text-base font-bold">Revisão</h3>
                    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-slate-500">Disparo</dt><dd className="font-semibold">{nome}</dd></div>
                      <div><dt className="text-slate-500">Modelo</dt><dd className="break-all font-mono text-[13px] font-semibold">{modelo.nome}</dd></div>
                      <div><dt className="text-slate-500">Quantidade</dt><dd className="font-semibold">Até {contagem.total.toLocaleString('pt-BR')} pessoas</dd></div>
                      <div>
                        <dt className="text-slate-500">Limite diário restante</dt>
                        <dd className="font-semibold">
                          {lim === null ? 'Não disponível agora' : restante === null ? 'Sem limite diário' : `${restante.toLocaleString('pt-BR')} mensagens`}
                        </dd>
                      </div>
                    </dl>
                    {restante !== null && contagem.total > restante && (
                      <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" /> O público passa do limite de hoje. O envio para sozinho no limite e continua no dia seguinte.
                      </p>
                    )}
                  </section>

                  <section className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                    <p className="flex items-start gap-2">
                      <Info className="mt-0.5 size-4 shrink-0" />
                      <span>
                        {modelo.categoria === 'MARKETING' || modelo.categoria === 'UTILITY'
                          ? `Mensagens de ${ROTULO_CATEGORIA[modelo.categoria]} são cobradas pela Meta por mensagem entregue. O valor depende do país e da tabela da Meta e não aparece aqui; confira no Gerenciador do WhatsApp.`
                          : 'A cobrança é feita pela Meta por mensagem entregue, conforme a categoria do modelo. O valor não aparece aqui; confira no Gerenciador do WhatsApp.'}
                      </span>
                    </p>
                    <p className="flex items-start gap-2">
                      <Info className="mt-0.5 size-4 shrink-0" />
                      <span>Para o primeiro disparo, use um modelo de boas-vindas que diga como sair (por exemplo, &quot;responda SAIR para não receber mais&quot;). Quem responder SAIR entra na lista de exclusão e não recebe mais disparos.</span>
                    </p>
                  </section>

                  <section className={`${cartaoCls} space-y-3`}>
                    <fieldset>
                      <legend className={rotuloCls}>Quando enviar</legend>
                      <div className="flex flex-wrap gap-2">
                        {(['agora', 'agendar'] as const).map((q) => (
                          <label key={q} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold ${quando === q ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}>
                            <input type="radio" name="env-quando" className="sr-only" checked={quando === q} onChange={() => setQuando(q)} />
                            {q === 'agora' ? <Send className="size-4" /> : <CalendarClock className="size-4" />} {q === 'agora' ? 'Disparar agora' : 'Agendar'}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    {quando === 'agendar' && (
                      <div>
                        <label htmlFor="env-agenda" className={rotuloCls}>Data e hora</label>
                        <input id="env-agenda" type="datetime-local" className={entrada} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
                        <p className={dica}>No máximo 60 dias à frente. Horário do seu aparelho.</p>
                      </div>
                    )}
                  </section>

                  {erros.length > 0 && <ul role="alert" className={`${alerta} list-disc space-y-0.5 pl-6`}>{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
                  {erroEnvio && <p role="alert" className={alerta}>{erroEnvio}</p>}
                </div>
              )}
            </div>
          )}

          {resultado && (
            <div className="mx-auto flex max-w-xl flex-col items-center gap-2 rounded-[18px] border border-[#e8ecf1] bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-800">
              <span className="mb-2 grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"><Check className="size-6" /></span>
              <p className="text-base font-bold">{resultado.status === 'agendado' ? 'Disparo agendado' : 'Disparo iniciado'}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300"><strong>{resultado.total.toLocaleString('pt-BR')}</strong> {resultado.total === 1 ? 'pessoa vai receber' : 'pessoas vão receber'} a mensagem.</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ficaram de fora: {resultado.semCelular.toLocaleString('pt-BR')} sem celular válido, {resultado.excluidos.toLocaleString('pt-BR')} que pediram para sair e {resultado.duplicados.toLocaleString('pt-BR')} telefones repetidos.
              </p>
              <button type="button" onClick={onCriado} className={`mt-3 ${botaoPri}`}>Ver o disparo na lista</button>
            </div>
          )}
        </div>

        {!bloqueado && !resultado && (
          <div className="flex items-center justify-between gap-2 border-t border-[#e8ecf1] bg-white px-4 py-3 md:px-7 dark:border-slate-700 dark:bg-slate-800">
            <button type="button" className={botaoSecM} disabled={enviando} onClick={() => (passo === 0 ? onFechar() : setPasso(passo - 1))}>
              {passo === 0 ? 'Cancelar' : <><ArrowLeft className="size-4" /> Voltar</>}
            </button>
            {passo < 2 ? (
              <button type="button" className={botaoPri} onClick={avancar} disabled={passo === 0 ? !publicoOk : passo === 1 ? !modelo || errosModelo.length > 0 : false}>
                Continuar <ArrowRight className="size-4" />
              </button>
            ) : (
              <Permissao chave="whatsapp_oficial.envio.criar" rotulo="Criar disparo (WhatsApp Oficial)" herda="whatsapp_oficial.envio.view">
                <button type="button" className={botaoPri} disabled={enviando || !validacao.ok} onClick={() => void disparar()}>
                  {enviando ? <Loader2 className="size-4 animate-spin" /> : quando === 'agendar' ? <CalendarClock className="size-4" /> : <Send className="size-4" />}
                  {enviando ? 'Criando…' : quando === 'agendar' ? 'Agendar' : 'Disparar agora'}
                </button>
              </Permissao>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
