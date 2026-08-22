/**
 * Gráfico que a IA gera, desenhado no NAVEGADOR.
 *
 * Antes o servidor mandava um SVG pronto. SVG é imagem: não tem tooltip, não
 * responde a clique e não sabe somar nada — o usuário via as barras e não tinha
 * como saber quanto vale cada uma. Aqui o gráfico é montado no cliente a partir
 * dos MESMOS números que a ferramenta apurou, então dá para apontar o mouse,
 * clicar e conferir a tabela que deu origem ao desenho.
 *
 * A imagem continua sendo publicada no Storage e fica como link de download —
 * serve para colar em ata, relatório e WhatsApp, onde não roda JavaScript.
 *
 * O componente não busca nada: recebe os números prontos. Isso é de propósito —
 * o que ele mostra tem de ser exatamente o que a IA apurou e respondeu, sem uma
 * segunda consulta que possa divergir.
 */

import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Table2, Download, ChevronDown } from 'lucide-react';

export interface GraficoSerie {
  nome: string;
  valores: number[];
}

export interface GraficoDados {
  tipo: 'barra' | 'linha' | 'pizza' | 'barra_horizontal';
  titulo: string;
  subtitulo?: string;
  categorias: string[];
  series: GraficoSerie[];
  /** "R$ " para dinheiro, vazio para contagem. */
  prefixo?: string;
  /** URL do SVG no Storage, para baixar. */
  imagem?: string;
}

/** Mesma paleta do gráfico do servidor, para a imagem baixada não destoar. */
const CORES = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#64748b'];

function usarTemaEscuro(): boolean {
  const [escuro, setEscuro] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const raiz = document.documentElement;
    const sincronizar = () => setEscuro(raiz.classList.contains('dark'));
    const observador = new MutationObserver(sincronizar);
    observador.observe(raiz, { attributes: true, attributeFilter: ['class'] });
    return () => observador.disconnect();
  }, []);
  return escuro;
}

function formatar(valor: number, prefixo: string): string {
  const n = Number(valor) || 0;
  const casas = prefixo ? 2 : 0;
  return `${prefixo}${n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: 2 })}`;
}

