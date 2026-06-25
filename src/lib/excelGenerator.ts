import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import crypto from "crypto";

interface ExcelReportData {
  titulo: string;
  colunas: string[];
  linhas: string[][];
  totais?: string[];
}

export function generateReportExcel(data: ExcelReportData): string {
  const wb = XLSX.utils.book_new();
  
  // Format the data array for spreadsheet
  const sheetData: any[][] = [];
  
  // Title row
  sheetData.push([data.titulo]);
  sheetData.push([]); // Empty row separator
  
  // Header row
  sheetData.push(data.colunas);
  
  // Data rows
  data.linhas.forEach(row => {
    // Convert numeric strings to numbers if possible for clean Excel formatting
    const formattedRow = row.map(val => {
      const num = Number(val);
      if (!isNaN(num) && val.trim() !== "" && !val.includes("-") && !val.includes("/")) {
        return num;
      }
      return val;
    });
    sheetData.push(formattedRow);
  });
  
  // Totais rows
  if (data.totais && data.totais.length > 0) {
    sheetData.push([]); // Empty row separator
    data.totais.forEach(totalLine => {
      sheetData.push([totalLine]);
    });
  }

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths automatically
  const colWidths = data.colunas.map((col, idx) => {
    let maxLen = col.length;
    data.linhas.forEach(row => {
      const cellLen = String(row[idx] || "").length;
      if (cellLen > maxLen) maxLen = cellLen;
    });
    return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
  });
  ws["!cols"] = colWidths;

  // Append worksheet
  XLSX.utils.book_append_sheet(wb, ws, "Relatorio");

  // Write buffer and save file
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const fileName = `relatorio-${crypto.randomUUID()}.xlsx`;
  const destDir = path.join(process.cwd(), "public", "temp-reports");
  
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const destPath = path.join(destDir, fileName);
  fs.writeFileSync(destPath, buffer);

  return `/temp-reports/${fileName}`;
}
