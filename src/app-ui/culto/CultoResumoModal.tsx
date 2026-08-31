/**
 * Modal de resumo hierárquico.
 *
 * Clicou num nó, abre aqui: o consolidado daquele nível e a lista do nível
 * abaixo, cada linha já somada. Clicar numa linha desce mais um nível, com
 * trilha de navegação no topo para voltar. Chegando no culto, abre o detalhe.
 *
 *   Campo   →  hospedeiras / regionais
 *   Grupo   →  igrejas
 *   Igreja  →  cultos do período
 *   Culto   →  detalhe (gaveta), com os blocos e as aprovações
 *
 * Os números que aparecem são só os dos blocos que o usuário pode ver. Um
 * tesoureiro vê o financeiro consolidado; a presença nem soma.
 */
import React, { useEffect, useState } from 'react';
import {
  X,
  ChevronRight,
  Loader2,
  Landmark,
  Building2,
  MapPin,
  Church,
  CalendarDays,
  Wallet,
  Users,
  AlertTriangle,
} from 'lucide-react';
import {
  cultoApi,
  fmtData,
  fmtMoeda,
  ROTULO_STATUS,
  type NoResumo,
  type Resumo,
  type StatusCulto,
} from './cultoApi';
import { PONTO, TEXTO, TOM_DO_STATUS, tomDoSemaforo } from './cultoCores';

/** Um passo da trilha: o nó que o usuário abriu. */
export interface PassoResumo {
  nivel: 'CAMPO' | 'GRUPO' | 'IGREJA';
  id: string | null;
  tipoGrupo?: 'HOSPEDEIRA' | 'REGIONAL' | null;
  rotulo: string;
}

interface Props {
  /** Nó inicial — de onde o usuário clicou. */
  inicial: PassoResumo;
  de: string;
  ate: string;
  tipoCulto?: string | null;
  onFechar: () => void;
  onAbrirCulto: (registroId: string) => void;
}

const ICONE_NIVEL: Record<string, React.ElementType> = {
  CAMPO: Landmark,
  GRUPO: Building2,
  IGREJA: Church,
};

function Estatistica({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string | number;
  destaque?: 'verde' | 'vermelho';
}) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {rotulo}
      </div>
      <div
        className={`text-lg font-bold ${
          destaque === 'verde'
            ? TEXTO.verde
            : destaque === 'vermelho'
              ? TEXTO.vermelho
              : 'text-slate-900 dark:text-white'
        }`}
      >
        {valor}
      </div>
    </div>
  );
}

