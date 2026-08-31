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

export default function CultoImprimirModal({ registros, titulo, periodo, onFechar }: Props) {
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
    const abriu = imprimirRelatorioCulto({
      registros,
      colunas: ordenadas,
      orientacao,
      titulo,
      periodo,
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