function porcentagem(parte: number, todo: number): string {
  if (!todo) return '—';
  return `${((parte / todo) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

export function GraficoInterativo({ dados }: { dados: GraficoDados }) {
  const escuro = usarTemaEscuro();
  const [mostrarTabela, setMostrarTabela] = useState(false);
  const [linhaEmDestaque, setLinhaEmDestaque] = useState<number | null>(null);

  const prefixo = dados.prefixo ?? '';
  // Memorizados porque `?? []` cria um array novo a cada render e invalidaria
  // os useMemo abaixo — o ECharts remontaria o gráfico inteiro sem motivo.
  const categorias = useMemo(() => dados.categorias ?? [], [dados.categorias]);
  const series = useMemo(
    () => (dados.series ?? []).filter(s => Array.isArray(s.valores)),
    [dados.series],
  );

  // Totais calculados uma vez e usados nos três lugares: tooltip, tabela e
  // rodapé. Número que aparece em lugares diferentes tem de vir da mesma conta.
  const totais = useMemo(() => {
    const porCategoria = categorias.map((_, i) =>
      series.reduce((soma, s) => soma + (Number(s.valores[i]) || 0), 0),
    );
    const porSerie = series.map(s => s.valores.reduce((soma, v) => soma + (Number(v) || 0), 0));
    const geral = porSerie.reduce((soma, v) => soma + v, 0);
    return { porCategoria, porSerie, geral };
  }, [categorias, series]);

  const cor = {
    texto: escuro ? '#cbd5e1' : '#475569',
    titulo: escuro ? '#f1f5f9' : '#1e293b',
    suave: escuro ? '#94a3b8' : '#64748b',
    grade: escuro ? '#334155' : '#e2e8f0',
    fundoTooltip: escuro ? '#1e293b' : '#ffffff',
    bordaTooltip: escuro ? '#334155' : '#e2e8f0',
  };

  const option = useMemo(() => {
    const base: any = {
      backgroundColor: 'transparent',
      color: CORES,
      title: {
        text: dados.titulo,
        subtext: dados.subtitulo,
        left: 'center',
        textStyle: { fontSize: 15, fontWeight: 'bold', color: cor.titulo },
        subtextStyle: { fontSize: 11, color: cor.suave },
      },
      tooltip: {
        backgroundColor: cor.fundoTooltip,
        borderColor: cor.bordaTooltip,
        textStyle: { color: cor.titulo, fontSize: 12 },
        extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,.16); border-radius: 8px;',
      },
    };

    if (dados.tipo === 'pizza') {
      const valores = series[0]?.valores ?? [];
      return {
        ...base,
        tooltip: {
          ...base.tooltip,
          trigger: 'item',
          formatter: (p: any) =>
            `<b>${p.name}</b><br/>${formatar(p.value, prefixo)} — ${p.percent}% do total<br/>` +
            `<span style="color:${cor.suave}">Total: ${formatar(totais.geral, prefixo)}</span>`,
        },
        legend: { bottom: 4, textStyle: { color: cor.texto, fontSize: 11 } },
        series: [{
          type: 'pie',
          radius: ['38%', '64%'],
          center: ['50%', '50%'],
          data: categorias.map((nome, i) => ({ name: nome, value: Number(valores[i]) || 0 })),
          label: { formatter: '{b}\n{d}%', fontSize: 11, color: cor.texto },
        }],
      };
    }

    const horizontal = dados.tipo === 'barra_horizontal';
    const eixoCategoria = {
      type: 'category',
      data: categorias,
      axisLabel: { color: cor.texto, fontSize: 11 },
      axisLine: { lineStyle: { color: cor.grade } },
    };
    const eixoValor = {
      type: 'value',
      axisLabel: { color: cor.texto, fontSize: 11, formatter: (v: number) => formatar(v, prefixo) },
      splitLine: { lineStyle: { color: cor.grade } },
    };

    return {
      ...base,
      // Um total por categoria no tooltip: com várias séries, ver só as parcelas
      // obriga a somar de cabeça — que é justamente o que a ferramenta evita.
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (pontos: any[]) => {
          if (!pontos?.length) return '';
          const indice = pontos[0].dataIndex;
          const totalCategoria = totais.porCategoria[indice] ?? 0;
          const linhas = pontos
            .map(p => `${p.marker} ${p.seriesName}: <b>${formatar(p.value, prefixo)}</b>`)
            .join('<br/>');
          const rodape = [
            series.length > 1 ? `Total: <b>${formatar(totalCategoria, prefixo)}</b>` : null,
            `${porcentagem(totalCategoria, totais.geral)} do total geral`,
          ].filter(Boolean).join(' · ');
          return `<b>${pontos[0].axisValue}</b><br/>${linhas}` +
            `<br/><span style="color:${cor.suave};font-size:11px">${rodape}</span>`;
        },
      },
      grid: {
        left: horizontal ? 120 : 64,
        right: 24,
        top: dados.subtitulo ? 64 : 48,
        bottom: series.length > 1 ? 44 : 28,
      },
      ...(series.length > 1 ? { legend: { bottom: 4, textStyle: { color: cor.texto, fontSize: 11 } } } : {}),
      xAxis: horizontal ? eixoValor : eixoCategoria,
      yAxis: horizontal ? eixoCategoria : eixoValor,
      series: series.map(s => ({
        name: s.nome,
        type: dados.tipo === 'linha' ? 'line' : 'bar',
        data: s.valores.map(v => Number(v) || 0),
        smooth: dados.tipo === 'linha',
        barMaxWidth: 44,
        emphasis: { focus: 'series' },
      })),
    };
  }, [dados, categorias, series, prefixo, totais, cor.titulo, cor.suave, cor.texto, cor.grade, cor.fundoTooltip, cor.bordaTooltip]);

  // Clicar numa barra/fatia abre a tabela já apontando para aquele item — o
  // caminho mais curto entre "esse pico aí" e o número que o produziu.
  const aoClicar = (evento: any) => {
    // `dataIndex` é o índice da categoria tanto na barra/linha quanto na fatia.
    const indice = evento?.dataIndex;
    setLinhaEmDestaque(typeof indice === 'number' ? indice : null);
    setMostrarTabela(true);
  };

  if (categorias.length === 0 || series.length === 0) return null;

  return (
    <div className="my-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <ReactECharts
        option={option}
        style={{ height: dados.tipo === 'pizza' ? 320 : 300, width: '100%' }}
        opts={{ renderer: 'svg' }}
        notMerge
        lazyUpdate
        onEvents={{ click: aoClicar }}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 px-3 py-2">
        <button
          type="button"
          onClick={() => { setMostrarTabela(v => !v); setLinhaEmDestaque(null); }}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Table2 className="h-3.5 w-3.5" />
          {mostrarTabela ? 'Ocultar tabela' : 'Mostrar tabela'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mostrarTabela ? 'rotate-180' : ''}`} />
        </button>

        {dados.imagem && (
          <a
            href={dados.imagem}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar imagem
          </a>
        )}

        <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
          Total geral: <strong className="text-slate-600 dark:text-slate-300">{formatar(totais.geral, prefixo)}</strong>
        </span>
      </div>

      {mostrarTabela && (
        <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="text-left font-bold px-2.5 py-1.5 whitespace-nowrap border-b border-slate-200 dark:border-slate-700">
                  {dados.tipo === 'pizza' ? 'Item' : 'Categoria'}
                </th>
                {series.map((s, i) => (
                  <th key={i} className="text-right font-bold px-2.5 py-1.5 whitespace-nowrap border-b border-slate-200 dark:border-slate-700">
                    {s.nome}
                  </th>
                ))}
                {series.length > 1 && (
                  <th className="text-right font-bold px-2.5 py-1.5 whitespace-nowrap border-b border-slate-200 dark:border-slate-700">Total</th>
                )}
                <th className="text-right font-bold px-2.5 py-1.5 whitespace-nowrap border-b border-slate-200 dark:border-slate-700">%</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((categoria, i) => (
                <tr
                  key={i}
                  className={
                    linhaEmDestaque === i
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-inset ring-indigo-300 dark:ring-indigo-700'
                      : 'odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-800/40'
                  }
                >
                  <td className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800">{categoria}</td>
                  {series.map((s, j) => (
                    <td key={j} className="px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap border-b border-slate-100 dark:border-slate-800">
                      {formatar(Number(s.valores[i]) || 0, prefixo)}
                    </td>
                  ))}
                  {series.length > 1 && (
                    <td className="px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap font-semibold border-b border-slate-100 dark:border-slate-800">
                      {formatar(totais.porCategoria[i], prefixo)}
                    </td>
                  )}
                  <td className="px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    {porcentagem(totais.porCategoria[i], totais.geral)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                <td className="px-2.5 py-1.5">Total</td>
                {series.map((_, j) => (
                  <td key={j} className="px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap">
                    {formatar(totais.porSerie[j], prefixo)}
                  </td>
                ))}
                {series.length > 1 && (
                  <td className="px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap">{formatar(totais.geral, prefixo)}</td>
                )}
                <td className="px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
