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

export type DizimistasFilters = {
  startDate: string;
  endDate: string;
  regionalIds: string[];
  regionalLabels: string[];
  churchIds: string[];
  churchLabels: string[];
  titleIds: string[];
  titleLabels: string[];
};

export type DizimistasScopeMember = {
  memberId: string;
  memberName: string;
  ecclesiasticalTitle: string;
  rol: number | null;
  churchId: string;
  churchName: string;
  regionalId: string;
  regionalName: string;
};

export type DizimistasEntry = {
  memberId: string;
  memberName: string;
  ecclesiasticalTitle: string;
  rol: number | null;
  churchId: string;
  churchName: string;
  regionalId: string;
  regionalName: string;
  dataLancamento: string;
  valor: number;
};

export type DizimistasReport = {
  filters: DizimistasFilters;
  generatedAt: string;
  generatedAtLabel: string;
  periodLabel: string;
  months: MonthColumn[];
  sections: RegionalSection[];
  grandTotals: Record<string, number>;
  grandTotal: number;
};

export type DizimistasSheetMeta = {
  kind: 'dizimistas';
  report: DizimistasReport;
  printHtml: string;
};

export type DizimistasSheetBuild = {
  name: string;
  color: string;
  cells: Record<string, AnalysisCell>;
  colWidths: Record<number, number>;
  rowHeights: Record<number, number>;
  frozenRows: number;
  frozenCols: number;
  meta: DizimistasSheetMeta;
};

type MonthColumn = {
  key: string;
  gridLabel: string;
  printLabel: string;
};

type MemberSection = {
  memberId: string;
  memberName: string;
  ecclesiasticalTitle: string;
  rol: number | null;
  monthly: Record<string, number>;
  total: number;
  lastDate?: string;
};

type ChurchSection = {
  churchId: string;
  churchName: string;
  members: MemberSection[];
  totals: Record<string, number>;
  total: number;
};

type RegionalSection = {
  regionalId: string;
  regionalName: string;
  churches: ChurchSection[];
  totals: Record<string, number>;
  total: number;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

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

function buildDisplayMonths(filters: DizimistasFilters): MonthColumn[] {
  const start = firstDayOfMonth(filters.startDate);
  const endDate = new Date(`${filters.endDate}T00:00:00`);
  const exclusiveEnd = endDate.getDate() === 1
    ? new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    : new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1);

  const months: MonthColumn[] = [];
  for (let cursor = new Date(start); cursor < exclusiveEnd; cursor = addMonths(cursor, 1)) {
    const key = toMonthKey(cursor);
    const date = monthStartFromKey(key);
    const monthShort = MONTH_ONLY_LABEL.format(date);
    const year2 = String(date.getFullYear()).slice(-2);
    months.push({
      key,
      gridLabel: key,
      printLabel: `${monthShort} de ${year2}`,
    });
  }
  return months;
}

