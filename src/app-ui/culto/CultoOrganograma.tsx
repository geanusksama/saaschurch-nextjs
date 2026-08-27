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
 * baixo. Uma hospedeira chega a ter 11 filhas, então a árvore é n-ária e rola
 * na horizontal — binária de verdade não caberia na hierarquia real.
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
  Landmark,
  CalendarDays,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import {
  fmtData,
  fmtHora,
  fmtMoeda,
  ROTULO_STATUS,
  type GrupoDoPainel,
  type IgrejaNoPainel,
  type Registro,
  type StatusCulto,
} from './cultoApi';
import {
  BORDA,
  PASTILHA,
  PONTO,
  TEXTO,
  TOM_DO_STATUS,
  tomDoSemaforo,
  type Tom,
} from './cultoCores';
import type { PassoResumo } from './CultoResumoModal';

interface Props {
  campoNome: string | null;
  grupos: GrupoDoPainel[];
  registros: Registro[];
  onAbrirRegistro: (registroId: string) => void;
  onAbrirResumo: (passo: PassoResumo) => void;
}

/** Barra que une os irmãos: neutra, mas visível. */
const COR_BARRA = 'bg-slate-400 dark:bg-slate-500';

/**
 * Haste vertical. Recebe o tom do nó de destino, para a linha já dizer se
 * aquele ramo está verde ou vermelho antes de você ler a caixa.
 */
function Haste({ tom }: { tom?: Tom }) {
  return <div className={`w-0.5 h-5 rounded ${tom ? PONTO[tom] : COR_BARRA}`} />;
}

/**
 * Uma linha de filhos com as ramificações em T.
 *
 * Para cada filho desenha metade esquerda e metade direita da barra
 * horizontal: o primeiro não tem a esquerda, o último não tem a direita. Com um
 * filho só, nenhuma das duas — fica apenas a haste reta.
 */
