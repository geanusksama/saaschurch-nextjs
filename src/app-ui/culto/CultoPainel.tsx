/**
 * Painel do topo — a visão do Pastor Presidente, exatamente o card do diagrama:
 * hospedeira, total de igrejas, quais concluíram e quais faltam, com o nome dos
 * dirigentes. Vermelho enquanto faltar alguém; verde quando fechou.
 *
 * Grupos do tipo REGIONAL aparecem enquanto a organização por hospedeiras não
 * estiver feita — hoje isso é a maioria das igrejas (ver D3 da SPEC).
 */
import React from 'react';
import { Building2, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { ROTULO_STATUS, type GrupoDoPainel, type StatusCulto } from './cultoApi';
import type { PassoResumo } from './CultoResumoModal';
import { BORDA, PASTILHA, TEXTO } from './cultoCores';

interface Props {
  grupos: GrupoDoPainel[];
  /** Abre o modal de resumo consolidado do nó clicado. */
  onAbrirResumo: (passo: PassoResumo) => void;
}

function rotuloSituacao(status: StatusCulto | 'SEM_REGISTRO'): string {
  return status === 'SEM_REGISTRO' ? 'sem registro' : ROTULO_STATUS[status];
}

export default function CultoPainel({ grupos, onAbrirResumo }: Props) {
  if (grupos.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400 dark:text-slate-500">
        Nenhuma igreja no período selecionado.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {grupos.map((g) => {
        const verde = g.cor === 'VERDE';
        const Icone = g.tipo === 'HOSPEDEIRA' ? Building2 : MapPin;
        return (
          <div
            key={`${g.tipo}-${g.id}`}
            className={`rounded-xl border-2 bg-white dark:bg-slate-800 overflow-hidden shadow-sm ${
              verde ? BORDA.verde : BORDA.vermelho
            }`}
          >
            <div
              onClick={() =>
                onAbrirResumo({ nivel: 'GRUPO', id: g.id, tipoGrupo: g.tipo, rotulo: g.nome })
              }
              title="Ver o resumo consolidado deste grupo"
              className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Icone
                      className={`w-4 h-4 shrink-0 ${verde ? TEXTO.verde : TEXTO.vermelho}`}
                    />
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{g.nome}</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {g.tipo === 'HOSPEDEIRA' ? 'Hospedeira' : 'Regional'}
                    {g.dirigente ? ` · dirigente ${g.dirigente}` : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                    verde ? PASTILHA.verde : PASTILHA.vermelho
                  }`}
                >
                  {g.concluidas.length}/{g.totalIgrejas}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3 text-sm">
              <div>
                <div className={`flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wide ${TEXTO.verde}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Concluídas {g.concluidas.length}
                </div>
                {g.concluidas.length === 0 ? (
                  <p className="text-slate-400 text-xs mt-1">nenhuma ainda</p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {g.concluidas.map((i) => (
                      <li
                        key={i.churchId}
                        onClick={() =>
                          onAbrirResumo({ nivel: 'IGREJA', id: i.churchId, rotulo: i.nome })
                        }
                        className="text-slate-700 dark:text-slate-200 text-xs cursor-pointer hover:text-emerald-600"
                      >
                        {i.nome}
                        {i.dirigente ? (
                          <span className="text-slate-400"> — {i.dirigente}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className={`flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wide ${TEXTO.vermelho}`}>
                  <AlertCircle className="w-3.5 h-3.5" />
                  Falta {g.pendentes.length}
                </div>
                {g.pendentes.length === 0 ? (
                  <p className="text-slate-400 text-xs mt-1">todas fecharam</p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {g.pendentes.map((i) => (
                      <li
                        key={i.churchId}
                        onClick={() =>
                          onAbrirResumo({ nivel: 'IGREJA', id: i.churchId, rotulo: i.nome })
                        }
                        className="text-xs cursor-pointer hover:text-rose-600 text-slate-700 dark:text-slate-200"
                      >
                        {i.nome}
                        {i.dirigente ? (
                          <span className="text-slate-400"> — {i.dirigente}</span>
                        ) : null}
                        <span className="text-slate-400"> · {rotuloSituacao(i.status)}</span>
                        {i.totalCultos > 1 && (
                          <span className="text-slate-400">
                            {' '}
                            ({i.cultosConcluidos}/{i.totalCultos} cultos)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