function formatCurrency(value: number) {
  const absValue = Math.abs(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-${absValue}` : absValue;
}

function formatPeriod(filters: DizimistasFilters) {
  const start = new Date(`${filters.startDate}T00:00:00`);
  const end = new Date(`${filters.endDate}T00:00:00`);
  return `${PERIOD_LABEL.format(start)} a ${PERIOD_LABEL.format(end)}`;
}

function sortByName<T extends { memberName?: string; churchName?: string; regionalName?: string }>(
  items: T[],
  key: 'memberName' | 'churchName' | 'regionalName',
): T[] {
  return [...items].sort((a, b) =>
    String(a[key] || '').localeCompare(String(b[key] || ''), 'pt-BR', { numeric: true, sensitivity: 'base' }),
  );
}

// ─── Report builder ───────────────────────────────────────────────────────────

export function buildDizimistasReport(
  entries: DizimistasEntry[],
  filters: DizimistasFilters,
  nonTithers?: DizimistasScopeMember[],
): DizimistasReport {
  const months = buildDisplayMonths(filters);
  const validKeys = new Set(months.map((m) => m.key));

  const regionalMap = new Map<
    string,
    {
      regionalId: string;
      regionalName: string;
      churches: Map<
        string,
        {
          churchId: string;
          churchName: string;
          members: Map<string, MemberSection>;
        }
      >;
    }
  >();

  for (const entry of entries) {
    const monthKey = monthKeyFromDate(entry.dataLancamento);
    if (!validKeys.has(monthKey)) continue;

    let regional = regionalMap.get(entry.regionalId);
    if (!regional) {
      regional = { regionalId: entry.regionalId, regionalName: entry.regionalName, churches: new Map() };
      regionalMap.set(entry.regionalId, regional);
    }

    let church = regional.churches.get(entry.churchId);
    if (!church) {
      church = { churchId: entry.churchId, churchName: entry.churchName, members: new Map() };
      regional.churches.set(entry.churchId, church);
    }

    let member = church.members.get(entry.memberId);
    if (!member) {
      member = {
        memberId: entry.memberId,
        memberName: entry.memberName,
        ecclesiasticalTitle: entry.ecclesiasticalTitle,
        rol: entry.rol,
        monthly: {},
        total: 0,
        lastDate: undefined,
      };
      church.members.set(entry.memberId, member);
    }

    member.monthly[monthKey] = (member.monthly[monthKey] ?? 0) + entry.valor;
    member.total += entry.valor;
    if (!member.lastDate || entry.dataLancamento > member.lastDate) {
      member.lastDate = entry.dataLancamento;
    }
  }

  // Add non-tithers (members with no tithe entries) to the map
  if (nonTithers && nonTithers.length > 0) {
    for (const nt of nonTithers) {
      let regional = regionalMap.get(nt.regionalId);
      if (!regional) {
        regional = { regionalId: nt.regionalId, regionalName: nt.regionalName, churches: new Map() };
        regionalMap.set(nt.regionalId, regional);
      }
      let church = regional.churches.get(nt.churchId);
      if (!church) {
        church = { churchId: nt.churchId, churchName: nt.churchName, members: new Map() };
        regional.churches.set(nt.churchId, church);
      }
      if (!church.members.has(nt.memberId)) {
        church.members.set(nt.memberId, {
          memberId: nt.memberId,
          memberName: nt.memberName,
          ecclesiasticalTitle: nt.ecclesiasticalTitle,
          rol: nt.rol,
          monthly: {},
          total: 0,
        });
      }
    }
  }

  // Build sections with totals
  const sections: RegionalSection[] = sortByName(
    Array.from(regionalMap.values()).map((regional) => {
      const churches: ChurchSection[] = sortByName(
        Array.from(regional.churches.values()).map((church) => {
          const members: MemberSection[] = sortByName(
            Array.from(church.members.values()),
            'memberName',
          );

          const totals: Record<string, number> = {};
          let total = 0;
          for (const month of months) {
            totals[month.key] = members.reduce((sum, m) => sum + (m.monthly[month.key] ?? 0), 0);
            total += totals[month.key];
          }

          return { churchId: church.churchId, churchName: church.churchName, members, totals, total };
        }),
        'churchName',
      );

      const totals: Record<string, number> = {};
      let total = 0;
      for (const month of months) {
        totals[month.key] = churches.reduce((sum, c) => sum + (c.totals[month.key] ?? 0), 0);
        total += totals[month.key];
      }

      return { regionalId: regional.regionalId, regionalName: regional.regionalName, churches, totals, total };
    }),
    'regionalName',
  );

  const grandTotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const month of months) {
    grandTotals[month.key] = sections.reduce((sum, s) => sum + (s.totals[month.key] ?? 0), 0);
    grandTotal += grandTotals[month.key];
  }

  return {
    filters,
    generatedAt: new Date().toISOString(),
    generatedAtLabel: PRINTED_AT.format(new Date()),
    periodLabel: formatPeriod(filters),
    months,
    sections,
    grandTotals,
    grandTotal,
  };
}

// ─── Sheet builder ────────────────────────────────────────────────────────────

function columnToLetter(col: number): string {
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

export function buildDizimistasSheet(report: DizimistasReport, situacao = 'todos'): DizimistasSheetBuild {
  const cells: Record<string, AnalysisCell> = {};
  const rowHeights: Record<number, number> = { 0: 32, 1: 22, 3: 26 };

  const showMonthCols = situacao === 'inconstante' || situacao === 'todos_os_meses';
  const totalMonths = report.months.length;
  // Fixed cols: ROL | Nome | Cargo | Igreja | Situação | Com/Total | Falta | Data Últ.
  const fixedColCount = 8;
  const totalCols = showMonthCols ? fixedColCount + totalMonths : fixedColCount + 1;

  const colWidths: Record<number, number> = {
    0: 55,   // ROL
    1: 220,  // Nome
    2: 130,  // Cargo
    3: 180,  // Igreja
    4: 105,  // Situação
    5: 75,   // Com/Total
    6: 55,   // Falta
    7: 100,  // Data Últ.
  };
  if (showMonthCols) {
    report.months.forEach((_, idx) => { colWidths[fixedColCount + idx] = 60; });
  } else {
    colWidths[fixedColCount] = 230; // Meses sem dízimo
  }

  const monthShortLabel = (key: string) => {
    const [y, m] = key.split('-');
    const date = new Date(Number(y), Number(m) - 1, 1);
    const short = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
    return `${short}/${String(y).slice(-2)}`;
  };

  // Row 0: title
  setCell(cells, 0, 0, { value: 'RELATÓRIO DE DIZIMISTAS', bold: true, fontSize: 15, align: 'center', mergeColSpan: totalCols, bgColor: '#ffffff', textColor: '#111827' });
  for (let c = 1; c < totalCols; c++) setCell(cells, 0, c, { value: '', mergeHidden: true });

  // Row 1: meta
  const titleLabel = report.filters.titleLabels.length === 0 ? 'Todos os Títulos' : report.filters.titleLabels.join(', ');
  const half = Math.ceil(totalCols / 2);
  setCell(cells, 1, 0, { value: `TÍTULOS: ${titleLabel.toUpperCase()}`, bold: true, textColor: '#475569', mergeColSpan: half });
  for (let c = 1; c < half; c++) setCell(cells, 1, c, { value: '', mergeHidden: true });
  setCell(cells, 1, half, { value: `PERÍODO: ${report.periodLabel}`, bold: true, textColor: '#475569', mergeColSpan: totalCols - half - 1 });
  for (let c = half + 1; c < totalCols - 1; c++) setCell(cells, 1, c, { value: '', mergeHidden: true });
  setCell(cells, 1, totalCols - 1, { value: `IMPRESSO EM: ${report.generatedAtLabel}`, bold: true, align: 'right', textColor: '#475569' });

  // Row 3: column headers
  const hdr: Partial<AnalysisCell> = { bold: true, align: 'center', bgColor: '#f1f5f9', textColor: '#374151', borders: { top: true, bottom: true, left: true, right: true } };
  setCell(cells, 3, 0, { value: 'ROL', ...hdr });
  setCell(cells, 3, 1, { value: 'Nome', ...hdr, align: 'left' });
  setCell(cells, 3, 2, { value: 'Cargo', ...hdr });
  setCell(cells, 3, 3, { value: 'Igreja', ...hdr, align: 'left' });
  setCell(cells, 3, 4, { value: 'Situação', ...hdr });
  setCell(cells, 3, 5, { value: 'Com/Total', ...hdr });
  setCell(cells, 3, 6, { value: 'Falta', ...hdr });
  setCell(cells, 3, 7, { value: 'Data Últ.', ...hdr });
  if (showMonthCols) {
    report.months.forEach((m, idx) => {
      setCell(cells, 3, fixedColCount + idx, { value: monthShortLabel(m.key), ...hdr });
    });
  } else {
    setCell(cells, 3, fixedColCount, { value: 'Meses sem dízimo', ...hdr, align: 'left' });
  }

  let row = 4;
  const bord = { bottom: true, left: true, right: true };

  // Flat rows: regional → church → member
  for (const section of report.sections) {
    for (const church of section.churches) {
      for (const member of church.members) {
        const paidMonths = report.months.filter(m => (member.monthly[m.key] ?? 0) > 0).length;
        const falta = totalMonths - paidMonths;
        const sitLabel = paidMonths === 0 ? 'Nunca' : paidMonths >= totalMonths ? 'Todos os meses' : 'Inconstante';
        const sitBg = paidMonths === 0 ? '#fee2e2' : paidMonths >= totalMonths ? '#dcfce7' : '#fff3cd';
        const sitColor = paidMonths === 0 ? '#dc2626' : paidMonths >= totalMonths ? '#16a34a' : '#b45309';

        const lastDateDisplay = member.lastDate
          ? (() => { const [y, m, d] = member.lastDate.split('-'); return `${d}/${m}/${y}`; })()
          : '-';

        setCell(cells, row, 0, { value: member.rol != null ? String(member.rol) : '', align: 'center', borders: bord });
        setCell(cells, row, 1, { value: member.memberName, borders: bord });
        setCell(cells, row, 2, { value: member.ecclesiasticalTitle || '', align: 'center', textColor: '#475569', fontSize: 9, borders: bord });
        setCell(cells, row, 3, { value: church.churchName, textColor: '#334155', fontSize: 9, borders: bord });
        setCell(cells, row, 4, { value: sitLabel, align: 'center', bold: true, bgColor: sitBg, textColor: sitColor, borders: bord });
        setCell(cells, row, 5, { value: `${paidMonths}/${totalMonths}`, align: 'center', textColor: paidMonths === 0 ? '#dc2626' : paidMonths >= totalMonths ? '#16a34a' : '#b45309', borders: bord });
        setCell(cells, row, 6, { value: String(falta), align: 'center', bold: falta > 0, textColor: falta > 0 ? '#dc2626' : '#16a34a', borders: bord });
        setCell(cells, row, 7, { value: lastDateDisplay, align: 'center', textColor: '#64748b', borders: bord });

        if (showMonthCols) {
          report.months.forEach((m, idx) => {
            const paid = (member.monthly[m.key] ?? 0) > 0;
            setCell(cells, row, fixedColCount + idx, {
              value: paid ? '✓' : '✗',
              align: 'center',
              bold: true,
              bgColor: paid ? '#dcfce7' : '#fee2e2',
              textColor: paid ? '#16a34a' : '#dc2626',
              borders: bord,
            });
          });
        } else {
          const missing = report.months.filter(m => (member.monthly[m.key] ?? 0) === 0).map(m => monthShortLabel(m.key));
          setCell(cells, row, fixedColCount, {
            value: missing.length === 0 ? '-' : missing.join(', '),
            textColor: missing.length === 0 ? '#16a34a' : '#dc2626',
            fontSize: 9,
            borders: bord,
          });
        }
        row += 1;
      }
    }
  }

  const printHtml = buildDizimistasReportPrintHtml(report, situacao);
  const firstMonth = report.months[0]?.key ?? report.filters.startDate.slice(0, 7);
  const lastMonth = report.months[report.months.length - 1]?.key ?? report.filters.endDate.slice(0, 7);

  return {
    name: `Dizimistas ${firstMonth} a ${lastMonth}`,
    color: '#7c3aed',
    cells,
    colWidths,
    rowHeights,
    frozenRows: 4,
    frozenCols: 2,
    meta: {
      kind: 'dizimistas',
      report,
      printHtml,
    },
  };
}

// ─── Print HTML ───────────────────────────────────────────────────────────────

export function buildDizimistasReportPrintHtml(report: DizimistasReport, situacao = 'todos'): string {
  const regionalLabel = report.filters.regionalLabels.length === 0
    ? 'Todas as Regionais'
    : report.filters.regionalLabels.join(', ');
  const churchLabel = report.filters.churchLabels.length === 0
    ? 'Todas as Igrejas'
    : report.filters.churchLabels.join(', ');
  const titleLabel = report.filters.titleLabels.length === 0
    ? 'Todos os Titulos'
    : report.filters.titleLabels.join(', ');
  const situacaoLabel = situacao === 'todos_os_meses'
    ? 'Todos os meses'
    : situacao === 'inconstante'
      ? 'Esta inconstante'
      : situacao === 'dizimistas'
        ? 'Dizimistas'
        : situacao === 'nao_dizimistas'
          ? 'Nao dizimistas'
          : 'Todos';
  const showMonthCols = situacao === 'inconstante' || situacao === 'todos_os_meses';
  const totalMonths = report.months.length;
  const monthShortLabel = (key: string) => {
    const [year, month] = key.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    const short = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
    return `${short}/${String(year).slice(-2)}`;
  };
  const monthHeaders = showMonthCols
    ? report.months.map((m) => `<th>${escapeHtml(monthShortLabel(m.key))}</th>`).join('')
    : '<th class="missing-col">Meses sem dizimo</th>';

  const rowsHtml = report.sections
    .flatMap((section) => section.churches.flatMap((church) => church.members.map((member) => ({ church, member }))))
    .map(({ church, member }) => {
      const paidMonths = report.months.filter((m) => (member.monthly[m.key] ?? 0) > 0).length;
      const falta = totalMonths - paidMonths;
      const sitLabel = paidMonths === 0 ? 'Nunca' : paidMonths >= totalMonths ? 'Todos os meses' : 'Inconstante';
      const sitClass = paidMonths === 0 ? 'sit-never' : paidMonths >= totalMonths ? 'sit-full' : 'sit-partial';
      const lastDateDisplay = member.lastDate
        ? (() => {
            const [year, month, day] = member.lastDate.split('-');
            return `${day}/${month}/${year}`;
          })()
        : '-';
      const trailingCols = showMonthCols
        ? report.months
            .map((m) => {
              const paid = (member.monthly[m.key] ?? 0) > 0;
              return `<td class="month-flag ${paid ? 'paid' : 'missing'}">${paid ? '&#10003;' : '&#10007;'}</td>`;
            })
            .join('')
        : (() => {
            const missing = report.months.filter((m) => (member.monthly[m.key] ?? 0) === 0).map((m) => monthShortLabel(m.key));
            return `<td class="missing-list ${missing.length === 0 ? 'none' : 'has-missing'}">${escapeHtml(missing.length === 0 ? '-' : missing.join(', '))}</td>`;
          })();

      return `
        <tr>
          <td class="rol">${member.rol != null ? member.rol : ''}</td>
          <td class="name">${escapeHtml(member.memberName)}</td>
          <td class="title">${escapeHtml(member.ecclesiasticalTitle || '')}</td>
          <td class="church">${escapeHtml(church.churchName)}</td>
          <td class="situacao ${sitClass}">${escapeHtml(sitLabel)}</td>
          <td class="ratio ${sitClass}">${paidMonths}/${totalMonths}</td>
          <td class="faltas ${falta > 0 ? 'has-missing' : 'none'}">${falta}</td>
          <td class="last-date">${escapeHtml(lastDateDisplay)}</td>
          ${trailingCols}
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Relatorio de Dizimistas</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 14px; color: #111111; font-size: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @page { size: A4 landscape; margin: 10mm; }
      .print-header { border-bottom: 1px solid #d5dbe3; padding-bottom: 8px; margin-bottom: 10px; }
      .print-brand { text-align: center; font-size: 10px; margin-bottom: 4px; color: #4b5563; }
      .print-title { text-align: center; font-size: 14px; font-weight: 700; margin: 0 0 6px; text-transform: uppercase; }
      .print-meta { display: flex; justify-content: space-between; gap: 16px; font-size: 10px; font-weight: 700; color: #475569; }
      .print-meta span { white-space: nowrap; }
      .print-filters { margin-top: 6px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px 12px; font-size: 10px; color: #334155; }
      .print-filters span { min-width: 0; }
      .print-filters strong { color: #0f172a; }
      table { width: 100%; border-collapse: collapse; table-layout: auto; }
      th, td { border: 1px solid #334155; padding: 4px 6px; vertical-align: middle; }
      th { background: #f1f5f9; font-weight: 700; text-align: center; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      .rol { text-align: center; width: 52px; }
      .name { min-width: 190px; }
      .title { text-align: center; color: #475569; font-size: 9px; min-width: 110px; }
      .church { min-width: 150px; color: #334155; font-size: 9px; }
      .situacao, .ratio, .faltas, .last-date, .month-flag { text-align: center; }
      .last-date { color: #64748b; min-width: 76px; }
      .missing-col { min-width: 180px; text-align: left; }
      .missing-list { font-size: 9px; }
      .sit-never { background: #fee2e2; color: #dc2626; font-weight: 700; }
      .sit-full { background: #dcfce7; color: #16a34a; font-weight: 700; }
      .sit-partial { background: #fff3cd; color: #b45309; font-weight: 700; }
      .has-missing { color: #dc2626; font-weight: 700; }
      .none { color: #16a34a; }
      .paid { background: #dcfce7; color: #16a34a; font-weight: 700; }
      .missing { background: #fee2e2; color: #dc2626; font-weight: 700; }
    </style>
  </head>
  <body>
    <div class="print-header">
      <div class="print-brand">Sistema MRM - Gestao Eclesiastica</div>
      <h1 class="print-title">Relatorio de Dizimistas</h1>
      <div class="print-meta">
        <span>PERIODO: ${escapeHtml(report.periodLabel)}</span>
        <span>IMPRESSO EM: ${escapeHtml(report.generatedAtLabel)}</span>
      </div>
      <div class="print-filters">
        <span><strong>REGIONAL:</strong> ${escapeHtml(regionalLabel.toUpperCase())}</span>
        <span><strong>IGREJAS:</strong> ${escapeHtml(churchLabel.toUpperCase())}</span>
        <span><strong>TITULOS:</strong> ${escapeHtml(titleLabel.toUpperCase())}</span>
        <span><strong>SITUACAO:</strong> ${escapeHtml(situacaoLabel.toUpperCase())}</span>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:52px">ROL</th>
          <th>Nome</th>
          <th>Cargo</th>
          <th>Igreja</th>
          <th>Situacao</th>
          <th>Com/Total</th>
          <th>Falta</th>
          <th>Data Ult.</th>
          ${monthHeaders}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