function Ramificacao({ filhos }: { filhos: { tom: Tom; conteudo: React.ReactNode }[] }) {
  if (filhos.length === 0) return null;
  return (
    <div className="flex items-start justify-center">
      {filhos.map((filho, i) => {
        const primeiro = i === 0;
        const ultimo = i === filhos.length - 1;
        return (
          <div key={i} className="flex flex-col items-center px-2">
            <div className="flex w-full h-0.5">
              <div className={`flex-1 rounded-l ${primeiro ? '' : COR_BARRA}`} />
              <div className={`flex-1 rounded-r ${ultimo ? '' : COR_BARRA}`} />
            </div>
            {/* A descida até o filho já vem na cor do estado dele. */}
            <Haste tom={filho.tom} />
            {filho.conteudo}
          </div>
        );
      })}
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
      <span className="w-5 h-5 shrink-0 inline-flex items-center justify-center text-slate-300 dark:text-slate-600">
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
      className="w-5 h-5 shrink-0 inline-flex items-center justify-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 hover:border-slate-500 transition-colors"
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
  largura = 'w-56',
}: CaixaProps) {
  return (
    <div
      className={`${largura} shrink-0 rounded-xl border-2 ${BORDA[tom]} bg-white dark:bg-slate-800 shadow-sm px-3 py-2`}
    >
      <div className="flex items-center gap-1.5">
        <Alternador aberto={aberto} temFilhos={temFilhos} onClick={onAlternar} />
        <Icone className={`w-4 h-4 shrink-0 ${corIcone}`} />
        <span className={`w-2 h-2 rounded-full shrink-0 ${PONTO[tom]}`} />
        {contagem && (
          <span
            className={`ml-auto shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded ${PASTILHA[tom]}`}
          >
            {contagem}
          </span>
        )}
      </div>

      <button
        onClick={onTitulo}
        disabled={!onTitulo}
        title={onTitulo ? 'Ver o resumo consolidado' : undefined}
        className={`mt-1 block w-full text-left text-sm font-semibold text-slate-800 dark:text-slate-100 truncate ${
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
        <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {detalhe}
        </span>
      )}
    </div>
  );
}

export default function CultoOrganograma({
  campoNome,
  grupos,
  registros,
  onAbrirRegistro,
  onAbrirResumo,
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

  const totais = useMemo(
    () => ({
      igrejas: grupos.reduce((s, g) => s + g.totalIgrejas, 0),
      concluidas: grupos.reduce((s, g) => s + g.concluidas.length, 0),
      pendentes: grupos.reduce((s, g) => s + g.pendentes.length, 0),
    }),
    [grupos],
  );

  // ── Nível 4: o culto ──────────────────────────────────────────────────────
  function noCulto(r: Registro) {
    const tom = TOM_DO_STATUS[r.status as StatusCulto];
    const fin = r.lancamentos.find((l) => l.bloco === 'FINANCEIRO');
    return (
      <div
        key={r.id}
        onClick={() => onAbrirRegistro(r.id)}
        className={`w-48 shrink-0 rounded-lg border ${BORDA[tom]} bg-white dark:bg-slate-800 px-2.5 py-1.5 cursor-pointer hover:shadow-md transition-shadow`}
      >
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {fmtData(r.dataCulto)}
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
      <div key={igreja.churchId} className="flex flex-col items-center">
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
          largura="w-52"
        />
        {aberto && cultos.length > 0 && (
          <>
            <Haste />
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
      <div key={chave} className="flex flex-col items-center">
        <Caixa
          icone={g.tipo === 'HOSPEDEIRA' ? Building2 : MapPin}
          corIcone={g.tipo === 'HOSPEDEIRA' ? 'text-[#0284c7]' : 'text-[#7c3aed]'}
          titulo={g.nome}
          etiqueta={g.tipo === 'HOSPEDEIRA' ? 'hospedeira' : 'regional'}
          detalhe={g.dirigente ? `dirigente ${g.dirigente}` : 'sem dirigente anexado'}
          tom={tom}
          contagem={`${g.concluidas.length}/${g.totalIgrejas}`}
          aberto={aberto}
          temFilhos={igrejas.length > 0}
          onAlternar={() => alternar(chave)}
          onTitulo={() =>
            onAbrirResumo({ nivel: 'GRUPO', id: g.id, tipoGrupo: g.tipo, rotulo: g.nome })
          }
        />
        {aberto && igrejas.length > 0 && (
          <>
            <Haste />
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

  const campoAberto = abertos.campo ?? true;
  const tomCampo = tomDoSemaforo(totais.pendentes === 0 && totais.igrejas > 0);

  return (
    <div
      ref={telaRef}
      onMouseDown={aoPressionar}
      onWheel={aoRolar}
      // Ocupa o que sobra da janela e encosta nas bordas: a árvore é grande e
      // qualquer moldura só rouba espaço dela.
      className={`relative bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 overflow-hidden -mx-6 -mb-6 h-[calc(100vh-9.5rem)] ${
        arrastando ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Controles de zoom, no canto — como no editor do n8n. */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-1">
        <button
          onClick={() => aplicarZoom(-0.15)}
          title="Afastar"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="px-1.5 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400 min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => aplicarZoom(0.15)}
          title="Aproximar"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={reenquadrar}
          title="Reenquadrar"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <span className="absolute bottom-3 left-3 z-10 text-[11px] text-slate-400 select-none">
        arraste para mover · role para dar zoom
      </span>

      {/* Camada que recebe zoom e deslocamento. */}
      <div
        className="absolute top-0 left-0 origin-top-left p-8"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transition: arrastando ? 'none' : 'transform 120ms ease-out',
        }}
      >
      <div className="inline-flex flex-col items-center">
        {/* ── Nível 1: o campo ── */}
        <div
          className={`rounded-xl border-2 ${BORDA[tomCampo]} bg-white dark:bg-slate-800 shadow-sm px-4 py-3 min-w-[18rem]`}
        >
          <div className="flex items-center gap-2">
            <Alternador aberto={campoAberto} temFilhos onClick={() => alternar('campo')} />
            <Landmark className="w-5 h-5 shrink-0 text-[#7c3aed]" />
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${PONTO[tomCampo]}`} />
            <button
              onClick={() =>
                onAbrirResumo({ nivel: 'CAMPO', id: null, rotulo: campoNome ?? 'Campo' })
              }
              title="Ver o resumo consolidado do campo inteiro"
              className="text-base font-bold text-slate-900 dark:text-white hover:underline truncate"
            >
              {campoNome ?? 'Campo'}
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pl-7">
            <span>{grupos.length} grupos</span>
            <span>{totais.igrejas} igrejas</span>
            <span className={`font-semibold ${TEXTO.verde}`}>{totais.concluidas} concluídas</span>
            <span className={`font-semibold ${TEXTO.vermelho}`}>{totais.pendentes} pendentes</span>
          </div>
        </div>

        {campoAberto && (
          <>
            <Haste />
            <Ramificacao
              filhos={grupos.map((g) => ({
                tom: tomDoSemaforo(g.cor === 'VERDE'),
                conteudo: noGrupo(g),
              }))}
            />
          </>
        )}
      </div>
      </div>
    </div>
  );
}
