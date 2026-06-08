import { useState, useEffect, useMemo, Fragment } from 'react';
import { Printer, X, Columns, MonitorSmartphone, Maximize2, ArrowUpDown, ArrowUp, ArrowDown, Share2, Download } from 'lucide-react';
import type { ReciboRow } from './ReciboModal';
import { jsPDF } from 'jspdf';

type Row = ReciboRow;
type ColKey = 'igreja' | 'doc' | 'favorecido' | 'categoria' | 'tipodoc' | 'referencia' | 'formaPg' | 'data' | 'valor' | 'obs';
type Orientation = 'portrait' | 'landscape';
type SortDir = 'asc' | 'desc';

const COL_LABELS: Record<ColKey, string> = {
  igreja:     'Igreja',
  doc:        'Nº Doc',
  favorecido: 'Favorecido / Nome',
  categoria:  'Plano de Conta',
  tipodoc:    'Tipo Doc',
  referencia: 'Referência',
  formaPg:    'Forma Pgto',
  data:       'Data',
  valor:      'Valor',
  obs:        'Observação',
};
const ALL_COLS: ColKey[] = ['igreja', 'doc', 'favorecido', 'categoria', 'tipodoc', 'referencia', 'formaPg', 'data', 'valor', 'obs'];
const DEFAULT_COLS: ColKey[] = ['igreja', 'doc', 'favorecido', 'data', 'valor'];
// Cols that cannot be used for sorting
const UNSORTABLE: ColKey[] = ['obs'];

export type RelatorioProps = {
  rows: Row[];
  churchName: string;
  dataInicio: string;
  dataFim: string;
  onClose: () => void;
};

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

