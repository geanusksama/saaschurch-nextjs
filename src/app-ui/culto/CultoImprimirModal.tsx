/**
 * Escolha do que sai no papel, antes de mandar imprimir.
 *
 * Imprime exatamente os cultos que o filtro da tela deixou na lista — o que
 * está na tela é o que sai, sem uma segunda consulta que poderia divergir.
 */
import React, { useMemo, useState } from 'react';
import { X, Printer, AlertTriangle } from 'lucide-react';
import type { Registro } from './cultoApi';
import {
  COLUNAS_RELATORIO,
  imprimirRelatorioCulto,
  type Orientacao,
} from './cultoRelatorio';

interface Props {
  registros: Registro[];
  titulo: string;
  periodo: string;
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

export default function CultoImprimirModal({ registros: todos, titulo, periodo, onFechar }: Props) {
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

  const [escolhidas, setEscolhidas] = useState<string[]>(
    COLUNAS_RELATORIO.filter((c) => c.padrao).map((c) => c.chave),
  );
  const [orientacao, setOrientacao] = useState<Orientacao>('paisagem');
  const [totalizar, setTotalizar] = useState(true);
  const [detalhar, setDetalhar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const mapa = new Map<string, typeof COLUNAS_RELATORIO>();
    for (const c of COLUNAS_RELATORIO) {
      if (!mapa.has(c.grupo)) mapa.set(c.grupo, []);
      mapa.get(c.grupo)!.push(c);
    }
    return Array.from(mapa.entries());
  }, []);

  function alternar(chave: string) {
    setEscolhidas((atual) =>
      atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave],
    );
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
    // A ordem do papel é a do cadastro das colunas, não a ordem dos cliques:
    // marcar "Ofertas" antes de "Data" não deveria trocar as colunas de lugar.
    const ordenadas = COLUNAS_RELATORIO.filter((c) => escolhidas.includes(c.chave)).map(
      (c) => c.chave,
    );
    const recorte = [
      regionais.find((o) => o.id === regionalId)?.name,
      hospedeiras.find((o) => o.id === hospedeiraId)?.name,
      igrejas.find((o) => o.id === igrejaId)?.name,
    ].filter(Boolean);
    const abriu = imprimirRelatorioCulto({
      registros,
      colunas: ordenadas,
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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
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

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              O que imprimir
            </span>
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

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Orientação da folha
            </span>
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Colunas ({escolhidas.length})
              </span>
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

            {grupos.map(([grupo, colunas]) => (
              <div key={grupo}>
                <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {grupo}
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {colunas.map((c) => (
                    <label
                      key={c.chave}
                      className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={escolhidas.includes(c.chave)}
                        onChange={() => alternar(c.chave)}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      {c.titulo}
                    </label>
                  ))}
                </div>
              </div>
            ))}
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
          <button
            onClick={imprimir}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
