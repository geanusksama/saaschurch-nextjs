type AnalysisCell = {
  value: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  bgColor?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  numberFormat?: 'general' | 'number' | 'currency' | 'accounting' | 'shortdate' | 'fulldate' | 'time' | 'percent' | 'fraction' | 'scientific' | 'text';
  borders?: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean };
  wrapText?: boolean;
  mergeColSpan?: number;
  mergeRowSpan?: number;
  mergeHidden?: boolean;
};

export type FieldAnalysisFilters = {
  startDate: string;
  endDate: string;
  /** @deprecated use regionalIds */
  regionalId: string;
  regionalIds: string[];
  regionalLabel: string;
};

export type FieldAnalysisEntry = {
  churchId: string;
  churchName: string;
  regionalId: string;
  regionalName: string;
  dataLancamento: string;
  tipo: string | null;
  valor: number;
};

export type FieldAnalysisScopeChurch = {
  churchId: string;
  churchName: string;
  regionalId: string;
  regionalName: string;
};

type FieldMetric = {
  income: number;
  expense: number;
  net: number;
  diff: number;
};

type MonthColumn = {
  key: string;
  gridLabel: string;
  printLabel: string;
};

type ChurchSection = {
  churchId: string;
  churchName: string;
  metrics: Record<string, FieldMetric>;
};

type RegionalSection = {
  regionalId: string;
  regionalName: string;
  churches: ChurchSection[];
  totals: Record<string, FieldMetric>;
};

export type FieldAnalysisReport = {
  filters: FieldAnalysisFilters;
  generatedAt: string;
  generatedAtLabel: string;
  periodLabel: string;
  months: MonthColumn[];
  sections: RegionalSection[];
  grandTotals: Record<string, FieldMetric>;
};

export type FieldAnalysisSheetMeta = {
  kind: 'field-analysis';
  report: FieldAnalysisReport;
  printHtml: string;
};

export type FieldAnalysisSheetBuild = {
  name: string;
  color: string;
  cells: Record<string, AnalysisCell>;
  colWidths: Record<number, number>;
  rowHeights: Record<number, number>;
  frozenRows: number;
  frozenCols: number;
  meta: FieldAnalysisSheetMeta;
};

type AggregatedValue = {
  income: number;
  expense: number;
  net: number;
};

