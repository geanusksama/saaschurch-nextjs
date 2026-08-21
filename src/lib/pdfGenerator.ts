import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { publicarArquivoGerado } from "./generatedFiles";

interface PdfReportData {
  titulo: string;
  subtitulo?: string;
  colunas: string[];
  linhas: string[][];
  totais?: string[];
}

/**
 * Deixa o texto no que a fonte padrão do jsPDF (Helvetica, WinAnsi) sabe
 * escrever.
 *
 * A IA gosta de enfeitar a resposta com emoji e marcação markdown. No PDF isso
 * saía como lixo — "✅ Ativo" virava "' A t i v o", "📊" virava "Ø=ÜÈ" — porque
 * o caractere não existe na tabela da fonte e ainda quebra o espaçamento da
 * linha inteira. Aqui o emoji sai, o markdown (**, ##, `) sai, e o que sobra é
 * texto legível para quem vai receber o relatório.
 */
function limparParaPdf(texto: unknown): string {
  return String(texto ?? "")
    // marcação markdown que não faz sentido impressa
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/`/g, "")
    // emoji e qualquer caractere fora do que a fonte suporta
    .replace(/[^\u0000-\u00FF\u0152\u0153\u2018\u2019\u201C\u201D\u2013\u2014\u20AC]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function generateReportPdf(dataOriginal: PdfReportData): Promise<string> {
  // Limpa tudo na entrada: assim nenhum ponto do desenho precisa lembrar disso.
  const data: PdfReportData = {
    titulo: limparParaPdf(dataOriginal.titulo),
    subtitulo: dataOriginal.subtitulo ? limparParaPdf(dataOriginal.subtitulo) : undefined,
    colunas: (dataOriginal.colunas || []).map(limparParaPdf),
    linhas: (dataOriginal.linhas || []).map(linha => (linha || []).map(limparParaPdf)),
    totais: (dataOriginal.totais || []).map(limparParaPdf),
  };

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const margin = 15;
  const pageWidth = 210;
  const pageHeight = 297;
  const printableWidth = pageWidth - (margin * 2);
  let currentY = 20;

  // Header Banner Background (Modern Blue/Slate)
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, pageWidth, 40, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(data.titulo, margin, 18);

  // Subtitle
  if (data.subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(203, 213, 225); // Slate 300
    doc.text(data.subtitulo, margin, 26);
  }

  // Header bottom / body start
  currentY = 50;

  // Draw Table Headers
  const colCount = data.colunas.length;
  const colWidth = printableWidth / colCount;

  doc.setFillColor(241, 245, 249); // Slate 100
  doc.rect(margin, currentY, printableWidth, 10, "F");
  
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.2);
  doc.line(margin, currentY, margin + printableWidth, currentY);
  doc.line(margin, currentY + 10, margin + printableWidth, currentY + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85); // Slate 700

  data.colunas.forEach((col, idx) => {
    const xPos = margin + (idx * colWidth) + 3;
    doc.text(col, xPos, currentY + 6.5);
  });

  currentY += 10;

  // Draw Table Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42); // Slate 900

  data.linhas.forEach((row, rowIdx) => {
    // Page break check
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = 20;
      
      // Redraw headers on new page
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, currentY, printableWidth, 10, "F");
      doc.line(margin, currentY, margin + printableWidth, currentY);
      doc.line(margin, currentY + 10, margin + printableWidth, currentY + 10);
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      data.colunas.forEach((col, idx) => {
        const xPos = margin + (idx * colWidth) + 3;
        doc.text(col, xPos, currentY + 6.5);
      });
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      currentY += 10;
    }

    // Alternating background colors
    if (rowIdx % 2 === 1) {
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.rect(margin, currentY, printableWidth, 8, "F");
    }

    // Draw row cell content with character limit wrapping
    row.forEach((cell, idx) => {
      const xPos = margin + (idx * colWidth) + 3;
      const textValue = String(cell || "");
      
      // Limit string length to avoid columns overlapping
      const maxChars = Math.floor(colWidth * 0.45);
      let truncatedText = textValue;
      if (textValue.length > maxChars) {
        truncatedText = textValue.substring(0, maxChars - 3) + "...";
      }
      
      doc.text(truncatedText, xPos, currentY + 5.5);
    });

    // Draw row bottom line
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + 8, margin + printableWidth, currentY + 8);
    currentY += 8;
  });

  // Totais / Summary Section
  if (data.totais && data.totais.length > 0) {
    currentY += 5;
    
    // Page break check for totals
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(margin, currentY, printableWidth, 6 + (data.totais.length * 6), "F");
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.rect(margin, currentY, printableWidth, 6 + (data.totais.length * 6), "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59); // Slate 800
    
    currentY += 6;
    data.totais.forEach((totalLine) => {
      doc.text(totalLine, margin + 5, currentY);
      currentY += 6;
    });
  }

  // Footer / Generation time stamp
  const todayStr = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date());

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(`Relatório gerado em ${todayStr} por Inteligência Artificial.`, margin, pageHeight - 10);

  // Publica no Storage: gravar em public/ quebra no deploy serverless.
  const buffer = doc.output("arraybuffer");
  const fileName = `relatorio-${crypto.randomUUID()}.pdf`;
  return publicarArquivoGerado(Buffer.from(buffer), fileName, "application/pdf");
}

// ── Parecer por contato (módulo GF) ─────────────────────────────────────────

export interface GfContactPdfEntry {
  nome: string;
  telefone: string;
  situacao: string;
  sintese: string;
  pontosPositivos: string[];
  pontosNegativos: string[];
  tentativasSemResposta: number;
  respondeu: boolean;
  totalMensagens: number;
  linksEnviados: string[];
  enviouEndereco: boolean;
  sugestaoMelhoria: string;
  motivoSemGf: string;
}

/**
 * Um bloco por contato, não uma tabela: o parecer é texto corrido e não cabe em
 * colunas. Devolve o PDF em memória — quem chamou responde o download.
 */
export function generateGfContactReportPdf(titulo: string, subtitulo: string, entries: GfContactPdfEntry[]): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;
  const pageWidth = 210;
  const pageHeight = 297;
  const printableWidth = pageWidth - margin * 2;
  let y = 0;

  function header() {
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(titulo, margin, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225);
    doc.text(subtitulo, margin, 26);
    y = 50;
  }

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  }

  function paragraph(label: string, text: string) {
    if (!text) return;
    const lines = doc.splitTextToSize(text, printableWidth - 2);
    ensureSpace(6 + lines.length * 4.6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(label, margin, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(lines, margin, y);
    y += lines.length * 4.6 + 2;
  }

  function bullets(label: string, items: string[]) {
    if (!items.length) return;
    ensureSpace(6 + items.length * 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(label, margin, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    for (const item of items) {
      const lines = doc.splitTextToSize(`• ${item}`, printableWidth - 6);
      ensureSpace(lines.length * 4.6);
      doc.text(lines, margin + 2, y);
      y += lines.length * 4.6;
    }
    y += 2;
  }

  header();

  entries.forEach((entry, idx) => {
    ensureSpace(30);
    if (idx > 0) y += 4;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 5, printableWidth, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(entry.nome, margin + 3, y + 2.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(entry.telefone, pageWidth - margin - 3, y + 2.5, { align: "right" });
    y += 13;

    paragraph("SITUAÇÃO NO GF", entry.situacao);
    paragraph("SÍNTESE DA CONVERSA", entry.sintese);
    bullets("PONTOS POSITIVOS", entry.pontosPositivos);
    bullets("PONTOS NEGATIVOS", entry.pontosNegativos);
    paragraph(
      "INTERAÇÃO",
      entry.respondeu
        ? `${entry.totalMensagens} mensagens trocadas. ${entry.tentativasSemResposta} tentativa(s) sem resposta desde a última interação.`
        : `Sem nenhuma resposta do contato após ${entry.tentativasSemResposta} tentativa(s) de conversa.`
    );
    bullets("LINKS ENVIADOS", entry.linksEnviados);
    paragraph("ENDEREÇO DA IGREJA", entry.enviouEndereco ? "Já foi enviado ao contato." : "Ainda não foi enviado ao contato.");
    paragraph("O QUE PODERIA MELHORAR", entry.sugestaoMelhoria);
    paragraph("MOTIVO DE NÃO ESTAR EM GF", entry.motivoSemGf);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, margin + printableWidth, y);
    y += 4;
  });

  const todayStr = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Parecer gerado em ${todayStr} por Inteligência Artificial.`, margin, pageHeight - 10);
    doc.text(`${p}/${pages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