export default function CultoResumoModal({
  inicial,
  de,
  ate,
  tipoCulto,
  onFechar,
  onAbrirCulto,
}: Props) {
  const [trilha, setTrilha] = useState<PassoResumo[]>([inicial]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const atual = trilha[trilha.length - 1];

  useEffect(() => {
    let vivo = true;
    cultoApi
      .resumo({
        nivel: atual.nivel,
        id: atual.id,
        tipoGrupo: atual.tipoGrupo ?? null,
        de,
        ate,
        tipoCulto: tipoCulto ?? null,
      })
      .then((r) => {
        if (!vivo) return;
        setErro(null);
        setResumo(r);
      })
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [atual.nivel, atual.id, atual.tipoGrupo, de, ate, tipoCulto]);

  /**
   * Código gravado no culto → nome cadastrado ("CULTO" → "Culto", "EBD" →
   * "EBD (Escola Bíblica)"). O registro guarda o código, que é estável; quem
   * lê a tela quer o nome que a igreja cadastrou.
   */
  const [nomesDeTipo, setNomesDeTipo] = useState<Record<string, string>>({});
  useEffect(() => {
    cultoApi
      .tiposCulto()
      .then((lista) => {
        const mapa: Record<string, string> = {};
        for (const t of lista) mapa[t.codigo] = t.nome;
        setNomesDeTipo(mapa);
      })
      .catch(() => {
        /* sem cadastro, mostra o código mesmo */
      });
  }, []);

  const nomeDoTipo = (codigo: string) => nomesDeTipo[codigo] ?? codigo;

  function descer(no: NoResumo) {
    if (no.tipo === 'CULTO' && no.registroId) {
      onAbrirCulto(no.registroId);
      return;
    }
    if (!no.navegavel) return;
    setCarregando(true);
    setTrilha((t) => [
      ...t,
      {
        nivel: no.tipo === 'GRUPO' ? 'GRUPO' : 'IGREJA',
        id: no.id,
        tipoGrupo: no.tipoGrupo ?? null,
        rotulo: no.nome,
      },
    ]);
  }

  function voltarPara(indice: number) {
    if (indice === trilha.length - 1) return;
    setCarregando(true);
    setTrilha((t) => t.slice(0, indice + 1));
  }

  const IconeAtual = ICONE_NIVEL[atual.nivel] ?? Building2;

  function iconeDoFilho(no: NoResumo): React.ElementType {
    if (no.tipo === 'CULTO') return CalendarDays;
    if (no.tipo === 'IGREJA') return Church;
    return no.tipoGrupo === 'REGIONAL' ? MapPin : Building2;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho + trilha de navegação */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <IconeAtual className={`w-5 h-5 shrink-0 ${TEXTO.azul}`} />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {resumo?.titulo ?? atual.rotulo}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {resumo?.subtitulo ? `${resumo.subtitulo} · ` : ''}
                {fmtData(`${de}T00:00:00.000Z`)} a {fmtData(`${ate}T00:00:00.000Z`)}
              </p>
            </div>
            <button
              onClick={onFechar}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {trilha.length > 1 && (
            <nav className="flex flex-wrap items-center gap-1 mt-3 text-xs">
              {trilha.map((p, i) => (
                <React.Fragment key={`${p.nivel}-${p.id ?? 'campo'}-${i}`}>
                  {i > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                  <button
                    onClick={() => voltarPara(i)}
                    className={`px-1.5 py-0.5 rounded ${
                      i === trilha.length - 1
                        ? 'font-semibold text-slate-700 dark:text-slate-200'
                        : 'text-emerald-600 hover:underline'
                    }`}
                  >
                    {p.rotulo}
                  </button>
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {carregando && (
            <div className="flex items-center justify-center gap-2 text-slate-400 py-16">
              <Loader2 className="w-5 h-5 animate-spin" /> Consolidando…
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {resumo && !carregando && (
            <>
              {/* Consolidado deste nível */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Estatistica rotulo="Igrejas" valor={resumo.totais.igrejas} />
                <Estatistica rotulo="Cultos" valor={resumo.totais.cultos} />
                <Estatistica
                  rotulo="Concluídos"
                  valor={resumo.totais.concluidos}
                  destaque="verde"
                />
                <Estatistica
                  rotulo="Pendentes"
                  valor={resumo.totais.pendentes}
                  destaque="vermelho"
                />
              </div>

              {resumo.totais.financeiro && (
                <div>
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                    <Wallet className="w-3.5 h-3.5" /> Financeiro consolidado
                  </h3>
                  {/* Mesma ordem e mesmos rótulos do formulário de lançamento:
                      quem lança e quem confere leem a mesma sequência. */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <Estatistica
                      rotulo="Quantidade de dízimos"
                      valor={resumo.totais.financeiro.qtdDizimos}
                    />
                    <Estatistica
                      rotulo="Valor total de dízimos"
                      valor={fmtMoeda(resumo.totais.financeiro.totalDizimos)}
                    />
                    <Estatistica
                      rotulo="Valor total de ofertas"
                      valor={fmtMoeda(resumo.totais.financeiro.totalOfertas)}
                    />
                  </div>
                </div>
              )}

              {resumo.totais.presenca && (
                <div>
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                    <Users className="w-3.5 h-3.5" /> Presença consolidada
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <Estatistica rotulo="Público" valor={resumo.totais.presenca.publicoTotal} />
                    <Estatistica rotulo="Homens" valor={resumo.totais.presenca.homens} />
                    <Estatistica rotulo="Mulheres" valor={resumo.totais.presenca.mulheres} />
                    <Estatistica rotulo="Crianças" valor={resumo.totais.presenca.criancas} />
                    <Estatistica rotulo="Visitantes" valor={resumo.totais.presenca.visitantes} />
                    <Estatistica rotulo="Conversões" valor={resumo.totais.presenca.conversoes} />
                    <Estatistica
                      rotulo="Reconcil."
                      valor={resumo.totais.presenca.reconciliacoes}
                    />
                    <Estatistica
                      rotulo="Cadeiras vazias"
                      valor={resumo.totais.presenca.cadeirasVazias}
                    />
                  </div>
                </div>
              )}

              {!resumo.totais.financeiro && !resumo.totais.presenca && (
                <p className="text-sm text-slate-400">
                  Você não tem visibilidade sobre nenhum bloco de lançamento, então os totais não
                  são exibidos.
                </p>
              )}

              {/* Nível de baixo */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                  {resumo.nivel === 'CAMPO'
                    ? 'Hospedeiras e regionais'
                    : resumo.nivel === 'GRUPO'
                      ? 'Igrejas'
                      : 'Cultos do período'}
                  <span className="ml-1 font-normal normal-case">({resumo.filhos.length})</span>
                </h3>

                {resumo.filhos.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4">Nada neste período.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    {resumo.filhos.map((no) => {
                      const Icone = iconeDoFilho(no);
                      const clicavel = no.navegavel || Boolean(no.registroId);
                      return (
                        <li key={`${no.tipo}-${no.id}`}>
                          <button
                            onClick={() => descer(no)}
                            disabled={!clicavel}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
                              clicavel
                                ? 'hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer'
                                : 'cursor-default'
                            }`}
                          >
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                no.status
                                  ? PONTO[TOM_DO_STATUS[no.status]]
                                  : PONTO[tomDoSemaforo(no.cor === 'VERDE')]
                              }`}
                            />
                            <Icone className="w-4 h-4 shrink-0 text-slate-400" />

                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                                {no.tipo === 'CULTO' && no.dataCulto
                                  ? `${fmtData(`${no.dataCulto}T00:00:00.000Z`)}${
                                      no.nome.includes('·')
                                        ? ` · ${nomeDoTipo(no.nome.split('· ')[1])}`
                                        : ''
                                    }`
                                  : no.nome}
                              </span>
                              <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                                {no.tipo === 'CULTO'
                                  ? ROTULO_STATUS[no.status as StatusCulto]
                                  : `${no.concluidos}/${no.cultos} cultos concluídos`}
                                {no.dirigente ? ` · ${no.dirigente}` : ''}
                                {no.subtitulo ? ` · ${no.subtitulo}` : ''}
                              </span>
                            </span>

                            <span className="hidden sm:flex flex-col items-end shrink-0 text-xs">
                              {no.financeiro && (
                                <span className="text-slate-700 dark:text-slate-200 font-semibold">
                                  {fmtMoeda(
                                    no.financeiro.totalDizimos + no.financeiro.totalOfertas,
                                  )}
                                </span>
                              )}
                              {no.presenca && (
                                <span className="text-slate-400">
                                  {no.presenca.publicoTotal} pessoas ·{' '}
                                  {no.presenca.cadeirasVazias} vazias
                                </span>
                              )}
                            </span>

                            {clicavel && (
                              <ChevronRight className="w-4 h-4 shrink-0 text-slate-300" />
                            )}
                          </button>

                          {/* Os recados de cada nível sobre aquele culto. O
                              consolidado diz quanto; a observação diz por quê. */}
                          {no.observacoes?.length > 0 && (
                            <div className="px-4 pb-3 -mt-1 space-y-1">
                              {no.observacoes.map((o, i) => (
                                <p
                                  key={i}
                                  className="text-xs text-slate-500 dark:text-slate-400 pl-6"
                                >
                                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                                    {o.autor}:
                                  </span>{' '}
                                  {o.texto}
                                </p>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
