import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";
import crypto from "crypto";

interface PdfReportData {
  titulo: string;
  subtitulo?: string;
  colunas: string[];
  linhas: string[][];
  totais?: string[];
}

export function generateReportPdf(data: PdfReportData): string {
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

  // Generate buffer and write to file
  const buffer = doc.output("arraybuffer");
  const fileName = `relatorio-${crypto.randomUUID()}.pdf`;
  const destDir = path.join(process.cwd(), "public", "temp-reports");
  
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const destPath = path.join(destDir, fileName);
  fs.writeFileSync(destPath, Buffer.from(buffer));

  return `/temp-reports/${fileName}`;
}
