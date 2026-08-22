/**
 * Gráficos gerados pelo agente de IA.
 *
 * Mesma ideia do pdfGenerator: o servidor desenha o arquivo, publica no Storage
 * (ver generatedFiles) e devolve a URL. Quem insere a imagem na resposta é a
 * rota do chat, não o modelo — a tela reconhece a extensão .svg e desenha o
 * gráfico dentro da conversa, em vez de virar um link para baixar.
 *
 * Usa o ECharts em modo SSR (`ssr: true` + renderer SVG). É o mesmo ECharts já
 * usado nas telas do sistema, e nesse modo ele monta o SVG como string sem
 * DOM e sem canvas nativo — nada novo para instalar nem para compilar no
 * servidor.
 */

import * as echarts from "echarts";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { publicarArquivoGerado } from "./generatedFiles";

export type ChartType = "barra" | "linha" | "pizza" | "barra_horizontal";

export interface ChartSerie {
  nome: string;
  valores: number[];
}

export interface ChartData {
  tipo: ChartType;
  titulo: string;
  subtitulo?: string;
  categorias: string[];
  series: ChartSerie[];
  /** Prefixo dos valores nos rótulos — "R$ " para dinheiro, vazio para contagem */
  prefixo?: string;
}

/** Paleta alinhada ao indigo/emerald usado no resto do sistema. */
const CORES = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#64748b"];

const LARGURA = 900;
const ALTURA = 480;

function formatarValor(v: number, prefixo: string): string {
  const n = Number(v) || 0;
  return `${prefixo}${n.toLocaleString("pt-BR", { minimumFractionDigits: prefixo ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function montarOption(data: ChartData): any {
  const prefixo = data.prefixo ?? "";
  const categorias = data.categorias || [];
  const series = (data.series || []).filter(s => Array.isArray(s.valores));

  const base: any = {
    // O SVG é servido como arquivo solto: sem fundo branco explícito ele fica
    // transparente e some no tema escuro do chat.
    backgroundColor: "#ffffff",
    color: CORES,
    title: {
      text: data.titulo,
      subtext: data.subtitulo,
      left: "center",
      textStyle: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
      subtextStyle: { fontSize: 12, color: "#64748b" },
    },
    animation: false, // SSR não anima; ligado, o SVG sai no primeiro quadro
  };

  if (data.tipo === "pizza") {
    const valores = series[0]?.valores || [];
    return {
      ...base,
      legend: { bottom: 8, textStyle: { color: "#475569" } },
      series: [{
        type: "pie",
        radius: ["38%", "65%"],
        center: ["50%", "52%"],
        data: categorias.map((nome, i) => ({ name: nome, value: Number(valores[i]) || 0 })),
        label: {
          formatter: (p: any) => `${p.name}\n${formatarValor(p.value, prefixo)} (${p.percent}%)`,
          fontSize: 11,
          color: "#334155",
        },
      }],
    };
  }

  const horizontal = data.tipo === "barra_horizontal";
  const eixoCategoria = { type: "category", data: categorias, axisLabel: { color: "#475569", fontSize: 11 } };
  const eixoValor = {
    type: "value",
    axisLabel: {
      color: "#475569",
      fontSize: 11,
      formatter: (v: number) => formatarValor(v, prefixo),
    },
    splitLine: { lineStyle: { color: "#e2e8f0" } },
  };

  return {
    ...base,
    grid: { left: horizontal ? 140 : 80, right: 40, top: data.subtitulo ? 80 : 64, bottom: series.length > 1 ? 56 : 40 },
    ...(series.length > 1 ? { legend: { bottom: 8, textStyle: { color: "#475569" } } } : {}),
    xAxis: horizontal ? eixoValor : eixoCategoria,
    yAxis: horizontal ? eixoCategoria : eixoValor,
    series: series.map((s) => ({
      name: s.nome,
      type: data.tipo === "linha" ? "line" : "bar",
      data: s.valores.map(v => Number(v) || 0),
      smooth: data.tipo === "linha",
      barMaxWidth: 48,
      label: {
        show: series.length === 1 && categorias.length <= 12,
        position: horizontal ? "right" : "top",
        formatter: (p: any) => formatarValor(p.value, prefixo),
        fontSize: 10,
        color: "#334155",
      },
    })),
  };
}

/** Desenha o gráfico e devolve a URL pública do SVG. */
export async function generateChartSvg(data: ChartData): Promise<string> {
  if (!data?.titulo) throw new Error("O gráfico precisa de um título.");
  if (!Array.isArray(data.categorias) || data.categorias.length === 0) {
    throw new Error("O gráfico precisa de pelo menos uma categoria.");
  }
  if (!Array.isArray(data.series) || data.series.length === 0) {
    throw new Error("O gráfico precisa de pelo menos uma série de valores.");
  }

  const chart = echarts.init(null as any, null, {
    renderer: "svg",
    ssr: true,
    width: LARGURA,
    height: ALTURA,
  });
  chart.setOption(montarOption(data));
  const svg = chart.renderToSVGString();
  chart.dispose();

  const fileName = `grafico-${crypto.randomUUID()}.svg`;
  return publicarArquivoGerado(svg, fileName, "image/svg+xml");
}
