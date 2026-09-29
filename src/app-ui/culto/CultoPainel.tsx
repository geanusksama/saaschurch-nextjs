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
import { BORDA, PASTILHA, TEXTO } from './cultoCores';
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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* Os números do cartão (x/y) continuam os do grupo inteiro; a busca só
          escolhe quais igrejas aparecem na lista. */}
      {filtrados.slice(0, limite).map(({ g, concluidas, pendentes }) => {
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
                {concluidas.length === 0 ? (
                  <p className="text-slate-400 text-xs mt-1">nenhuma ainda</p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {concluidas.map((i) => (
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
                {pendentes.length === 0 ? (
                  <p className="text-slate-400 text-xs mt-1">todas fecharam</p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {pendentes.map((i) => (
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
    <CarregarMais restantes={filtrados.length - Math.min(limite, filtrados.length)} onMais={() => setLimite((l) => l + PASSO)} />
    </div>
  );
}
