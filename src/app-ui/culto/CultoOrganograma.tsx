/**
 * Organograma da Gestão de Culto — árvore desenhada de cima para baixo.
 *
 *                        ┌──────────┐
 *                        │  Campo   │
 *                        └────┬─────┘
 *              ┌──────────────┼──────────────┐
 *        ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
 *        │Hospedeira │  │Hospedeira │  │ Regional  │
 *        └─────┬─────┘  └───────────┘  └───────────┘
 *        ┌─────┴─────┐
 *        │  Igreja   │  → e abaixo dela os cultos do período
 *        └───────────┘
 *
 * Cada nó é uma caixa com o semáforo, a contagem e o [+] que abre o nível de
 * baixo. Uma hospedeira chega a ter 11 filhas: em vez de abrir os níveis numa
 * fila horizontal que saía da tela, as hospedeiras ficam numa grade (1/2/3
 * colunas) e cada nível abre para baixo, recuado, com a linha vertical à
 * esquerda (só visual — os mesmos nós, cliques, [+] e cadeados).
 *
 * As cores de status vêm de cultoCores.ts em hex, para escapar da camada de
 * tema do globals.css que repinta as classes do Tailwind (ver o comentário lá).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Minus,
  Building2,
  MapPin,
  Church,
  CalendarDays,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  fmtData,
  fmtHora,
  turnoDoCulto,
  fmtMoeda,
  ROTULO_STATUS,
  type GrupoDoPainel,
  type IgrejaNoPainel,
  type Registro,
  type StatusCulto,
} from './cultoApi';
import {
  PASTILHA,
  PONTO,
  TEXTO,
  TOM_DO_STATUS,
  tomDoSemaforo,
  type Tom,
} from './cultoCores';
import type { PassoResumo } from './CultoResumoModal';

interface Props {
  grupos: GrupoDoPainel[];
  registros: Registro[];
  onAbrirRegistro: (registroId: string) => void;
  onAbrirResumo: (passo: PassoResumo) => void;
  /**
   * Nós com a visão de valores trancada, e o cadeado para mexer neles.
   *
   * Só o presidente do campo (e o master) recebem `podeBloquear`: é quem
   * enxerga a árvore inteira e decide quem, abaixo dele, vê os números.
   */
  bloqueados?: Set<string>;
  podeBloquear?: boolean;
  onAlternarBloqueio?: (churchId: string, bloquear: boolean) => void;
}

/**
 * Os filhos de um nó, um abaixo do outro.
 *
 * A linha vertical à esquerda une os irmãos; cada filho recebe um galho
 * horizontal na cor do estado dele, para o ramo já dizer se está verde ou
 * vermelho antes de você ler a caixa. Só CSS: nada aqui decide o que aparece.
 */
function Ramificacao({ filhos }: { filhos: { tom: Tom; conteudo: React.ReactNode }[] }) {
  if (filhos.length === 0) return null;
  return (
    <div className="ml-5 mt-2 flex flex-col gap-2.5 border-l-2 border-[#e8ecf1] dark:border-[var(--sl-border-2)] pl-4 pt-1">
      {filhos.map((filho, i) => (
        <div key={i} className="relative min-w-0">
          <span
            aria-hidden
            className={`absolute -left-4 top-6 h-0.5 w-4 rounded-r ${PONTO[filho.tom]}`}
          />
          {filho.conteudo}
        </div>
      ))}
    </div>
  );
}

