/**
 * Painel do topo — a visão do Pastor Presidente, exatamente o card do diagrama:
 * hospedeira, total de igrejas, quais concluíram e quais faltam, com o nome dos
 * dirigentes. Vermelho enquanto faltar alguém; verde quando fechou.
 *
 * Grupos do tipo REGIONAL aparecem enquanto a organização por hospedeiras não
 * estiver feita — hoje isso é a maioria das igrejas (ver D3 da SPEC).
 */
import React, { useMemo, useState } from 'react';
import { Building2, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { ROTULO_STATUS, type GrupoDoPainel, type StatusCulto } from './cultoApi';
import type { PassoResumo } from './CultoResumoModal';
import { PASTILHA, PONTO, TEXTO } from './cultoCores';
import { CampoBusca, CarregarMais, INICIAL, PASSO, casaBusca } from './listaLeve';

interface Props {
  grupos: GrupoDoPainel[];
  /** Abre o modal de resumo consolidado do nó clicado. */
  onAbrirResumo: (passo: PassoResumo) => void;
}

function rotuloSituacao(status: StatusCulto | 'SEM_REGISTRO'): string {
  return status === 'SEM_REGISTRO' ? 'sem registro' : ROTULO_STATUS[status];
}

export default function CultoPainel({ grupos, onAbrirResumo }: Props) {
  // Busca nos grupos já carregados: casa o nome do grupo (hospedeira/regional)
  // ou o de uma igreja dele. Quando é a igreja que casa, o cartão mostra só ela.
  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(INICIAL);

  // Cada item guarda o grupo inteiro (para os números do cartão) e as listas
  // já filtradas (para o que aparece).
  const filtrados = useMemo(() => {
    const saida: { g: GrupoDoPainel; concluidas: GrupoDoPainel['concluidas']; pendentes: GrupoDoPainel['pendentes'] }[] = [];
    for (const g of grupos) {
      if (!busca.trim() || casaBusca(g.nome, busca)) {
        saida.push({ g, concluidas: g.concluidas, pendentes: g.pendentes });
        continue;
      }
      const concluidas = g.concluidas.filter((i) => casaBusca(i.nome, busca));
      const pendentes = g.pendentes.filter((i) => casaBusca(i.nome, busca));
      if (concluidas.length || pendentes.length) saida.push({ g, concluidas, pendentes });
    }
    return saida;
  }, [grupos, busca]);

  if (grupos.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400 dark:text-slate-500">
        Nenhuma igreja no período selecionado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
    <div className="max-w-sm">
      <CampoBusca
        valor={busca}
        onChange={(v) => {
          setBusca(v);
          setLimite(INICIAL);
        }}
        placeholder="Buscar igreja ou hospedeira…"
      />
    </div>
    {filtrados.length === 0 && (
      <p className="text-center py-12 text-sm text-slate-400">Nenhuma igreja com esse nome.</p>
    )}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* Os números do cartão (x/y) continuam os do grupo inteiro; a busca só
          escolhe quais igrejas aparecem na lista. */}
      {filtrados.slice(0, limite).map(({ g, concluidas, pendentes }) => {
        const verde = g.cor === 'VERDE';
        const Icone = g.tipo === 'HOSPEDEIRA' ? Building2 : MapPin;
        return (
          <div
            key={`${g.tipo}-${g.id}`}
            className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#e8ecf1] dark:border-[var(--sl-border)] bg-white dark:bg-[var(--sl-solid)] shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
          >
            {/* O semáforo do grupo, numa faixa no topo (antes era a borda inteira). */}
            <span
              aria-hidden
              className={`absolute inset-x-0 top-0 h-1 ${verde ? PONTO.verde : PONTO.vermelho}`}
            />
            <div
              onClick={() =>
                onAbrirResumo({ nivel: 'GRUPO', id: g.id, tipoGrupo: g.tipo, rotulo: g.nome })
              }
              title="Ver o resumo consolidado deste grupo"
              className="px-4 pt-4 pb-3 border-b border-[#e8ecf1] dark:border-[var(--sl-border)] cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${
                    verde ? PASTILHA.verde : PASTILHA.vermelho
                  }`}
                >
                  <Icone className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-bold leading-snug text-slate-900 dark:text-white truncate">
                    {g.nome}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {g.tipo === 'HOSPEDEIRA' ? 'Hospedeira' : 'Regional'}
                    {g.dirigente ? ` · dirigente ${g.dirigente}` : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs font-bold tabular-nums px-2.5 py-1 rounded-full ${
                    verde ? PASTILHA.verde : PASTILHA.vermelho
                  }`}
                >
                  {g.concluidas.length}/{g.totalIgrejas}
                </span>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 p-4 text-sm">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex items-center gap-1.5 text-[12px] font-bold ${TEXTO.verde}`}>
                    <CheckCircle2 className="w-4 h-4" />
                    Concluídas
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${PASTILHA.verde}`}>
                    {g.concluidas.length}
                  </span>
                </div>
                {concluidas.length === 0 ? (
                  <p className="text-slate-400 text-xs mt-2">nenhuma ainda</p>
                ) : (
                  <ul className="mt-2 divide-y divide-[#eef1f5] dark:divide-[var(--sl-border)] rounded-[14px] border border-[#eef1f5] dark:border-[var(--sl-border)]">
                    {concluidas.map((i) => (
                      <li
                        key={i.churchId}
                        onClick={() =>
                          onAbrirResumo({ nivel: 'IGREJA', id: i.churchId, rotulo: i.nome })
                        }
                        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 first:rounded-t-[14px] last:rounded-b-[14px]"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${PONTO.verde}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                            {i.nome}
                          </span>
                          {i.dirigente ? (
                            <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                              {i.dirigente}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex items-center gap-1.5 text-[12px] font-bold ${TEXTO.vermelho}`}>
                    <AlertCircle className="w-4 h-4" />
                    Falta
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${PASTILHA.vermelho}`}>
                    {g.pendentes.length}
                  </span>
                </div>
                {pendentes.length === 0 ? (
                  <p className="text-slate-400 text-xs mt-2">todas fecharam</p>
                ) : (
                  <ul className="mt-2 divide-y divide-[#eef1f5] dark:divide-[var(--sl-border)] rounded-[14px] border border-[#eef1f5] dark:border-[var(--sl-border)]">
                    {pendentes.map((i) => (
                      <li
                        key={i.churchId}
                        onClick={() =>
                          onAbrirResumo({ nivel: 'IGREJA', id: i.churchId, rotulo: i.nome })
                        }
                        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 first:rounded-t-[14px] last:rounded-b-[14px]"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${PONTO.vermelho}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                            {i.nome}
                          </span>
                          <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                            {i.dirigente ? `${i.dirigente} · ` : ''}
                            {rotuloSituacao(i.status)}
                            {i.totalCultos > 1 && (
                              <>
                                {' '}
                                ({i.cultosConcluidos}/{i.totalCultos} cultos)
                              </>
                            )}
                          </span>
                        </span>
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
    <CarregarMais restantes={filtrados.length - Math.min(limite, filtrados.length)} onMais={() => setLimite((l) => l + PASSO)} />
    </div>
  );
}
