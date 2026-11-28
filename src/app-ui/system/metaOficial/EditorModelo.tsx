/**
 * Editor de modelo de mensagem (painel lateral; ocupa a tela no celular).
 * Valida ao vivo com a mesma validarRascunho do servidor e mostra a prévia no balão do WhatsApp.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Church, Info, Loader2, Plus, Send, Sparkles, Type, User, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiBase } from '../../../lib/apiBase';
import { cabecalhos, lerErro } from '../../../lib/meta/clienteHttp';
import { nomeDoTitulo, validarRascunho, type RascunhoModelo, type VariavelModelo } from '../../../lib/meta/modelos';
import { Permissao } from '../../../lib/permissoes/Permissao';
import PreviaWhatsApp from './PreviaWhatsApp';

type Tipo = VariavelModelo['tipo'];
type Var = { tipo: Tipo; exemplo: string };

const TIPOS: { tipo: Tipo; rotulo: string; icone: LucideIcon; padrao: string }[] = [
  { tipo: 'nome', rotulo: 'Nome da pessoa', icone: User, padrao: 'Maria' },
  { tipo: 'igreja', rotulo: 'Nome da igreja', icone: Church, padrao: 'Igreja Central' },
  { tipo: 'data', rotulo: 'Data', icone: CalendarDays, padrao: '15/12/2026' },
  { tipo: 'livre', rotulo: 'Texto livre', icone: Type, padrao: '' },
];
const padraoDe = (t: Tipo) => TIPOS.find((x) => x.tipo === t)?.padrao ?? '';

const entrada =
  'w-full rounded-xl border-[1.5px] border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:shadow-[0_0_0_4px_rgba(15,23,42,.08)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-300';
const rotuloCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1';
const dica = 'text-xs text-slate-500 dark:text-slate-400';

function numeros(t: string): number[] {
  return [...new Set([...t.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

function Contador({ n, max }: { n: number; max: number }) {
  return <span className={`text-xs ${n > max ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-400'}`}>{n}/{max}</span>;
}

export default function EditorModelo({
  inicial,
  onFechar,
  onCriado,
}: {
  inicial: RascunhoModelo | null;
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [nomeManual, setNomeManual] = useState(inicial !== null);
  const [categoria, setCategoria] = useState<RascunhoModelo['categoria']>(inicial?.categoria ?? 'UTILITY');
  const [cabecalho, setCabecalho] = useState(inicial?.cabecalho ?? '');
  const [tipoCab, setTipoCab] = useState<Tipo>(inicial?.tipoCabecalho ?? 'nome');
  const [exCab, setExCab] = useState(inicial?.exemploCabecalho ?? '');
  const [corpo, setCorpo] = useState(inicial?.corpo ?? '');
  const [rodape, setRodape] = useState(inicial?.rodape ?? '');
  const [botoes, setBotoes] = useState<string[]>((inicial?.botoes ?? []).map((b) => b.texto));
  const [vars, setVars] = useState<Record<number, Var>>(() => {
    const m: Record<number, Var> = {};
    for (const v of inicial?.variaveis ?? []) if (v.posicao > 0) m[v.posicao] = { tipo: v.tipo, exemplo: v.exemplo };
    return m;
  });
  const [mexeu, setMexeu] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const areaCorpo = useRef<HTMLTextAreaElement>(null);
  const [pedidoIa, setPedidoIa] = useState('');
  const [sugerindo, setSugerindo] = useState(false);
  const [erroIa, setErroIa] = useState('');
  const [avisoIa, setAvisoIa] = useState('');

  useEffect(() => {
    const t = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) onFechar();
    };
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  }, [enviando, onFechar]);

  const nums = useMemo(() => numeros(corpo), [corpo]);
  const cabTemVar = numeros(cabecalho).length > 0;

  const rascunho: RascunhoModelo = useMemo(
    () => ({
      nome,
      categoria,
      cabecalho: cabecalho.trim() !== '' ? cabecalho : undefined,
      tipoCabecalho: cabTemVar ? tipoCab : undefined,
      exemploCabecalho: cabTemVar ? exCab : undefined,
      corpo,
      rodape: rodape.trim() !== '' ? rodape : undefined,
      botoes: botoes.map((texto) => ({ texto })),
      variaveis: nums.map((n) => ({ posicao: n, tipo: vars[n]?.tipo ?? 'livre', exemplo: vars[n]?.exemplo ?? '' })),
    }),
    [nome, categoria, cabecalho, cabTemVar, tipoCab, exCab, corpo, rodape, botoes, nums, vars],
  );
  const erros = useMemo(() => validarRascunho(rascunho), [rascunho]);

  const alt = <T,>(set: (v: T) => void) => (v: T) => {
    setMexeu(true);
    set(v);
  };

  const mudarTitulo = (v: string) => {
    setMexeu(true);
    setTitulo(v);
    if (!nomeManual) setNome(nomeDoTitulo(v));
  };

  const inserirVariavel = (tipo: Tipo) => {
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    const el = areaCorpo.current;
    const ini = el?.selectionStart ?? corpo.length;
    const fim = el?.selectionEnd ?? corpo.length;
    const marcador = `{{${n}}}`;
    setMexeu(true);
    setCorpo(corpo.slice(0, ini) + marcador + corpo.slice(fim));
    setVars((v) => ({ ...v, [n]: { tipo, exemplo: padraoDe(tipo) } }));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(ini + marcador.length, ini + marcador.length);
    });
  };

  const inserirNoCabecalho = () => {
    if (cabTemVar) return;
    setMexeu(true);
    setCabecalho((c) => `${c}${c && !c.endsWith(' ') ? ' ' : ''}{{1}}`);
    setExCab((e) => e || padraoDe(tipoCab));
  };

  const sugerir = async () => {
    const descricao = pedidoIa.trim();
    if (!descricao || sugerindo) return;
    setSugerindo(true);
    setErroIa('');
    setAvisoIa('');
    try {
      const r = await fetch(`${apiBase}/meta/whatsapp/modelos/sugerir`, {
        method: 'POST',
        headers: cabecalhos(true),
        body: JSON.stringify({ descricao, categoria }),
      });
      if (!r.ok) {
        setErroIa(await lerErro(r));
        return;
      }
      const j = (await r.json()) as { rascunho?: RascunhoModelo };
      const s = j.rascunho;
      if (!s) {
        setErroIa('A IA não devolveu um modelo. Tente de novo.');
        return;
      }
      setMexeu(false);
      setNome(s.nome);
      setNomeManual(true);
      setCategoria(s.categoria);
      setCabecalho(s.cabecalho ?? '');
      setTipoCab(s.tipoCabecalho ?? 'nome');
      setExCab(s.exemploCabecalho ?? '');
      setCorpo(s.corpo);
      setRodape(s.rodape ?? '');
      setBotoes((s.botoes ?? []).map((b) => b.texto));
      const m: Record<number, Var> = {};
      for (const v of s.variaveis) if (v.posicao > 0) m[v.posicao] = { tipo: v.tipo, exemplo: v.exemplo };
      setVars(m);
      setAvisoIa('Sugestão preenchida. Revise o texto antes de enviar para aprovação.');
    } catch {
      setErroIa('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      setSugerindo(false);
    }
  };

  const criar = async () => {
    setMexeu(true);
    if (erros.length > 0) return;
    setEnviando(true);
    setErroEnvio('');
    try {
      const r = await fetch(`${apiBase}/meta/whatsapp/modelos`, {
        method: 'POST',
        headers: cabecalhos(true),
        body: JSON.stringify(rascunho),
      });
      if (!r.ok) {
        setErroEnvio(await lerErro(r));
        return;
      }
      onCriado();
    } catch {
      setErroEnvio('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && !enviando && onFechar()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={inicial ? 'Duplicar modelo' : 'Novo modelo'}
        className="flex h-full w-full flex-col bg-[#f4f6f8] dark:bg-slate-900 shadow-xl lg:max-w-5xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#e8ecf1] bg-white px-4 py-3 md:px-7 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-[17px] font-bold text-slate-900 dark:text-slate-100">{inicial ? 'Duplicar modelo' : 'Novo modelo de mensagem'}</h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            aria-label="Fechar"
            className="grid h-9 w-9 place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 md:px-7 md:py-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4 min-w-0">
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                <label htmlFor="mod-ia" className={rotuloCls}>O que a mensagem deve dizer?</label>
                <textarea
                  id="mod-ia"
                  rows={3}
                  maxLength={500}
                  className={entrada}
                  value={pedidoIa}
                  onChange={(e) => setPedidoIa(e.target.value)}
                  placeholder="Ex.: convidar a pessoa para o culto de domingo às 18h"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className={dica}>A IA escreve já seguindo as regras da Meta. Você revisa antes de enviar.</p>
                  <Permissao chave="whatsapp_oficial.modelos.sugerir" rotulo="Sugerir modelo com IA" herda="whatsapp_oficial.modelos.criar">
                  <button
                    type="button"
                    onClick={() => void sugerir()}
                    disabled={sugerindo || enviando || pedidoIa.trim() === ''}
                    className="inline-flex h-9 flex-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {sugerindo ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {sugerindo ? 'Gerando…' : 'Sugerir com IA'}
                  </button>
                  </Permissao>
                </div>
                {erroIa && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{erroIa}</p>}
                {avisoIa && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">{avisoIa}</p>}
                </div>
              {!inicial && (
                <div>
                  <label htmlFor="mod-titulo" className={rotuloCls}>Título</label>
                  <input id="mod-titulo" className={entrada} value={titulo} onChange={(e) => mudarTitulo(e.target.value)} placeholder="Ex.: Convite para o culto de domingo" />
                </div>
              )}
              <div>
                <label htmlFor="mod-nome" className={rotuloCls}>Nome do modelo</label>
                <input
                  id="mod-nome"
                  className={`${entrada} font-mono`}
                  value={nome}
                  onChange={(e) => {
                    setNomeManual(true);
                    alt(setNome)(e.target.value);
                  }}
                  placeholder="convite_culto_domingo"
                />
                <p className={dica}>Só letras minúsculas, números e sublinhado. Gerado do título; pode editar.</p>
              </div>

              <div>
                <label htmlFor="mod-categoria" className={rotuloCls}>Categoria</label>
                <select id="mod-categoria" className={entrada} value={categoria} onChange={(e) => alt(setCategoria)(e.target.value as RascunhoModelo['categoria'])}>
                  <option value="UTILITY">Utilidade</option>
                  <option value="MARKETING">Marketing</option>
                </select>
                <p className={dica}>
                  {categoria === 'UTILITY'
                    ? 'Utilidade: avisos e confirmações ligados a algo que a pessoa já fez ou pediu.'
                    : 'Marketing: convites, campanhas e divulgação de eventos.'}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="mod-cab" className={rotuloCls}>Cabeçalho (opcional)</label>
                  <Contador n={cabecalho.length} max={60} />
                </div>
                <input id="mod-cab" className={entrada} value={cabecalho} onChange={(e) => alt(setCabecalho)(e.target.value)} placeholder="Ex.: Culto de domingo" />
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={inserirNoCabecalho}
                    disabled={cabTemVar}
                    className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Plus className="size-3.5" /> Variável no cabeçalho
                  </button>
                </div>
                {cabTemVar && (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select aria-label="Tipo da variável do cabeçalho" className={entrada} value={tipoCab} onChange={(e) => alt(setTipoCab)(e.target.value as Tipo)}>
                      {TIPOS.map((t) => <option key={t.tipo} value={t.tipo}>{t.rotulo}</option>)}
                    </select>
                    <input aria-label="Exemplo da variável do cabeçalho" className={entrada} value={exCab} onChange={(e) => alt(setExCab)(e.target.value)} placeholder="Exemplo" />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="mod-corpo" className={rotuloCls}>Corpo da mensagem</label>
                  <Contador n={corpo.length} max={1024} />
                </div>
                <textarea
                  id="mod-corpo"
                  ref={areaCorpo}
                  rows={6}
                  className={entrada}
                  value={corpo}
                  onChange={(e) => alt(setCorpo)(e.target.value)}
                  placeholder="Escreva o texto. Use os botões abaixo para inserir variáveis."
                />
                <div className="mt-1 flex flex-wrap gap-2">
                  {TIPOS.map((t) => {
                    const Icone = t.icone;
                    return (
                      <button
                        key={t.tipo}
                        type="button"
                        onClick={() => inserirVariavel(t.tipo)}
                        className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Icone className="size-3.5" /> {t.rotulo}
                      </button>
                    );
                  })}
                </div>
                {nums.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className={dica}>Exemplo de cada variável (a Meta exige para aprovar):</p>
                    {nums.map((n) => (
                      <div key={n} className="grid grid-cols-[3rem_1fr] items-center gap-2 sm:grid-cols-[3rem_9rem_1fr]">
                        <span className="font-mono text-xs text-slate-500">{`{{${n}}}`}</span>
                        <select
                          aria-label={`Tipo da variável ${n}`}
                          className={`${entrada} col-start-2 sm:col-start-auto`}
                          value={vars[n]?.tipo ?? 'livre'}
                          onChange={(e) => alt((t: Tipo) => setVars((v) => ({ ...v, [n]: { tipo: t, exemplo: v[n]?.exemplo ?? '' } })))(e.target.value as Tipo)}
                        >
                          {TIPOS.map((t) => <option key={t.tipo} value={t.tipo}>{t.rotulo}</option>)}
                        </select>
                        <input
                          aria-label={`Exemplo da variável ${n}`}
                          className={`${entrada} col-span-2 sm:col-span-1`}
                          value={vars[n]?.exemplo ?? ''}
                          onChange={(e) => alt((x: string) => setVars((v) => ({ ...v, [n]: { tipo: v[n]?.tipo ?? 'livre', exemplo: x } })))(e.target.value)}
                          placeholder="Exemplo"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="mod-rodape" className={rotuloCls}>Rodapé (opcional)</label>
                  <Contador n={rodape.length} max={60} />
                </div>
                <input id="mod-rodape" className={entrada} value={rodape} onChange={(e) => alt(setRodape)(e.target.value)} placeholder="Ex.: Responda SAIR para não receber" />
              </div>

              <div>
                <p className={rotuloCls}>Botões de resposta rápida (até 3)</p>
                <div className="space-y-2">
                  {botoes.map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        aria-label={`Texto do botão ${i + 1}`}
                        className={entrada}
                        value={b}
                        onChange={(e) => alt((x: string) => setBotoes((l) => l.map((y, j) => (j === i ? x : y))))(e.target.value)}
                        placeholder="Texto do botão"
                      />
                      <Contador n={b.length} max={25} />
                      <button
                        type="button"
                        aria-label={`Remover botão ${i + 1}`}
                        onClick={() => alt(setBotoes)(botoes.filter((_, j) => j !== i))}
                        className="grid h-9 w-9 flex-none place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {botoes.length < 3 && (
                  <Permissao chave="whatsapp_oficial.modelos.criar" rotulo="Criar modelo de mensagem" herda="whatsapp_oficial.modelos.view">
                  <button
                    type="button"
                    onClick={() => alt(setBotoes)([...botoes, ''])}
                    className="mt-2 inline-flex h-8 items-center gap-1 rounded-[10px] border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Plus className="size-3.5" /> Adicionar botão
                  </button>
                  </Permissao>
                )}
              </div>
            </div>

            <div className="min-w-0 space-y-3 lg:sticky lg:top-0 lg:self-start">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Prévia</h3>
              <PreviaWhatsApp
                cabecalho={rascunho.cabecalho}
                exemploCabecalho={rascunho.exemploCabecalho}
                corpo={corpo}
                rodape={rascunho.rodape}
                botoes={botoes}
                exemplo={(n) => vars[n]?.exemplo}
              />
              <p className={`${dica} flex items-start gap-1.5`}>
                <Info className="mt-0.5 size-3.5 shrink-0" /> A Meta analisa o modelo antes de liberar o envio. A resposta costuma sair em minutos.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-[#e8ecf1] bg-white px-4 py-3 md:px-7 dark:border-slate-700 dark:bg-slate-800">
          {mexeu && erros.length > 0 && (
            <ul role="alert" className="list-disc space-y-0.5 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 py-2 pl-7 pr-3 text-xs text-red-700 dark:text-red-300">
              {erros.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          {erroEnvio && (
            <p role="alert" className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">{erroEnvio}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onFechar}
              disabled={enviando}
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <Permissao chave="whatsapp_oficial.modelos.criar" rotulo="Criar modelo de mensagem" herda="whatsapp_oficial.modelos.view">
              <button
                type="button"
                onClick={() => void criar()}
                disabled={enviando || (mexeu && erros.length > 0)}
                className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-slate-900 px-3.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {enviando ? 'Enviando…' : 'Enviar para aprovação'}
              </button>
            </Permissao>
          </div>
        </div>
      </div>
    </div>
  );
}