/** Botão [+] / [−]. Vira um traço quando o nó não tem filhos. */
function Alternador({
  aberto,
  temFilhos,
  onClick,
}: {
  aberto: boolean;
  temFilhos: boolean;
  onClick: () => void;
}) {
  if (!temFilhos) {
    return (
      <span className="w-6 h-6 shrink-0 inline-flex items-center justify-center text-slate-300 dark:text-slate-600">
        ·
      </span>
    );
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={aberto ? 'Recolher' : 'Expandir'}
      className="w-6 h-6 shrink-0 inline-flex items-center justify-center rounded-lg border border-[#e8ecf1] dark:border-[var(--sl-border-2)] bg-white dark:bg-[var(--sl-solid)] text-slate-500 hover:border-slate-400 transition-colors"
    >
      {aberto ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
    </button>
  );
}

interface CaixaProps {
  icone: React.ElementType;
  corIcone: string;
  titulo: string;
  etiqueta?: string | null;
  detalhe?: string | null;
  tom: Tom;
  contagem?: string | null;
  aberto: boolean;
  temFilhos: boolean;
  onAlternar: () => void;
  onTitulo?: () => void;
  largura?: string;
  /**
   * A contagem do grupo, na linha de baixo: veio do nó do campo, que saiu.
   * Aqui ela diz respeito ao próprio nó — quantas igrejas ele tem, quantas
   * fecharam e quantas ainda devem.
   */
  numeros?: { igrejas: number; concluidas: number; pendentes: number };
  /** undefined = este nó não aceita cadeado (o campo e as regionais). */
  bloqueado?: boolean;
  onBloquear?: () => void;
}

function Caixa({
  icone: Icone,
  corIcone,
  titulo,
  etiqueta,
  detalhe,
  tom,
  contagem,
  aberto,
  temFilhos,
  onAlternar,
  onTitulo,
  largura = 'w-full',
  numeros,
  bloqueado,
  onBloquear,
}: CaixaProps) {
  return (
    <div
      className={`${largura} relative min-w-0 overflow-hidden rounded-[20px] border border-[#e8ecf1] dark:border-[var(--sl-border)] bg-white dark:bg-[var(--sl-solid)] shadow-[0_1px_3px_rgba(15,23,42,0.06)] pl-4 pr-3 py-3`}
    >
      {/* O semáforo do nó, numa faixa à esquerda (antes era a borda inteira). */}
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${PONTO[tom]}`} />
      <div className="flex items-start gap-2.5">
        <span className="mt-2 inline-flex">
          <Alternador aberto={aberto} temFilhos={temFilhos} onClick={onAlternar} />
        </span>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#f1f5f9] dark:bg-[var(--sl-chip)]">
          <Icone className={`w-5 h-5 ${corIcone}`} />
        </span>
        <div className="min-w-0 flex-1">
          <button
            onClick={onTitulo}
            disabled={!onTitulo}
            title={onTitulo ? 'Ver o resumo consolidado' : undefined}
            className={`block w-full text-left text-[14px] font-bold leading-snug text-slate-900 dark:text-slate-100 truncate ${
              onTitulo ? 'hover:underline' : 'cursor-default'
            }`}
          >
            {titulo}
          </button>
          {etiqueta && (
            <span className="block text-[10px] uppercase tracking-wide font-bold text-slate-400">
              {etiqueta}
            </span>
          )}
          {detalhe && (
            <span className="block text-[12px] text-slate-500 dark:text-slate-400 truncate">
              {detalhe}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-1">
        {contagem && (
          <span
            className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${PASTILHA[tom]}`}
          >
            {contagem}
          </span>
        )}
        {/* Cadeado do nó: trancado, quem dirige aqui aprova sem ver os valores
            lançados abaixo. Sem onBloquear, vira só o indicador. */}
        {bloqueado !== undefined && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBloquear?.();
            }}
            disabled={!onBloquear}
            title={
              bloqueado
                ? 'Visão trancada: quem dirige este nó não vê os valores lançados abaixo. Clique para liberar.'
                : 'Visão liberada: quem dirige este nó vê os valores lançados abaixo. Clique para trancar.'
            }
            className={`shrink-0 p-1 rounded-lg ${
              bloqueado
                ? 'text-[#b45309] dark:text-[#fbbf24]'
                : 'text-slate-300 dark:text-slate-600'
            } ${onBloquear ? 'hover:bg-slate-100 dark:hover:bg-slate-700' : 'cursor-default'}`}
          >
            {bloqueado ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
        )}
        </div>
      </div>

      {numeros && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-[#f1f5f9] dark:bg-[var(--sl-chip)] px-2 py-0.5 font-semibold text-slate-600 dark:text-slate-300">
            {numeros.igrejas} igrejas
          </span>
          <span className={`rounded-full px-2 py-0.5 font-bold ${PASTILHA.verde}`}>
            {numeros.concluidas} concluídas
          </span>
          <span className={`rounded-full px-2 py-0.5 font-bold ${PASTILHA.vermelho}`}>
            {numeros.pendentes} pendentes
          </span>
        </div>
      )}
    </div>
  );
}

