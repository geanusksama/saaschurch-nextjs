/**
 * Escolha do que sai no papel, antes de mandar imprimir.
 *
 * Imprime exatamente os cultos que o filtro da tela deixou na lista — o que
 * está na tela é o que sai, sem uma segunda consulta que poderia divergir.
 *
 * A prévia mostra a folha como ela vai sair: os cabeçalhos são as colunas na
 * ordem do papel, e quem imprime arrasta (ou usa ‹ ›) para trocar de lugar.
 */
import React, { useMemo, useState } from 'react';
import { X, Printer, AlertTriangle, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { fmtMoeda, type Registro } from './cultoApi';
import {
  COLUNAS_RELATORIO,
  imprimirRelatorioCulto,
  type Orientacao,
} from './cultoRelatorio';
import { Permissao } from '../../lib/permissoes/Permissao';

interface Props {
  registros: Registro[];
  titulo: string;
  periodo: string;
  /**
   * De onde o modal abriu. Do drawer de um culto ele vale a permissão da tela
   * do culto: quem chega por "Meus lançamentos" não tem a Gestão de Culto.
   */
  origem?: 'gestao' | 'culto';
  onFechar: () => void;
}

/** Hospedeira do culto: a da igreja, ou a própria igreja quando ela é hospedeira (a regra da Tabela). */
function hospedeiraDo(r: Registro): { id: string; name: string } | null {
  if (r.hostChurchId) return { id: r.hostChurchId, name: r.hostChurch?.name ?? r.church.name };
  return r.church.isHost ? { id: r.church.id, name: r.church.name } : null;
}

/** Opções únicas, em ordem alfabética. */
function unicos(lista: ({ id: string; name: string } | null | undefined)[]) {
  const mapa = new Map<string, string>();
  for (const o of lista) if (o) mapa.set(o.id, o.name);
  return Array.from(mapa, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

const PADRAO = COLUNAS_RELATORIO.filter((c) => c.padrao).map((c) => c.chave);
const ORDEM_CATALOGO = new Map(COLUNAS_RELATORIO.map((c, i) => [c.chave, i]));

// Cada nível olha uma coisa (ver cultoRelatorio.ts): um clique monta a folha
// de quem vai ler, em vez de marcar e desmarcar coluna por coluna.
const MODELOS: { rotulo: string; colunas: string[] }[] = [
  { rotulo: 'Padrão', colunas: PADRAO },
  {
    rotulo: 'Secretário',
    colunas: ['igreja', 'data', 'horario', 'homens', 'mulheres', 'criancas', 'visitantes', 'conversoes', 'reconciliacoes', 'cadeiras', 'obsSecretario'],
  },
  { rotulo: 'Tesoureiro', colunas: ['igreja', 'data', 'horario', 'dizimos', 'qtdDizimos', 'ofertas', 'obsTesoureiro'] },
  { rotulo: 'Cobrança', colunas: ['igreja', 'hospedeira', 'data', 'status', 'pendencia', 'dirigente'] },
];

// A última escolha fica no navegador: quem imprime toda semana não deveria
// remontar as colunas a cada vez.
const CHAVE_PREFERENCIA = 'culto_relatorio_impressao';

interface Preferencia {
  colunas: string[];
  orientacao: Orientacao;
  totalizar: boolean;
  detalhar: boolean;
}

function lerPreferencia(): Preferencia | null {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE_PREFERENCIA) || 'null');
    if (!p || !Array.isArray(p.colunas)) return null;
    const colunas = p.colunas.filter((c: string) => ORDEM_CATALOGO.has(c));
    if (!colunas.length) return null;
    return {
      colunas,
      orientacao: p.orientacao === 'retrato' ? 'retrato' : 'paisagem',
      totalizar: p.totalizar !== false,
      detalhar: p.detalhar === true,
    };
  } catch {
    return null;
  }
}