const MONTH_ONLY_LABEL = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const PERIOD_LABEL = new Intl.DateTimeFormat('pt-BR');
const PRINTED_AT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function firstDayOfMonth(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function toMonthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function monthKeyFromDate(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);
  return toMonthKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

function monthStartFromKey(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function formatGridMonth(key: string) {
  return key;
}

function formatPrintMonth(key: string) {
  const date = monthStartFromKey(key);
  const month = MONTH_ONLY_LABEL.format(date);
  const year = String(date.getFullYear()).slice(-2);
  return `${month} de ${year}`;
}

function formatCurrency(value: number, withSign = false) {
  const absValue = Math.abs(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (!withSign) return value < 0 ? `-${absValue}` : absValue;
  if (value > 0) return `+${absValue}`;
  if (value < 0) return `-${absValue}`;
  return absValue;
}

function formatPeriod(filters: FieldAnalysisFilters) {
  const start = new Date(`${filters.startDate}T00:00:00`);
  const end = new Date(`${filters.endDate}T00:00:00`);
  return `${PERIOD_LABEL.format(start)} a ${PERIOD_LABEL.format(end)}`;
}

function buildDisplayMonths(filters: FieldAnalysisFilters) {
  const start = firstDayOfMonth(filters.startDate);
  const endDate = new Date(`${filters.endDate}T00:00:00`);
  const exclusiveEnd = endDate.getDate() === 1
    ? new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    : new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1);

  const months: MonthColumn[] = [];
  for (let cursor = new Date(start); cursor < exclusiveEnd; cursor = addMonths(cursor, 1)) {
    const key = toMonthKey(cursor);
    months.push({
      key,
      gridLabel: formatGridMonth(key),
      printLabel: formatPrintMonth(key),
    });
  }
  return months;
}

function sortByName<T extends { name?: string; churchName?: string; regionalName?: string }>(items: T[], key: 'name' | 'churchName' | 'regionalName') {
  return [...items].sort((left, right) => String(left[key] || '').localeCompare(String(right[key] || ''), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  }));
}

function toMetric(value?: AggregatedValue, previousNet = 0): FieldMetric {
  const income = value?.income ?? 0;
  const expense = value?.expense ?? 0;
  const net = value?.net ?? 0;
  return {
    income,
    expense,
    net,
    diff: net - previousNet,
  };
}

function aggregateEntry(metric: AggregatedValue, entry: FieldAnalysisEntry) {
  const rawValue = Number(entry.valor || 0);
  const normalizedType = String(entry.tipo || '').toUpperCase();
  if (normalizedType === 'DESPESA') {
    metric.expense += Math.abs(rawValue);
    metric.net -= Math.abs(rawValue);
    return;
  }
  if (normalizedType === 'RECEITA') {
    metric.income += Math.abs(rawValue);
    metric.net += Math.abs(rawValue);
    return;
  }
  if (rawValue >= 0) {
    metric.income += rawValue;
    metric.net += rawValue;
    return;
  }
  metric.expense += Math.abs(rawValue);
  metric.net += rawValue;
}

export function buildFieldAnalysisReport(entries: FieldAnalysisEntry[], filters: FieldAnalysisFilters, scopeChurches: FieldAnalysisScopeChurch[]): FieldAnalysisReport {
  const months = buildDisplayMonths(filters);
  const previousMonthKey = toMonthKey(addMonths(firstDayOfMonth(filters.startDate), -1));
  const allNeededMonths = [previousMonthKey, ...months.map((month) => month.key)];

  const regionalMap = new Map<string, { regionalId: string; regionalName: string; churches: Map<string, { churchId: string; churchName: string; monthly: Map<string, AggregatedValue> }> }>();

  for (const church of scopeChurches) {
    const regional = regionalMap.get(church.regionalId) ?? {
      regionalId: church.regionalId,
      regionalName: church.regionalName,
      churches: new Map(),
    };
    regional.churches.set(church.churchId, {
      churchId: church.churchId,
      churchName: church.churchName,
      monthly: new Map<string, AggregatedValue>(),
    });
    regionalMap.set(church.regionalId, regional);
  }

  for (const entry of entries) {
    const monthKey = monthKeyFromDate(entry.dataLancamento);
    if (!allNeededMonths.includes(monthKey)) continue;

    const regional = regionalMap.get(entry.regionalId) ?? {
      regionalId: entry.regionalId,
      regionalName: entry.regionalName,
      churches: new Map(),
    };

    const church = regional.churches.get(entry.churchId) ?? {
      churchId: entry.churchId,
      churchName: entry.churchName,
      monthly: new Map<string, AggregatedValue>(),
    };

    const monthly = church.monthly.get(monthKey) ?? { income: 0, expense: 0, net: 0 };
    aggregateEntry(monthly, entry);
    church.monthly.set(monthKey, monthly);
    regional.churches.set(entry.churchId, church);
    regionalMap.set(entry.regionalId, regional);
  }

  const sections = sortByName(
    Array.from(regionalMap.values()).map((regional) => {
      const churches = sortByName(
        Array.from(regional.churches.values()).map((church) => {
          const metrics: Record<string, FieldMetric> = {};
          let previousNet = church.monthly.get(previousMonthKey)?.net ?? 0;
          for (const month of months) {
            const metric = toMetric(church.monthly.get(month.key), previousNet);
            metrics[month.key] = metric;
            previousNet = metric.net;
          }
          return {
            churchId: church.churchId,
            churchName: church.churchName,
            metrics,
          };
        }),
        'churchName'
      );

      const totals: Record<string, FieldMetric> = {};
      let previousNet = Array.from(regional.churches.values()).reduce((sum, church) => sum + (church.monthly.get(previousMonthKey)?.net ?? 0), 0);
      for (const month of months) {
        const aggregate: AggregatedValue = { income: 0, expense: 0, net: 0 };
        for (const church of regional.churches.values()) {
          const value = church.monthly.get(month.key);
          if (!value) continue;
          aggregate.income += value.income;
          aggregate.expense += value.expense;
          aggregate.net += value.net;
        }
        totals[month.key] = toMetric(aggregate, previousNet);
        previousNet = aggregate.net;
      }

      return {
        regionalId: regional.regionalId,
        regionalName: regional.regionalName,
        churches,
        totals,
      };
    }),
    'regionalName'
  );

  const grandTotals: Record<string, FieldMetric> = {};
  let previousNet = sections.reduce((sum, section) => sum + (Array.from(regionalMap.get(section.regionalId)?.churches.values() || []).reduce((inner, church) => inner + (church.monthly.get(previousMonthKey)?.net ?? 0), 0)), 0);
  for (const month of months) {
    const aggregate: AggregatedValue = { income: 0, expense: 0, net: 0 };
    for (const section of sections) {
      aggregate.income += section.totals[month.key]?.income ?? 0;
      aggregate.expense += section.totals[month.key]?.expense ?? 0;
      aggregate.net += section.totals[month.key]?.net ?? 0;
    }
    grandTotals[month.key] = toMetric(aggregate, previousNet);
    previousNet = aggregate.net;
  }

  return {
    filters,
    generatedAt: new Date().toISOString(),
    generatedAtLabel: PRINTED_AT.format(new Date()),
    periodLabel: formatPeriod(filters),
    months,
    sections,
    grandTotals,
  };
}

function columnToLetter(col: number) {
  let output = '';
  let value = col + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

function setCell(cells: Record<string, AnalysisCell>, row: number, col: number, cell: AnalysisCell) {
  cells[`${columnToLetter(col)}${row + 1}`] = cell;
}

export function buildFieldAnalysisSheet(report: FieldAnalysisReport): FieldAnalysisSheetBuild {
  const cells: Record<string, AnalysisCell> = {};
  const colWidths: Record<number, number> = { 0: 200 };
  const rowHeights: Record<number, number> = {
    0: 30,
    1: 24,
    2: 24,
    4: 26,
    5: 24,
  };

  report.months.forEach((_, idx) => {
    const startCol = 1 + idx * 3;
    colWidths[startCol] = 100;     // Bruto
    colWidths[startCol + 1] = 100; // Liquido
    colWidths[startCol + 2] = 105; // Diferenca
  });

  const titleSpan = Math.max(1, report.months.length * 3);
  setCell(cells, 0, 0, {
    value: 'RELATORIO FINANCEIRO - RESUMO DO CAMPO',
    bold: true,
    fontSize: 16,
    align: 'center',
    mergeColSpan: titleSpan + 1,
    bgColor: '#ffffff',
    textColor: '#111827',
  });
  for (let col = 1; col <= titleSpan; col++) {
    setCell(cells, 0, col, { value: '', mergeHidden: true });
  }

  setCell(cells, 1, 0, { value: `REGIONAL: ${report.filters.regionalLabel.toUpperCase()}`, bold: true, textColor: '#475569' });
  setCell(cells, 1, 2, { value: `PERIODO: ${report.periodLabel}`, bold: true, textColor: '#475569', mergeColSpan: Math.max(2, titleSpan - 3) });
  for (let col = 3; col < titleSpan; col++) setCell(cells, 1, col, { value: '', mergeHidden: true });
  setCell(cells, 1, titleSpan, { value: `IMPRESSO EM: ${report.generatedAtLabel}`, bold: true, align: 'right', textColor: '#475569' });

  setCell(cells, 4, 0, {
    value: 'Igreja',
    bold: true,
    bgColor: '#f1f5f9',
    borders: { top: true, bottom: true, left: true, right: true },
  });

  report.months.forEach((month, idx) => {
    const startCol = 1 + idx * 3;
    setCell(cells, 4, startCol, {
      value: month.gridLabel,
      bold: true,
      align: 'center',
      bgColor: '#f1f5f9',
      borders: { top: true, bottom: true, left: true, right: true },
      mergeColSpan: 3,
    });
    setCell(cells, 4, startCol + 1, { value: '', mergeHidden: true });
    setCell(cells, 4, startCol + 2, { value: '', mergeHidden: true });
    setCell(cells, 5, startCol, {
      value: 'Bruto',
      bold: true,
      align: 'center',
      bgColor: '#f8fafc',
      borders: { bottom: true, left: true, right: true },
    });
    setCell(cells, 5, startCol + 1, {
      value: 'Liquido',
      bold: true,
      align: 'center',
      bgColor: '#f8fafc',
      borders: { bottom: true, left: true, right: true },
    });
    setCell(cells, 5, startCol + 2, {
      value: 'Diferenca',
      bold: true,
      align: 'center',
      bgColor: '#f8fafc',
      borders: { bottom: true, left: true, right: true },
    });
  });

  let row = 6;
  for (const section of report.sections) {
    rowHeights[row] = 24;
    setCell(cells, row, 0, {
      value: section.regionalName.toUpperCase(),
      bold: true,
      bgColor: '#e2e8f0',
      borders: { top: true, bottom: true, left: true, right: true },
      mergeColSpan: titleSpan + 1,
    });
    for (let col = 1; col <= titleSpan; col++) setCell(cells, row, col, { value: '', mergeHidden: true });
    row += 1;

    for (const church of section.churches) {
      setCell(cells, row, 0, {
        value: church.churchName,
        borders: { left: true, right: true, bottom: true },
      });
      report.months.forEach((month, idx) => {
        const metric = church.metrics[month.key];
        const startCol = 1 + idx * 3;
        setCell(cells, row, startCol, {
          value: formatCurrency(metric.income),
          align: 'right',
          textColor: '#475569',
          borders: { left: true, right: true, bottom: true },
        });
        setCell(cells, row, startCol + 1, {
          value: formatCurrency(metric.net),
          align: 'right',
          textColor: metric.net < 0 ? '#dc2626' : '#2563eb',
          borders: { left: true, right: true, bottom: true },
        });
        setCell(cells, row, startCol + 2, {
          value: formatCurrency(metric.diff, true),
          align: 'right',
          textColor: metric.diff < 0 ? '#dc2626' : '#16a34a',
          borders: { left: true, right: true, bottom: true },
        });
      });
      row += 1;
    }

    setCell(cells, row, 0, {
      value: `TOTAL ${section.regionalName}`,
      bold: true,
      bgColor: '#f8fafc',
      borders: { top: true, bottom: true, left: true, right: true },
    });
    report.months.forEach((month, idx) => {
      const metric = section.totals[month.key];
      const startCol = 1 + idx * 3;
      setCell(cells, row, startCol, {
        value: formatCurrency(metric.income),
        bold: true,
        align: 'right',
        textColor: '#475569',
        bgColor: '#f8fafc',
        borders: { top: true, bottom: true, left: true, right: true },
      });
      setCell(cells, row, startCol + 1, {
        value: formatCurrency(metric.net),
        bold: true,
        align: 'right',
        textColor: metric.net < 0 ? '#dc2626' : '#2563eb',
        bgColor: '#f8fafc',
        borders: { top: true, bottom: true, left: true, right: true },
      });
      setCell(cells, row, startCol + 2, {
        value: formatCurrency(metric.diff, true),
        bold: true,
        align: 'right',
        textColor: metric.diff < 0 ? '#dc2626' : '#16a34a',
        bgColor: '#f8fafc',
        borders: { top: true, bottom: true, left: true, right: true },
      });
    });
    row += 2;
  }

  setCell(cells, row, 0, {
    value: 'TOTAL GERAL',
    bold: true,
    bgColor: '#e2e8f0',
    borders: { top: true, bottom: true, left: true, right: true },
  });
  report.months.forEach((month, idx) => {
    const metric = report.grandTotals[month.key];
    const startCol = 1 + idx * 3;
    setCell(cells, row, startCol, {
      value: formatCurrency(metric.income),
      bold: true,
      align: 'right',
      textColor: '#475569',
      bgColor: '#e2e8f0',
      borders: { top: true, bottom: true, left: true, right: true },
    });
    setCell(cells, row, startCol + 1, {
      value: formatCurrency(metric.net),
      bold: true,
      align: 'right',
      textColor: metric.net < 0 ? '#dc2626' : '#2563eb',
      bgColor: '#e2e8f0',
      borders: { top: true, bottom: true, left: true, right: true },
    });
    setCell(cells, row, startCol + 2, {
      value: formatCurrency(metric.diff, true),
      bold: true,
      align: 'right',
      textColor: metric.diff < 0 ? '#dc2626' : '#16a34a',
      bgColor: '#e2e8f0',
      borders: { top: true, bottom: true, left: true, right: true },
    });
  });

  const printHtml = buildFieldAnalysisPrintHtml(report);
  const firstMonth = report.months[0]?.key ?? report.filters.startDate.slice(0, 7);
  const lastMonth = report.months[report.months.length - 1]?.key ?? report.filters.endDate.slice(0, 7);

  return {
    name: `Analise Campo ${firstMonth} a ${lastMonth}`,
    color: '#0f766e',
    cells,
    colWidths,
    rowHeights,
    frozenRows: 6,
    frozenCols: 1,
    meta: {
      kind: 'field-analysis',
      report,
      printHtml,
    },
  };
}

export function buildFieldAnalysisPrintHtml(report: FieldAnalysisReport) {
  const monthHeaders = report.months.map((month) => `
      <th colspan="3">
        <div class="month-title">${month.printLabel}</div>
        <div class="month-subtitle">Bruto | Liquido | Diferenca</div>
      </th>
    `).join('');

  const renderMetricCells = (metric: FieldMetric) => `
    <td class="value gross">${formatCurrency(metric.income)}</td>
    <td class="value ${metric.net < 0 ? 'negative' : 'liquid'}">${formatCurrency(metric.net)}</td>
    <td class="value ${metric.diff < 0 ? 'negative' : 'positive'}">${formatCurrency(metric.diff, true)}</td>
  `;

  const sectionsHtml = report.sections.map((section) => {
    const churchRows = section.churches.map((church) => `
      <tr>
        <td class="church-name">${escapeHtml(church.churchName)}</td>
        ${report.months.map((month) => renderMetricCells(church.metrics[month.key])).join('')}
      </tr>
    `).join('');

    const totalRow = `
      <tr class="total-row">
        <td>TOTAL ${escapeHtml(section.regionalName)}</td>
        ${report.months.map((month) => renderMetricCells(section.totals[month.key])).join('')}
      </tr>
    `;

    return `
      <tr class="regional-row"><td colspan="${1 + report.months.length * 3}">${escapeHtml(section.regionalName.toUpperCase())}</td></tr>
      ${churchRows}
      ${totalRow}
    `;
  }).join('');

  const grandTotalRow = `
    <tr class="grand-total-row">
      <td>TOTAL GERAL</td>
      ${report.months.map((month) => renderMetricCells(report.grandTotals[month.key])).join('')}
    </tr>
  `;

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Resumo do Campo</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; margin: 14px; color: #111111; font-size: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        @page { size: A4 landscape; margin: 10mm; }
        .print-header { border-bottom: 1px solid #d5dbe3; padding-bottom: 8px; margin-bottom: 10px; }
        .print-brand { text-align: center; font-size: 10px; margin-bottom: 4px; color: #4b5563; }
        .print-title { text-align: center; font-size: 14px; font-weight: 700; margin: 0 0 6px; text-transform: uppercase; }
        .print-meta { display: flex; justify-content: space-between; gap: 16px; font-size: 10px; font-weight: 700; color: #475569; }
        .print-meta span { white-space: nowrap; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #cfd6df; padding: 5px 6px; }
        th { background: #f8fafc; font-weight: 700; text-align: center; }
        .month-title { font-size: 12px; margin-bottom: 2px; }
        .month-subtitle { font-size: 9px; color: #64748b; font-weight: 400; }
        .regional-row td { background: #e2e8f0; font-weight: 700; text-transform: uppercase; }
        .church-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .value { text-align: right; font-weight: 700; }
        .gross { color: #475569; }
        .liquid { color: #2563eb; }
        .positive { color: #16a34a; }
        .negative { color: #dc2626; }
        .total-row td { background: #f8fafc; font-weight: 700; }
        .grand-total-row td { background: #e2e8f0; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="print-header">
        <div class="print-brand">Sistema MRM - Gestao Eclesiastica</div>
        <h1 class="print-title">Relatorio Financeiro - Resumo do Campo</h1>
        <div class="print-meta">
          <span>REGIONAL: ${escapeHtml(report.filters.regionalLabel.toUpperCase())}</span>
          <span>PERIODO: ${escapeHtml(report.periodLabel)}</span>
          <span>IMPRESSO EM: ${escapeHtml(report.generatedAtLabel)}</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 22%;">Igreja</th>
            ${monthHeaders}
          </tr>
        </thead>
        <tbody>
          ${sectionsHtml}
          ${grandTotalRow}
        </tbody>
      </table>
    </body>
  </html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}