function groupByPlano(rows: Row[]) {
  const receitas = rows.filter(r => r.tipo === 'RECEITA');
  const despesas = rows.filter(r => r.tipo === 'DESPESA');

  function makeGroups(rws: Row[]) {
    const map = new Map<string, Row[]>();
    for (const r of rws) {
      const k = r.plano_de_conta || r.categoria || '—';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    // Default ordering within each group: date descending (most recent first)
    for (const groupRows of map.values()) {
      groupRows.sort((a, b) => b.data_lancamento.localeCompare(a.data_lancamento));
    }
    return map;
  }

  const result: { key: string; tipo: 'RECEITA' | 'DESPESA'; rows: Row[] }[] = [];

  const rMap = makeGroups(receitas);
  const rKeys = [...rMap.keys()].sort((a, b) => {
    const al = a.toLowerCase(), bl = b.toLowerCase();
    if (al.includes('dizimo') || al.includes('dízimo')) return -1;
    if (bl.includes('dizimo') || bl.includes('dízimo')) return 1;
    if (al.includes('oferta')) return -1;
    if (bl.includes('oferta')) return 1;
    return a.localeCompare(b, 'pt-BR');
  });
  for (const k of rKeys) result.push({ key: k, tipo: 'RECEITA', rows: rMap.get(k)! });

  const dMap = makeGroups(despesas);
  const dKeys = [...dMap.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  for (const k of dKeys) result.push({ key: k, tipo: 'DESPESA', rows: dMap.get(k)! });

  return result;
}

function getCell(row: Row, col: ColKey): string {
  switch (col) {
    case 'igreja':     return (row.churches as any)?.name || '—';
    case 'doc':        return String(row.legacy_id || row.num_doc || '—');
    case 'favorecido': return row.favorecido || '—';
    case 'categoria':  return row.plano_de_conta || row.categoria || '—';
    case 'tipodoc':    return row.tipo_documento || '—';
    case 'referencia': return row.referencia || '—';
    case 'formaPg':    return row.forma_pg || '—';
    case 'data':       return fmtDate(row.data_lancamento);
    case 'valor':      return `R$ ${fmt(Number(row.valor))}`;
    case 'obs':        return row.obs || '—';
  }
}

function sortRows(rws: Row[], sortCol: ColKey | null, sortDir: SortDir): Row[] {
  if (!sortCol) return rws;
  return [...rws].sort((a, b) => {
    const av = getCell(a, sortCol);
    const bv = getCell(b, sortCol);
    if (sortCol === 'valor') {
      const an = Number(a.valor), bn = Number(b.valor);
      return sortDir === 'asc' ? an - bn : bn - an;
    }
    if (sortCol === 'data') {
      return sortDir === 'asc'
        ? a.data_lancamento.localeCompare(b.data_lancamento)
        : b.data_lancamento.localeCompare(a.data_lancamento);
    }
    const cmp = av.localeCompare(bv, 'pt-BR', { sensitivity: 'base' });
    return sortDir === 'asc' ? cmp : -cmp;
  });
}

// ─── Print HTML generator ─────────────────────────────────────────────────────
function generateHtml(
  rows: Row[],
  cols: ColKey[],
  orientation: Orientation,
  churchName: string,
  dataInicio: string,
  dataFim: string,
  sortCol: ColKey | null,
  sortDir: SortDir,
): string {
  const groups = groupByPlano(rows);
  const totalReceita = rows.filter(r => r.tipo === 'RECEITA').reduce((s, r) => s + Number(r.valor), 0);
  const totalDespesa = rows.filter(r => r.tipo === 'DESPESA').reduce((s, r) => s + Number(r.valor), 0);
  const totalDizimos = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo')).reduce((s, r) => s + Number(r.valor), 0);
  const totalOfertas = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('oferta')).reduce((s, r) => s + Number(r.valor), 0);
  const qtdReceitas  = rows.filter(r => r.tipo === 'RECEITA').length;
  const qtdDespesas  = rows.filter(r => r.tipo === 'DESPESA').length;
  const qtdDizimos   = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo')).length;
  const qtdOfertas   = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('oferta')).length;
  const liquido      = totalReceita - totalDespesa;

  const valorIdx = cols.indexOf('valor');

  const bodySections = groups.map(group => {
    const sorted = sortRows(group.rows, sortCol, sortDir);
    const sectionTotal = group.rows.reduce((s, r) => s + Number(r.valor), 0);
    const isRec = group.tipo === 'RECEITA';
    const color = isRec ? '#166534' : '#991b1b';
    const borderColor = isRec ? '#bbf7d0' : '#fecaca';

    const dataRows = sorted.map(row => {
      const cells = cols.map((col, i) => {
        const align = col === 'valor' ? 'right' : 'left';
        const weight = col === 'valor' ? '700' : '400';
        return `<td style="padding:2px 5px;font-size:10px;border-bottom:1px solid #f0f0f0;text-align:${align};font-weight:${weight};">${getCell(row, col)}</td>`;
      }).join('');

      const favIdx = cols.indexOf('favorecido');
      const obsRow = (row.obs && !cols.includes('obs'))
        ? (() => {
            if (favIdx <= 0) {
              return `<tr><td colspan="${cols.length}" style="padding:1px 5px 3px 5px;font-size:9px;color:#2563eb;border-bottom:1px solid #f0f0f0;">${row.obs}</td></tr>`;
            }
            const before = `<td colspan="${favIdx}" style="border-bottom:1px solid #f0f0f0;"></td>`;
            const obsCell = `<td colspan="${cols.length - favIdx}" style="padding:1px 5px 3px 5px;font-size:9px;color:#2563eb;border-bottom:1px solid #f0f0f0;">${row.obs}</td>`;
            return `<tr>${before}${obsCell}</tr>`;
          })()
        : '';

      return `<tr>${cells}</tr>${obsRow}`;
    }).join('');

    const subtotalCells = cols.map((col, i) => {
      const isLast = i === cols.length - 1;
      const isBeforeLast = i === cols.length - 2;
      if (isLast && col === 'valor') {
        return `<td style="padding:3px 5px;font-size:10px;text-align:right;font-weight:700;color:${color};border-top:1px solid #e5e7eb;">R$ ${fmt(sectionTotal)}</td>`;
      }
      if (isBeforeLast && valorIdx === cols.length - 1) {
        return `<td style="padding:3px 5px;font-size:9px;text-align:right;color:#6b7280;font-style:italic;border-top:1px solid #e5e7eb;">Subtotal:</td>`;
      }
      return `<td style="border-top:1px solid #e5e7eb;"></td>`;
    }).join('');

    return `
      <tbody>
        <tr style="background:#fafafa;">
          <td colspan="${cols.length}" style="padding:7px 5px 4px;font-weight:700;font-size:12px;color:${color};border-bottom:2px solid ${borderColor};">${group.key}</td>
        </tr>
        ${dataRows}
        <tr>${subtotalCells}</tr>
        <tr><td colspan="${cols.length}" style="height:10px;"></td></tr>
      </tbody>`;
  }).join('');

  const headerCells = cols.map(col =>
    `<th style="padding:4px 5px;font-size:9px;text-align:${col === 'valor' ? 'right' : 'left'};text-transform:uppercase;border-bottom:2px solid #111;white-space:nowrap;">${COL_LABELS[col]}</th>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Tesouraria</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;padding:15px;max-width:100%;}
    h1{font-size:22px;font-weight:900;letter-spacing:1px;}
    .sub{font-size:11px;color:#666;margin-bottom:10px;}
    .hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #ddd;}
    .totals{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:4px;}
    .totals2{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:6px;}
    .tlbl{font-size:8px;font-weight:700;text-transform:uppercase;color:#666;}
    .tval{font-size:13px;font-weight:700;}
    .liquido{text-align:right;font-size:14px;font-weight:900;margin-bottom:10px;padding-top:4px;border-top:1px solid #ddd;}
    table{width:100%;border-collapse:collapse;}
    @media print{
      body{padding:0;}
      @page{size:A4 ${orientation};margin:10mm;}
      tbody{page-break-inside:auto;}
      tr{page-break-inside:avoid;}
    }
  </style>
</head>
<body>
  <h1>RELATÓRIO</h1>
  <p class="sub">Analítico</p>
  <div class="hdr">
    <div>
      <div class="tlbl">Igreja</div>
      <div style="font-size:12px;font-weight:600;">${churchName || 'Todas'}</div>
    </div>
    <div style="text-align:right;">
      <div class="tlbl">Período de</div>
      <div style="font-size:12px;font-weight:600;">${fmtDate(dataInicio)} a ${fmtDate(dataFim)}</div>
    </div>
  </div>
  <div class="totals">
    <div><div class="tlbl">Total Receita</div><div class="tval" style="color:#166534">R$ ${fmt(totalReceita)}</div></div>
    <div><div class="tlbl">Total Despesa</div><div class="tval" style="color:#991b1b">R$ ${fmt(totalDespesa)}</div></div>
    <div><div class="tlbl">Total Dízimos</div><div class="tval">R$ ${fmt(totalDizimos)}</div></div>
    <div><div class="tlbl">Total Ofertas</div><div class="tval">R$ ${fmt(totalOfertas)}</div></div>
  </div>
  <div class="totals2">
    <div><div class="tlbl">Qtd. Receitas</div><div class="tval" style="font-size:13px">${qtdReceitas}</div></div>
    <div><div class="tlbl">Qtd. Despesas</div><div class="tval" style="font-size:13px">${qtdDespesas}</div></div>
    <div><div class="tlbl">Qtd. Dízimos</div><div class="tval" style="font-size:13px">${qtdDizimos}</div></div>
    <div><div class="tlbl">Qtd. Ofertas</div><div class="tval" style="font-size:13px">${qtdOfertas}</div></div>
  </div>
  <div class="liquido" style="${liquido < 0 ? 'color:#c00;' : ''}">Líquido: R$ ${fmt(liquido)}</div>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    ${bodySections}
  </table>
</body>
</html>`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function RelatorioModal({ rows, churchName, dataInicio, dataFim, onClose }: RelatorioProps) {
  const [cols, setCols]               = useState<ColKey[]>(DEFAULT_COLS);
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [showColPicker, setShowColPicker] = useState(false);
  const [sortCol, setSortCol]         = useState<ColKey | null>(null);
  const [sortDir, setSortDir]         = useState<SortDir>('asc');
  const [isMobile, setIsMobile]       = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  function handleSortCol(col: ColKey) {
    if (UNSORTABLE.includes(col)) return;
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const groups = useMemo(() => {
    const base = groupByPlano(rows);
    return base.map(g => ({ ...g, rows: sortRows(g.rows, sortCol, sortDir) }));
  }, [rows, sortCol, sortDir]);

  const totalReceita = rows.filter(r => r.tipo === 'RECEITA').reduce((s, r) => s + Number(r.valor), 0);
  const totalDespesa = rows.filter(r => r.tipo === 'DESPESA').reduce((s, r) => s + Number(r.valor), 0);
  const totalDizimos = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo')).reduce((s, r) => s + Number(r.valor), 0);
  const totalOfertas = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('oferta')).reduce((s, r) => s + Number(r.valor), 0);
  const qtdReceitas  = rows.filter(r => r.tipo === 'RECEITA').length;
  const qtdDespesas  = rows.filter(r => r.tipo === 'DESPESA').length;
  const qtdDizimos   = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo')).length;
  const qtdOfertas   = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('oferta')).length;
  const liquido      = totalReceita - totalDespesa;

  function toggleCol(col: ColKey) {
    setCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  }

  function moveCol(col: ColKey, dir: -1 | 1) {
    setCols(prev => {
      const idx = prev.indexOf(col);
      if (idx === -1) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function handlePrint() {
    const html = generateHtml(rows, cols, orientation, churchName, dataInicio, dataFim, sortCol, sortDir);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.addEventListener('afterprint', () => document.body.removeChild(iframe));
    setTimeout(() => iframe.contentWindow?.print(), 500);
  }

  function generateReportPdf() {
    const doc = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = orientation === 'portrait' ? 210 : 297;
    const pageHeight = orientation === 'portrait' ? 297 : 210;

    let y = 15;
    const margin = 10;
    const startX = margin;

    const fmtNum = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');

    // Define weights for proportional column widths
    const COL_WEIGHTS: Record<ColKey, number> = {
      igreja: 2.0,
      doc: 1.2,
      favorecido: 3.5,
      categoria: 2.5,
      tipodoc: 1.5,
      referencia: 1.5,
      formaPg: 1.8,
      data: 1.5,
      valor: 2.0,
      obs: 3.0,
    };

    const totalWeight = cols.reduce((sum, col) => sum + (COL_WEIGHTS[col] || 1), 0);
    const usableWidth = pageWidth - 2 * margin;
    const colWidths = cols.map(col => ((COL_WEIGHTS[col] || 1) / totalWeight) * usableWidth);

    const getColX = (colIdx: number) => {
      let x = startX;
      for (let i = 0; i < colIdx; i++) {
        x += colWidths[i];
      }
      return x;
    };

    const truncateText = (text: string, width: number) => {
      let truncated = String(text);
      if (doc.getTextWidth(truncated) <= width - 2) return truncated;
      while (truncated.length > 0 && doc.getTextWidth(truncated) > width - 3) {
        truncated = truncated.slice(0, -1);
      }
      return truncated.slice(0, -1) + '…';
    };

    const printPageHeader = (pageNumber: number) => {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('RELATÓRIO TESOURARIA', startX, y);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Página ${pageNumber} | Emitido em: ${new Date().toLocaleString('pt-BR')}`, pageWidth - margin, y, { align: 'right' });
      
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.text(`Igreja: ${churchName || 'Todas'}`, startX, y);
      doc.text(`Período: ${fmtDt(dataInicio)} a ${fmtDt(dataFim)}`, pageWidth - margin, y, { align: 'right' });
      
      y += 3;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(startX, y, pageWidth - margin, y);
      y += 6;
    };

    // First page summary
    let pageCount = 1;
    printPageHeader(pageCount);

    const totalReceita = rows.filter(r => r.tipo === 'RECEITA').reduce((s, r) => s + Number(r.valor), 0);
    const totalDespesa = rows.filter(r => r.tipo === 'DESPESA').reduce((s, r) => s + Number(r.valor), 0);
    const totalDizimos = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo')).reduce((s, r) => s + Number(r.valor), 0);
    const totalOfertas = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('oferta')).reduce((s, r) => s + Number(r.valor), 0);
    const liquido = totalReceita - totalDespesa;

    // Totals grid
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`Total Receita: R$ ${fmtNum(totalReceita)}`, startX, y);
    doc.text(`Total Despesa: R$ ${fmtNum(totalDespesa)}`, startX + usableWidth / 4, y);
    doc.text(`Total Dízimos: R$ ${fmtNum(totalDizimos)}`, startX + 2 * usableWidth / 4, y);
    doc.text(`Total Ofertas: R$ ${fmtNum(totalOfertas)}`, startX + 3 * usableWidth / 4, y);

    y += 5;
    doc.setTextColor(liquido < 0 ? 153 : 22, liquido < 0 ? 27 : 101, liquido < 0 ? 27 : 52); // green or red
    doc.text(`Língua / Líquido: R$ ${fmtNum(liquido)}`, pageWidth - margin, y, { align: 'right' });
    y += 4;
    doc.line(startX, y, pageWidth - margin, y);
    y += 6;

    // Draw Table headers
    const drawTableHeaders = () => {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(startX, y - 4, usableWidth, 6, 'F');
      doc.setDrawColor(100, 116, 139); // slate-500
      doc.line(startX, y + 2, pageWidth - margin, y + 2);
      
      doc.setTextColor(15, 23, 42); // slate-900
      cols.forEach((col, i) => {
        const align = col === 'valor' ? 'right' : 'left';
        const colX = getColX(i) + (col === 'valor' ? colWidths[i] - 2 : 2);
        doc.text(COL_LABELS[col], colX, y, { align: align });
      });
      y += 6;
    };

    drawTableHeaders();

    const sortedGroups = groupByPlano(rows);
    for (const group of sortedGroups) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 15;
        pageCount++;
        printPageHeader(pageCount);
        drawTableHeaders();
      }

      // Group title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      const isRec = group.tipo === 'RECEITA';
      doc.setFillColor(isRec ? 240 : 254, isRec ? 253 : 242, isRec ? 244 : 242); // green/red tint
      doc.rect(startX, y - 4, usableWidth, 6, 'F');
      
      doc.setTextColor(isRec ? 22 : 153, isRec ? 101 : 27, isRec ? 52 : 27); // green/red text
      doc.text(group.key, startX + 2, y);
      y += 6;

      const groupRows = sortRows(group.rows, sortCol, sortDir);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85); // slate-700

      for (const row of groupRows) {
        if (y > pageHeight - 15) {
          doc.addPage();
          y = 15;
          pageCount++;
          printPageHeader(pageCount);
          drawTableHeaders();
        }

        // Draw row cells
        cols.forEach((col, i) => {
          const align = col === 'valor' ? 'right' : 'left';
          const colX = getColX(i) + (col === 'valor' ? colWidths[i] - 2 : 2);
          const cellVal = getCell(row, col);
          const truncated = truncateText(cellVal, colWidths[i]);
          doc.text(truncated, colX, y, { align: align });
        });
        y += 4.5;

        // Draw obs if present
        if (row.obs && !cols.includes('obs')) {
          if (y > pageHeight - 15) {
            doc.addPage();
            y = 15;
            pageCount++;
            printPageHeader(pageCount);
            drawTableHeaders();
          }
          doc.setFont('Helvetica', 'italic');
          doc.setTextColor(37, 99, 235); // blue-600
          doc.text(`  ↳ Obs: ${row.obs}`, startX + 4, y);
          doc.setFont('Helvetica', 'normal');
          doc.setTextColor(51, 65, 85);
          y += 4.5;
        }
      }

      // Group Subtotal
      const sectionTotal = group.rows.reduce((s, r) => s + Number(r.valor), 0);
      if (y > pageHeight - 15) {
        doc.addPage();
        y = 15;
        pageCount++;
        printPageHeader(pageCount);
        drawTableHeaders();
      }
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(isRec ? 22 : 153, isRec ? 101 : 27, isRec ? 52 : 27);
      doc.text(`Subtotal ${group.key}: R$ ${fmtNum(sectionTotal)}`, pageWidth - margin - 2, y, { align: 'right' });
      y += 7;
    }

    return doc;
  }

  async function handleShare() {
    try {
      const doc = generateReportPdf();
      const pdfBlob = doc.output('blob');
      const formattedChurch = (churchName || 'Todas').replace(/\s+/g, '_');
      const fileName = `relatorio-${formattedChurch}-${dataInicio}-a-${dataFim}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Relatório Tesouraria — ${churchName || 'Todas'}`,
          text: `Relatório Tesouraria de ${fmtDate(dataInicio)} a ${fmtDate(dataFim)}`,
        });
      } else if (navigator.share) {
        await navigator.share({
          title: `Relatório Tesouraria — ${churchName || 'Todas'}`,
          text: `Relatório Tesouraria de ${fmtDate(dataInicio)} a ${fmtDate(dataFim)}`,
        });
      } else {
        handleDownload();
      }
    } catch (err) {
      console.error('Erro ao compartilhar relatório:', err);
      toast.error('Erro ao compartilhar PDF');
    }
  }

  function handleDownload() {
    try {
      const doc = generateReportPdf();
      const formattedChurch = (churchName || 'Todas').replace(/\s+/g, '_');
      const fileName = `relatorio-${formattedChurch}-${dataInicio}-a-${dataFim}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('Erro ao baixar relatório:', err);
      toast.error('Erro ao gerar PDF');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 md:flex md:items-center md:justify-center md:p-3 flex flex-col">
      <div className="bg-white flex flex-col w-full h-full md:rounded-2xl md:shadow-2xl md:w-[96vw] md:max-w-[1200px] md:h-[92vh]">

        {/* ── Toolbar ── */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 md:px-5 border-b border-slate-200 bg-white rounded-t-none md:rounded-t-2xl flex-shrink-0">
          
          {/* Top Row on Mobile, Main Row on Desktop */}
          <div className="flex items-center justify-between w-full gap-2">
            <span className="text-base font-bold text-slate-900 truncate">Relatório Analítico — Tesouraria</span>
            
            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-2">
              {/* Orientation */}
              <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <button onClick={() => setOrientation('portrait')}
                  className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    orientation === 'portrait' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                  <MonitorSmartphone className="w-3.5 h-3.5" /> Retrato
                </button>
                <button onClick={() => setOrientation('landscape')}
                  className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors border-l border-slate-200 ${
                    orientation === 'landscape' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                  <Maximize2 className="w-3.5 h-3.5" /> Paisagem
                </button>
              </div>

              {/* Column picker */}
              <div className="relative">
                <button onClick={() => setShowColPicker(p => !p)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm border transition-colors ${
                    showColPicker ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  <Columns className="w-3.5 h-3.5" /> Colunas
                </button>
                {showColPicker && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 z-20 min-w-[220px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Selecionar e ordenar colunas</p>
                    {ALL_COLS.map(col => {
                      const active = cols.includes(col);
                      const idx = cols.indexOf(col);
                      return (
                        <div key={col} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-slate-50">
                          <input type="checkbox" checked={active} onChange={() => toggleCol(col)} className="rounded border-slate-300 accent-indigo-600" />
                          <span className="text-sm text-slate-700 flex-1">{COL_LABELS[col]}</span>
                          {active && (
                            <div className="flex gap-0.5">
                              <button onClick={() => moveCol(col, -1)} disabled={idx === 0} className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">↑</button>
                              <button onClick={() => moveCol(col, 1)} disabled={idx === cols.length - 1} className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">↓</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors">
                <Share2 className="w-4 h-4" /> Compartilhar
              </button>

              <button onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold shadow-sm transition-colors">
                <Download className="w-4 h-4" /> Baixar
              </button>

              <button onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors">
                <Printer className="w-4 h-4" /> Imprimir
              </button>
            </div>

            {/* Mobile Actions in Top Row */}
            <div className="flex md:hidden items-center gap-1.5">
              <button onClick={handleShare}
                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                title="Compartilhar">
                <Share2 className="w-5 h-5" />
              </button>
              <button onClick={handleDownload}
                className="p-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title="Baixar">
                <Download className="w-5 h-5" />
              </button>
              <button onClick={handlePrint}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                title="Imprimir">
                <Printer className="w-5 h-5" />
              </button>
              <button onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                title="Fechar">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Desktop Close Button */}
            <button onClick={onClose} className="hidden md:block p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Mobile Secondary Row for Controls (Orientation, Columns) */}
          <div className="flex md:hidden items-center justify-between gap-2 w-full pt-2 border-t border-slate-100">
            <div className="flex rounded-lg overflow-hidden border border-slate-200 shadow-sm">
              <button onClick={() => setOrientation('portrait')}
                className={`px-3 py-1.5 text-[11px] font-bold flex items-center gap-1 transition-colors ${
                  orientation === 'portrait' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'
                }`}>
                <MonitorSmartphone className="w-3.5 h-3.5" /> Retrato
              </button>
              <button onClick={() => setOrientation('landscape')}
                className={`px-3 py-1.5 text-[11px] font-bold flex items-center gap-1 transition-colors border-l border-slate-200 ${
                  orientation === 'landscape' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'
                }`}>
                <Maximize2 className="w-3.5 h-3.5" /> Paisagem
              </button>
            </div>

            <div className="relative">
              <button onClick={() => setShowColPicker(p => !p)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm border transition-colors ${
                  showColPicker ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'
                }`}>
                <Columns className="w-3.5 h-3.5" /> Colunas
              </button>
              {showColPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 z-20 min-w-[200px]">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Colunas</p>
                  {ALL_COLS.map(col => {
                    const active = cols.includes(col);
                    const idx = cols.indexOf(col);
                    return (
                      <div key={col} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50">
                        <input type="checkbox" checked={active} onChange={() => toggleCol(col)} className="rounded border-slate-300 accent-indigo-600" />
                        <span className="text-xs text-slate-700 flex-1">{COL_LABELS[col]}</span>
                        {active && (
                          <div className="flex gap-0.5">
                            <button onClick={() => moveCol(col, -1)} disabled={idx === 0} className="px-1 text-xs text-slate-400 disabled:opacity-30">↑</button>
                            <button onClick={() => moveCol(col, 1)} disabled={idx === cols.length - 1} className="px-1 text-xs text-slate-400 disabled:opacity-30">↓</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Preview ── */}
        <div className="flex-1 overflow-auto bg-slate-100 p-2 md:p-4">
          <div className="bg-white shadow-sm rounded-xl p-4 md:p-6 max-w-5xl mx-auto w-full">

            {/* Report header */}
            <h1 className="text-2xl font-black tracking-wide">RELATÓRIO</h1>
            <p className="text-slate-400 text-sm mb-4">Analítico</p>

            <div className="flex justify-between items-end mb-4 pb-3 border-b border-slate-200">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Igreja</p>
                <p className="text-sm font-semibold">{churchName || 'Todas'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Período de</p>
                <p className="text-sm font-semibold">{fmtDate(dataInicio)} a {fmtDate(dataFim)}</p>
              </div>
            </div>

            {/* Totals summary */}
            <div className="grid grid-cols-4 gap-4 mb-2">
              {[
                { l: 'Total Receita', v: `R$ ${fmt(totalReceita)}`, c: 'text-green-700' },
                { l: 'Total Despesa', v: `R$ ${fmt(totalDespesa)}`, c: 'text-red-700' },
                { l: 'Total Dízimos', v: `R$ ${fmt(totalDizimos)}`, c: '' },
                { l: 'Total Ofertas', v: `R$ ${fmt(totalOfertas)}`, c: '' },
              ].map(t => (
                <div key={t.l}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{t.l}</p>
                  <p className={`text-sm font-bold ${t.c}`}>{t.v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-4 mb-3">
              {[
                { l: 'Qtd. Receitas', v: qtdReceitas },
                { l: 'Qtd. Despesas', v: qtdDespesas },
                { l: 'Qtd. Dízimos',  v: qtdDizimos },
                { l: 'Qtd. Ofertas',  v: qtdOfertas },
              ].map(t => (
                <div key={t.l}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{t.l}</p>
                  <p className="text-sm font-bold text-slate-700">{t.v}</p>
                </div>
              ))}
            </div>
            <div className={`text-right text-base font-black mb-5 pt-2 border-t border-slate-200 ${liquido < 0 ? 'text-red-600' : 'text-slate-900'}`}>
              Líquido: R$ {fmt(liquido)}
            </div>

            {/* Table preview container */}
            <div className="w-full overflow-x-auto select-text">
              <table className="w-full text-xs border-collapse min-w-[650px]">
                <thead>
                  <tr>
                    {cols.map(col => {
                      const sortable = !UNSORTABLE.includes(col);
                      const active = sortCol === col;
                      return (
                        <th
                          key={col}
                          onClick={() => handleSortCol(col)}
                          className={`py-2 px-2 text-[10px] font-bold uppercase border-b-2 border-slate-800 whitespace-nowrap select-none ${
                            col === 'valor' ? 'text-right' : 'text-left'
                          } ${sortable ? 'cursor-pointer hover:text-indigo-600' : ''} ${
                            active ? 'text-indigo-600' : 'text-slate-500'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {COL_LABELS[col]}
                            {sortable && (
                              active
                                ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                                : <ArrowUpDown className="w-3 h-3 opacity-30" />
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                {groups.map(group => {
                  const sectionTotal = group.rows.reduce((s, r) => s + Number(r.valor), 0);
                  const isRec = group.tipo === 'RECEITA';
                  return (
                    <tbody key={group.key}>
                      <tr className="bg-slate-50">
                        <td colSpan={cols.length} className={`py-2 px-2 font-bold text-sm border-b-2 ${isRec ? 'text-green-800 border-green-200' : 'text-red-800 border-red-200'}`}>
                          {group.key}
                        </td>
                      </tr>
                      {group.rows.map(row => (
                        <Fragment key={row.id}>
                          <tr className="hover:bg-slate-50/60">
                            {cols.map(col => (
                              <td key={col} className={`py-1 px-2 border-b border-slate-100 ${
                                col === 'valor' ? 'text-right font-semibold' : ''
                              } ${col === 'obs' ? 'text-[10px] text-blue-600' : ''}`}>
                                {getCell(row, col)}
                              </td>
                            ))}
                          </tr>
                          {row.obs && !cols.includes('obs') && (() => {
                            const favIdx = cols.indexOf('favorecido');
                            return (
                              <tr>
                                {favIdx > 0 && <td colSpan={favIdx} className="border-b border-slate-100" />}
                                <td colSpan={favIdx >= 0 ? cols.length - favIdx : cols.length} className="py-0.5 px-2 text-[10px] text-blue-600 border-b border-slate-100">
                                  {row.obs}
                                </td>
                              </tr>
                            );
                          })()}
                        </Fragment>
                      ))}
                      <tr>
                        {cols.length > 1 && (
                          <td colSpan={cols.length - 1} className="py-1 px-2 text-[10px] text-right text-slate-400 italic border-t border-slate-200">
                            Subtotal {group.key}:
                          </td>
                        )}
                        <td className={`py-1 px-2 text-right text-[10px] font-bold border-t border-slate-200 ${isRec ? 'text-green-700' : 'text-red-700'}`}>
                          R$ {fmt(sectionTotal)}
                        </td>
                      </tr>
                      <tr><td colSpan={cols.length} className="h-2" /></tr>
                    </tbody>
                  );
                })}
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