export default function CultoImprimirModal({ registros: todos, titulo, periodo, origem = 'gestao', onFechar }: Props) {
  // Filtros do papel: escolhem entre os cultos que a tela já carregou.
  const [regionalId, setRegionalId] = useState('');
  const [hospedeiraId, setHospedeiraId] = useState('');
  const [igrejaId, setIgrejaId] = useState('');

  const regionais = useMemo(() => unicos(todos.map((r) => r.regional)), [todos]);
  const hospedeiras = useMemo(
    () => unicos(todos.filter((r) => !regionalId || r.regional?.id === regionalId).map(hospedeiraDo)),
    [todos, regionalId],
  );
  const igrejas = useMemo(
    () =>
      unicos(
        todos
          .filter((r) => !regionalId || r.regional?.id === regionalId)
          .filter((r) => !hospedeiraId || hospedeiraDo(r)?.id === hospedeiraId)
          .map((r) => ({ id: r.church.id, name: r.church.name })),
      ),
    [todos, regionalId, hospedeiraId],
  );
  const registros = useMemo(
    () =>
      todos.filter(
        (r) =>
          (!regionalId || r.regional?.id === regionalId) &&
          (!hospedeiraId || hospedeiraDo(r)?.id === hospedeiraId) &&
          (!igrejaId || r.church.id === igrejaId),
      ),
    [todos, regionalId, hospedeiraId, igrejaId],
  );

  const [preferencia] = useState(lerPreferencia);
  /** Colunas marcadas, NA ORDEM DO PAPEL (esquerda → direita). */
  const [escolhidas, setEscolhidas] = useState<string[]>(preferencia?.colunas ?? PADRAO);
  const [orientacao, setOrientacao] = useState<Orientacao>(preferencia?.orientacao ?? 'paisagem');
  const [totalizar, setTotalizar] = useState(preferencia?.totalizar ?? true);
  const [detalhar, setDetalhar] = useState(preferencia?.detalhar ?? false);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  const grupos = useMemo(() => {
    const mapa = new Map<string, typeof COLUNAS_RELATORIO>();
    for (const c of COLUNAS_RELATORIO) {
      if (!mapa.has(c.grupo)) mapa.set(c.grupo, []);
      mapa.get(c.grupo)!.push(c);
    }
    return Array.from(mapa.entries());
  }, []);

  const colunasDaFolha = escolhidas
    .map((k) => COLUNAS_RELATORIO.find((c) => c.chave === k))
    .filter((c): c is (typeof COLUNAS_RELATORIO)[number] => Boolean(c));
  const amostra = registros.slice(0, 3);

  function alternar(chave: string) {
    setEscolhidas((atual) => {
      if (atual.includes(chave)) return atual.filter((c) => c !== chave);
      // Coluna nova entra no lugar natural dela (antes da primeira que vem
      // depois no cadastro), não no fim: marcar "Data" não a joga lá na direita.
      const pos = ORDEM_CATALOGO.get(chave)!;
      const i = atual.findIndex((c) => (ORDEM_CATALOGO.get(c) ?? 0) > pos);
      return i < 0 ? [...atual, chave] : [...atual.slice(0, i), chave, ...atual.slice(i)];
    });
  }

  function mover(de: number, para: number) {
    setEscolhidas((atual) => {
      if (para < 0 || para >= atual.length || de === para) return atual;
      const nova = [...atual];
      const [item] = nova.splice(de, 1);
      nova.splice(para, 0, item);
      return nova;
    });
  }

  function aplicarModelo(colunas: string[]) {
    setEscolhidas(colunas.filter((c) => ORDEM_CATALOGO.has(c)));
  }

  function imprimir() {
    if (!escolhidas.length) {
      setErro('Escolha ao menos uma coluna.');
      return;
    }
    if (!registros.length) {
      setErro('Não há culto no período filtrado para imprimir.');
      return;
    }
    try {
      localStorage.setItem(
        CHAVE_PREFERENCIA,
        JSON.stringify({ colunas: escolhidas, orientacao, totalizar, detalhar } satisfies Preferencia),
      );
    } catch {
      /* sem armazenamento: só não lembra da escolha */
    }
    const recorte = [
      regionais.find((o) => o.id === regionalId)?.name,
      hospedeiras.find((o) => o.id === hospedeiraId)?.name,
      igrejas.find((o) => o.id === igrejaId)?.name,
    ].filter(Boolean);
    // A ordem do papel é a da prévia — a que quem imprime arrumou.
    const abriu = imprimirRelatorioCulto({
      registros,
      colunas: escolhidas,
      orientacao,
      titulo,
      periodo: recorte.length ? `${periodo} · ${recorte.join(' · ')}` : periodo,
      totalizar,
      detalhar,
    });
    if (!abriu) {
      setErro('O navegador bloqueou a janela de impressão. Libere os pop-ups deste site.');
      return;
    }
    onFechar();
  }

  const modeloAtivo = MODELOS.find(
    (m) => m.colunas.length === escolhidas.length && m.colunas.every((c, i) => escolhidas[i] === c),
  )?.rotulo;

  const rotuloSecao = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={(e) => {
        // Aberto de dentro do drawer, o clique no fundo não pode fechar o drawer junto.
        e.stopPropagation();
        onFechar();
      }}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Imprimir relatório</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {periodo} · {registros.length} culto(s) no filtro atual
            </p>
          </div>
          <button
            onClick={onFechar}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className={`grid gap-5 ${todos.length > 1 ? 'md:grid-cols-2' : ''}`}>
            {/* Com um culto só não há o que filtrar. */}
            {todos.length > 1 && (
              <div className="space-y-2">
                <span className={rotuloSecao}>O que imprimir</span>
                {(
                  [
                    ['Regional', regionalId, regionais, 'Todas as regionais', (v: string) => {
                      setRegionalId(v);
                      setHospedeiraId('');
                      setIgrejaId('');
                    }],
                    ['Hospedeira', hospedeiraId, hospedeiras, 'Todas as hospedeiras', (v: string) => {
                      setHospedeiraId(v);
                      setIgrejaId('');
                    }],
                    ['Igreja', igrejaId, igrejas, 'Todas as igrejas', (v: string) => setIgrejaId(v)],
                  ] as [string, string, { id: string; name: string }[], string, (v: string) => void][]
                ).map(([rotulo, valor, opcoes, todasRotulo, mudar]) => (
                  <label key={rotulo} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 text-slate-600 dark:text-slate-300">{rotulo}</span>
                    <select
                      value={valor}
                      onChange={(e) => mudar(e.target.value)}
                      className="flex-1 min-w-0 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    >
                      <option value="">{todasRotulo}</option>
                      {opcoes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <span className={rotuloSecao}>Orientação da folha</span>
                <div className="mt-2 flex gap-2">
                  {(
                    [
                      ['paisagem', 'Paisagem', 'Cabem mais colunas'],
                      ['retrato', 'Retrato', 'Poucas colunas'],
                    ] as [Orientacao, string, string][]
                  ).map(([valor, rotulo, dica]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setOrientacao(valor)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        orientacao === valor
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="block font-semibold">{rotulo}</span>
                      <span className="block text-xs opacity-70">{dica}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={totalizar}
                    onChange={(e) => setTotalizar(e.target.checked)}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  Somar as colunas de número no rodapé
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={detalhar}
                    onChange={(e) => setDetalhar(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-emerald-500"
                  />
                  <span>
                    Mostrar detalhes
                    <span className="block text-xs text-slate-400">
                      Agrupa por hospedeira/regional e abre, sob cada culto, o que ainda falta,
                      quem já enviou e o que o dirigente decidiu.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Prévia: a folha como vai sair. Cabeçalho arrastável = ordem do papel. */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={rotuloSecao}>Prévia da folha · {escolhidas.length} coluna(s)</span>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400">Modelos:</span>
                {MODELOS.map((m) => (
                  <button
                    key={m.rotulo}
                    type="button"
                    onClick={() => aplicarModelo(m.colunas)}
                    className={`rounded-full border px-2.5 py-1 font-medium transition-colors ${
                      modeloAtivo === m.rotulo
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {m.rotulo}
                  </button>
                ))}
              </div>
            </div>
            {colunasDaFolha.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center text-sm text-slate-400">
                Nenhuma coluna marcada. Escolha abaixo ou use um modelo.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      {colunasDaFolha.map((c, i) => (
                        <th
                          key={c.chave}
                          draggable
                          onDragStart={(e) => {
                            setArrastando(i);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setSobre(i);
                          }}
                          onDragLeave={() => setSobre((s) => (s === i ? null : s))}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (arrastando !== null) mover(arrastando, i);
                            setArrastando(null);
                            setSobre(null);
                          }}
                          onDragEnd={() => {
                            setArrastando(null);
                            setSobre(null);
                          }}
                          className={`cursor-grab select-none whitespace-nowrap border-b-2 border-slate-300 bg-slate-100 px-1 py-1.5 align-middle dark:border-slate-600 dark:bg-slate-900 ${
                            arrastando === i ? 'opacity-40' : ''
                          } ${sobre === i && arrastando !== null && arrastando !== i ? 'bg-emerald-100 dark:bg-emerald-900/40' : ''}`}
                        >
                          <div className={`flex items-center gap-0.5 ${c.numero ? 'justify-end' : ''}`}>
                            <button
                              type="button"
                              onClick={() => mover(i, i - 1)}
                              disabled={i === 0}
                              title="Mover para a esquerda"
                              aria-label={`Mover ${c.titulo} para a esquerda`}
                              className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:invisible dark:hover:bg-slate-700 dark:hover:text-white"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <GripVertical className="h-3 w-3 shrink-0 text-slate-300" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                              {c.titulo}
                            </span>
                            <button
                              type="button"
                              onClick={() => mover(i, i + 1)}
                              disabled={i === colunasDaFolha.length - 1}
                              title="Mover para a direita"
                              aria-label={`Mover ${c.titulo} para a direita`}
                              className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:invisible dark:hover:bg-slate-700 dark:hover:text-white"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {amostra.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60">
                        {colunasDaFolha.map((c) => (
                          <td
                            key={c.chave}
                            className={`max-w-[12rem] truncate px-2 py-1 text-slate-600 dark:text-slate-300 ${c.numero ? 'text-right tabular-nums' : ''}`}
                          >
                            {c.valor(r)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {amostra.length === 0 && (
                      <tr>
                        <td colSpan={colunasDaFolha.length} className="px-2 py-3 text-center text-slate-400">
                          Sem culto no filtro para mostrar de exemplo.
                        </td>
                      </tr>
                    )}
                    {totalizar && amostra.length > 0 && (
                      <tr className="bg-slate-50 font-bold dark:bg-slate-900/60">
                        {colunasDaFolha.map((c, i) => {
                          if (!c.soma) {
                            return (
                              <td key={c.chave} className="whitespace-nowrap px-2 py-1 text-slate-700 dark:text-slate-200">
                                {i === 0 ? `Total — ${registros.length}` : ''}
                              </td>
                            );
                          }
                          const total = registros.reduce((acc, r) => acc + (c.soma!(r) || 0), 0);
                          return (
                            <td key={c.chave} className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-slate-700 dark:text-slate-200">
                              {c.chave === 'dizimos' || c.chave === 'ofertas' ? fmtMoeda(total) : total}
                            </td>
                          );
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-slate-400">
              Arraste o cabeçalho ou use ‹ › para trocar a coluna de lugar. A primeira fica à esquerda da folha.
              {registros.length > amostra.length && ` Prévia com ${amostra.length} de ${registros.length} cultos.`}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={rotuloSecao}>Colunas</span>
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setEscolhidas(COLUNAS_RELATORIO.map((c) => c.chave))}
                  className="text-emerald-600 hover:underline"
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setEscolhidas([])}
                  className="text-slate-500 hover:underline"
                >
                  Nenhuma
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {grupos.map(([grupo, colunas]) => (
                <div key={grupo} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">{grupo}</p>
                  <div className="space-y-1.5">
                    {colunas.map((c) => {
                      const posicao = escolhidas.indexOf(c.chave);
                      return (
                        <label
                          key={c.chave}
                          className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={posicao >= 0}
                            onChange={() => alternar(c.chave)}
                            className="h-4 w-4 accent-emerald-500"
                          />
                          <span className="flex-1">{c.titulo}</span>
                          {posicao >= 0 && (
                            <span className="rounded bg-slate-100 px-1.5 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-slate-700 dark:text-slate-300" title="Posição na folha">
                              {posicao + 1}º
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onFechar}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Fechar
          </button>
          {origem === 'culto' ? (
            <Permissao chave="tela_culto_registro.culto_imprimir_modal.imprimir" rotulo="Imprimir — Relatório do culto" herda="tela_culto_registro.view">
              <button
                onClick={imprimir}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </Permissao>
          ) : (
            <Permissao chave="culto_gestao.culto_imprimir_modal.imprimir" rotulo="Imprimir — Culto Imprimir Modal" herda="culto_gestao.view">
              <button
                onClick={imprimir}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </Permissao>
          )}
        </div>
      </div>
    </div>
  );
}
