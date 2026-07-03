/**
 * Exportação CSV/Excel — usado pelas abas Envio em Massa e Envios.
 * Reaproveita a lib `xlsx` já usada em outras telas do projeto (ex.:
 * SecretariatPipeline) para gerar tanto .xlsx quanto .csv a partir do
 * mesmo conjunto de linhas (array de objetos "coluna: valor").
 */

import * as XLSX from 'xlsx';

export function exportRows(
  rows: Array<Record<string, string | number | null | undefined>>,
  filenameBase: string,
  format: 'csv' | 'xlsx'
): void {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    XLSX.writeFile(wb, `${filenameBase}-${stamp}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(wb, `${filenameBase}-${stamp}.xlsx`);
  }
}