export default function CultoOrganograma({
  grupos,
  registros,
  onAbrirRegistro,
  onAbrirResumo,
  bloqueados,
  podeBloquear = false,
  onAlternarBloqueio,
}: Props) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({ campo: true });

  // ── Zoom e deslocamento, no espírito do editor do n8n ─────────────────────
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 2;
  const telaRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [arrastando, setArrastando] = useState(false);
  const origem = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const aplicarZoom = useCallback((delta: number) => {
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number((z + delta).toFixed(2)))));
  }, []);

  const reenquadrar = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  function aoPressionar(e: React.MouseEvent) {
    // Só arrasta pelo fundo: clique em botão/caixa continua funcionando.
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    setArrastando(true);
    origem.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }

  /**
   * O mesmo arrasto pelo toque.
   *
   * `onMouseDown` não dispara em celular, e sem isto a árvore ficava presa: no
   * telefone ela é maior que a tela em qualquer zoom. Um dedo só move; o resto
   * (pinça) fica com os botões de zoom, que já estão ali no canto.
   */
  function aoTocar(e: React.TouchEvent) {
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    const t = e.touches[0];
    if (!t) return;
    setArrastando(true);
    origem.current = { x: t.clientX, y: t.clientY, panX: pan.x, panY: pan.y };
  }

  useEffect(() => {
    if (!arrastando) return;
    function moverToque(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      // Impede a página de rolar junto enquanto o dedo arrasta a árvore.
      e.preventDefault();
      setPan({
        x: origem.current.panX + (t.clientX - origem.current.x),
        y: origem.current.panY + (t.clientY - origem.current.y),
      });
    }
    window.addEventListener('touchmove', moverToque, { passive: false });
    window.addEventListener('touchend', () => setArrastando(false));
    return () => {
      window.removeEventListener('touchmove', moverToque);
    };
  }, [arrastando]);

  useEffect(() => {
    if (!arrastando) return;
    function mover(e: MouseEvent) {
      setPan({
        x: origem.current.panX + (e.clientX - origem.current.x),
        y: origem.current.panY + (e.clientY - origem.current.y),
      });
    }
    function soltar() {
      setArrastando(false);
    }
    window.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', soltar);
    return () => {
      window.removeEventListener('mousemove', mover);
      window.removeEventListener('mouseup', soltar);
    };
  }, [arrastando]);

  // Roda do mouse dá zoom no ponto do cursor, para não "fugir" da tela.
  const aoRolar = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const caixa = telaRef.current?.getBoundingClientRect();
      if (!caixa) return;
      const cursorX = e.clientX - caixa.left;
      const cursorY = e.clientY - caixa.top;
      setZoom((zAtual) => {
        const novo = Math.min(
          ZOOM_MAX,
          Math.max(ZOOM_MIN, Number((zAtual * (e.deltaY > 0 ? 0.9 : 1.1)).toFixed(3))),
        );
        const fator = novo / zAtual;
        setPan((p) => ({
          x: cursorX - (cursorX - p.x) * fator,
          y: cursorY - (cursorY - p.y) * fator,
        }));
        return novo;
      });
    },
    [],
  );

  function alternar(chave: string) {
    setAbertos((s) => ({ ...s, [chave]: !s[chave] }));
  }

  const registrosPorIgreja = useMemo(() => {
    const mapa = new Map<string, Registro[]>();
    for (const r of registros) {
      const lista = mapa.get(r.churchId) ?? [];
      lista.push(r);
      mapa.set(r.churchId, lista);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => b.dataCulto.localeCompare(a.dataCulto));
    }
    return mapa;
  }, [registros]);

  // ── Nível 4: o culto ──────────────────────────────────────────────────────
  function noCulto(r: Registro) {
    const tom = TOM_DO_STATUS[r.status as StatusCulto];
    const fin = r.lancamentos.find((l) => l.bloco === 'FINANCEIRO');
    return (
      <div
        key={r.id}
        onClick={() => onAbrirRegistro(r.id)}
        className={`relative w-full min-w-0 overflow-hidden rounded-[14px] border border-[#e8ecf1] dark:border-[var(--sl-border)] bg-white dark:bg-[var(--sl-solid)] pl-4 pr-3 py-2 cursor-pointer hover:shadow-md transition-shadow`}
      >
        <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${PONTO[tom]}`} />
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {fmtData(r.dataCulto)}
            {turnoDoCulto(r.horaInicio) ? ` · ${turnoDoCulto(r.horaInicio)}` : ''}
            {fmtHora(r.horaInicio, r.horaFim) ? ` · ${fmtHora(r.horaInicio, r.horaFim)}` : ''}
          </span>
          <span className={`ml-auto w-2 h-2 rounded-full shrink-0 ${PONTO[tom]}`} />
        </div>
        <span className={`block text-[11px] font-medium ${TEXTO[tom]}`}>
          {ROTULO_STATUS[r.status]}
        </span>
        {fin && (
          <span className="block text-[10px] text-slate-400 truncate">
            {fmtMoeda(fin.totalDizimos)} díz · {fmtMoeda(fin.totalOfertas)} of
          </span>
        )}
      </div>
    );
  }

  // ── Nível 3: a igreja ─────────────────────────────────────────────────────
  function noIgreja(igreja: IgrejaNoPainel, chavePai: string) {
    const chave = `${chavePai}/i:${igreja.churchId}`;
    const cultos = registrosPorIgreja.get(igreja.churchId) ?? [];
    const aberto = abertos[chave] ?? false;
    const tom = tomDoSemaforo(igreja.status === 'CONCLUIDO');

    return (
      <div key={igreja.churchId} className="flex min-w-0 flex-col">
        <Caixa
          icone={Church}
          corIcone="text-slate-400"
          titulo={igreja.nome}
          detalhe={igreja.dirigente ?? 'sem dirigente anexado'}
          tom={tom}
          contagem={
            igreja.totalCultos > 0
              ? `${igreja.cultosConcluidos}/${igreja.totalCultos}`
              : 'sem culto'
          }
          aberto={aberto}
          temFilhos={cultos.length > 0}
          onAlternar={() => alternar(chave)}
          onTitulo={() =>
            onAbrirResumo({ nivel: 'IGREJA', id: igreja.churchId, rotulo: igreja.nome })
          }
          largura="w-full"
          bloqueado={bloqueados ? bloqueados.has(igreja.churchId) : undefined}
          onBloquear={
            podeBloquear && onAlternarBloqueio
              ? () => onAlternarBloqueio(igreja.churchId, !bloqueados?.has(igreja.churchId))
              : undefined
          }
        />
        {aberto && cultos.length > 0 && (
          <>
            <Ramificacao
              filhos={cultos.map((r) => ({
                tom: TOM_DO_STATUS[r.status as StatusCulto],
                conteudo: noCulto(r),
              }))}
            />
          </>
        )}
      </div>
    );
  }

  // ── Nível 2: a hospedeira ou a regional ───────────────────────────────────
  function noGrupo(g: GrupoDoPainel) {
    const chave = `g:${g.tipo}:${g.id}`;
    const aberto = abertos[chave] ?? false;
    // Pendentes primeiro: é o que quem está acima foi olhar.
    const igrejas = [...g.pendentes, ...g.concluidas];
    const tom = tomDoSemaforo(g.cor === 'VERDE');

    return (
      <div key={chave} className="flex min-w-0 flex-col">
        <Caixa
          icone={g.tipo === 'HOSPEDEIRA' ? Building2 : MapPin}
          corIcone={g.tipo === 'HOSPEDEIRA' ? 'text-[#0284c7]' : 'text-[#7c3aed]'}
          titulo={g.nome}
          etiqueta={g.tipo === 'HOSPEDEIRA' ? 'hospedeira' : 'regional'}
          detalhe={g.dirigente ? `dirigente ${g.dirigente}` : 'sem dirigente anexado'}
          tom={tom}
          contagem={null}
          aberto={aberto}
          temFilhos={igrejas.length > 0}
          onAlternar={() => alternar(chave)}
          onTitulo={() =>
            onAbrirResumo({ nivel: 'GRUPO', id: g.id, tipoGrupo: g.tipo, rotulo: g.nome })
          }
          largura="w-full"
          numeros={{
            igrejas: g.totalIgrejas,
            concluidas: g.concluidas.length,
            pendentes: g.pendentes.length,
          }}
          bloqueado={
            g.tipo === 'HOSPEDEIRA' && bloqueados ? bloqueados.has(g.id) : undefined
          }
          onBloquear={
            g.tipo === 'HOSPEDEIRA' && podeBloquear && onAlternarBloqueio
              ? () => onAlternarBloqueio(g.id, !bloqueados?.has(g.id))
              : undefined
          }
        />
        {aberto && igrejas.length > 0 && (
          <>
            <Ramificacao
              filhos={igrejas.map((i) => ({
                tom: tomDoSemaforo(i.status === 'CONCLUIDO'),
                conteudo: noIgreja(i, chave),
              }))}
            />
          </>
        )}
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400 dark:text-slate-500">
        Nenhuma igreja no período selecionado.
      </div>
    );
  }


  return (
    <div
      ref={telaRef}
      onMouseDown={aoPressionar}
      onTouchStart={aoTocar}
      onWheel={aoRolar}
      // Ocupa o que sobra da janela e encosta nas bordas: a árvore é grande e
      // qualquer moldura só rouba espaço dela.
      className={`relative bg-[#f8fafc] dark:bg-slate-900/60 border-t border-[#e8ecf1] dark:border-[var(--sl-border)] overflow-hidden touch-none -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 h-[calc(100vh-13rem)] sm:h-[calc(100vh-9.5rem)] ${
        arrastando ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Controles de zoom, no canto — como no editor do n8n. */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-2xl border border-[#e8ecf1] dark:border-[var(--sl-border)] bg-white dark:bg-[var(--sl-solid)] shadow-sm p-1">
        <button
          onClick={() => aplicarZoom(-0.15)}
          title="Afastar"
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="px-1.5 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400 min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => aplicarZoom(0.15)}
          title="Aproximar"
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={reenquadrar}
          title="Reenquadrar"
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <span className="absolute bottom-3 left-3 z-10 text-[11px] text-slate-400 select-none">
        arraste para mover · role (ou use + e −) para dar zoom
      </span>

      {/* Camada que recebe zoom e deslocamento. */}
      <div
        className="absolute top-0 left-0 w-full origin-top-left px-4 pt-16 pb-12 sm:px-8"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transition: arrastando ? 'none' : 'transform 120ms ease-out',
        }}
      >
      {/* Os grupos são a raiz da árvore.
          O nó do campo saiu: ele só repetia o nome do campo e uma contagem que
          cabe melhor em cada hospedeira — e roubava uma linha inteira de altura
          numa árvore que já não cabe na tela. O consolidado do campo continua a
          um clique, no botão Resumo da barra. */}
      {/* Na vertical: uma hospedeira por cartão, em grade que quebra linha
          (1 coluna no celular, 2 no tablet, 3 no desktop). As filhas abrem
          para baixo, dentro da coluna de cada uma. */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {grupos.map((g) => noGrupo(g))}
      </div>
      </div>
    </div>
  );
}
