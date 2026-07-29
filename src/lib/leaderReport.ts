/**
 * Relatórios de dirigente — montagem do HTML usado tanto na pré-visualização
 * dentro do modal quanto na janela de impressão.
 *
 * São dois layouts sobre a mesma fonte de dados (`/churches/[id]/leader-report`):
 *  - `change`  : card A4 paisagem de UMA troca, no formato das apresentações da
 *                regional (fotos à esquerda, dados ao centro, motivo à direita);
 *  - `history` : tabela com todas as movimentações da igreja.
 *
 * Os campos e as imagens são escolhidos pelo usuário no modal — aqui só se
 * respeita a seleção recebida.
 */

export type LeaderReportKind = 'change' | 'history';

export interface LeaderReportMember {
  id?: string;
  fullName?: string | null;
  rol?: number | string | null;
  ecclesiasticalTitle?: string | null;
  photoUrl?: string | null;
  spouseName?: string | null;
  phone?: string | null;
  mobile?: string | null;
}

export interface LeaderReportRecord {
  id: string;
  entryDate?: string | null;
  exitDate?: string | null;
  previousExitDate?: string | null;
  indicatedBy?: string | null;
  changeReason?: string | null;
  notes?: string | null;
  currentCash?: number | null;
  averageIncome?: number | null;
  averageExpense?: number | null;
  maxIncome?: number | null;
  totalMembers?: number | null;
  totalWorkers?: number | null;
  function?: { name?: string | null } | null;
  previousLeaderMember?: LeaderReportMember | null;
  newLeaderMember?: LeaderReportMember | null;
}

export interface LeaderReportChurch {
  name?: string | null;
  code?: string | null;
  plateName?: string | null;
  hasOwnTemple?: boolean | null;
  cnpj?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  foundedAt?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZipcode?: string | null;
  regional?: { name?: string | null; code?: string | null; campo?: { name?: string | null } | null } | null;
  headquarters?: { churchName?: string | null } | null;
}

export interface LeaderReportData {
  church: LeaderReportChurch;
  records: LeaderReportRecord[];
  photos: { id: string; photoUrl?: string | null; fieldName?: string | null }[];
  regionalChurches: { id: string; name: string; code?: string | null }[];
  counts?: { members?: number | null; workers?: number | null };
  generatedAt?: string | null;
  generatedBy?: string | null;
}

/** Blocos de dados que o usuário liga/desliga no card de troca. */
export type ChangeFieldKey =
  | 'codigoRegional' | 'entradaSaida' | 'caixaAtual' | 'maiorEntrada'
  | 'totalMembros' | 'templo' | 'obreirosSugeridos' | 'rolDirigente'
  | 'datasMandato' | 'indicante' | 'dirigenteAnterior' | 'motivo'
  | 'congregacoesRegional' | 'endereco' | 'documento' | 'contato'
  | 'fundacao' | 'igrejaSede' | 'observacoes';

export const CHANGE_FIELDS: { key: ChangeFieldKey; label: string; group: 'card' | 'igreja' }[] = [
  { key: 'codigoRegional', label: 'Código e regional', group: 'card' },
  { key: 'entradaSaida', label: 'Entrada e saída (R$)', group: 'card' },
  { key: 'totalMembros', label: 'Total de membros e obreiros', group: 'card' },
  { key: 'templo', label: 'Templo alugado / próprio', group: 'card' },
  { key: 'obreirosSugeridos', label: 'Obreiros sugeridos (novo dirigente)', group: 'card' },
  { key: 'indicante', label: 'Indicante', group: 'card' },
  { key: 'dirigenteAnterior', label: 'Dirigente anterior', group: 'card' },
  { key: 'motivo', label: 'Motivo da troca', group: 'card' },
  { key: 'congregacoesRegional', label: 'Congregações da regional', group: 'card' },
  { key: 'caixaAtual', label: 'Caixa atual', group: 'igreja' },
  { key: 'maiorEntrada', label: 'Maior valor de entrada', group: 'igreja' },
  { key: 'rolDirigente', label: 'ROL e função do dirigente', group: 'igreja' },
  { key: 'datasMandato', label: 'Datas de entrada e saída', group: 'igreja' },
  { key: 'endereco', label: 'Endereço da igreja', group: 'igreja' },
  { key: 'documento', label: 'CNPJ / documento', group: 'igreja' },
  { key: 'contato', label: 'Telefone e e-mail', group: 'igreja' },
  { key: 'fundacao', label: 'Data de fundação', group: 'igreja' },
  { key: 'igrejaSede', label: 'Igreja sede', group: 'igreja' },
  { key: 'observacoes', label: 'Observações da movimentação', group: 'igreja' },
];

/** Seleção que reproduz exatamente o card usado hoje na regional. */
export const DEFAULT_CHANGE_FIELDS: ChangeFieldKey[] = [
  'codigoRegional', 'entradaSaida', 'totalMembros', 'templo',
  'obreirosSugeridos', 'indicante', 'dirigenteAnterior', 'motivo', 'congregacoesRegional',
];

export type HistoryColumnKey =
  | 'newLeader' | 'rol' | 'functionName' | 'entryDate' | 'exitDate' | 'duration'
  | 'previousLeader' | 'previousExitDate' | 'indicatedBy' | 'changeReason'
  | 'totalMembers' | 'totalWorkers' | 'currentCash' | 'averageIncome' | 'averageExpense' | 'maxIncome';

export const HISTORY_COLUMNS: { key: HistoryColumnKey; label: string; align?: 'right' }[] = [
  { key: 'newLeader', label: 'Dirigente' },
  { key: 'rol', label: 'ROL' },
  { key: 'functionName', label: 'Função' },
  { key: 'entryDate', label: 'Entrada' },
  { key: 'exitDate', label: 'Saída' },
  { key: 'duration', label: 'Tempo' },
  { key: 'previousLeader', label: 'Anterior' },
  { key: 'previousExitDate', label: 'Saída do anterior' },
  { key: 'indicatedBy', label: 'Indicante' },
  { key: 'changeReason', label: 'Motivo' },
  { key: 'totalMembers', label: 'Membros', align: 'right' },
  { key: 'totalWorkers', label: 'Obreiros', align: 'right' },
  { key: 'currentCash', label: 'Caixa', align: 'right' },
  { key: 'averageIncome', label: 'Méd. entrada', align: 'right' },
  { key: 'averageExpense', label: 'Méd. saída', align: 'right' },
  { key: 'maxIncome', label: 'Maior entrada', align: 'right' },
];

export const DEFAULT_HISTORY_COLUMNS: HistoryColumnKey[] = [
  'newLeader', 'rol', 'functionName', 'entryDate', 'exitDate', 'duration', 'indicatedBy', 'changeReason',
];

export interface LeaderReportOptions {
  kind: LeaderReportKind;
  /** Movimentação exibida no card (obrigatório quando kind === 'change'). */
  recordId?: string;
  fields: ChangeFieldKey[];
  columns: HistoryColumnKey[];
  /** URLs já resolvidas das imagens marcadas, na ordem em que devem aparecer. */
  images: string[];
  title?: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

export function esc(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function dateLabel(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** "2 anos e 3 meses" — tempo entre entrada e saída (ou até hoje). */
function durationLabel(from?: string | null, to?: string | null) {
  if (!from) return '—';
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} ano${years > 1 ? 's' : ''}`);
  if (rest) parts.push(`${rest} ${rest > 1 ? 'meses' : 'mês'}`);
  if (!parts.length) parts.push('menos de 1 mês');
  return parts.join(' e ') + (to ? '' : ' (em curso)');
}

/**
 * "PR. FULANO" / "CONGREGADO FULANO" — título eclesiástico + nome.
 * O ponto só entra em abreviação (PR, EV, DC); título por extenso levava a
 * saídas esquisitas como "CONGREGADO. JOAO BATISTA".
 */
export function leaderLabel(member?: LeaderReportMember | null) {
  if (!member?.fullName) return '—';
  const title = (member.ecclesiasticalTitle || '').trim();
  if (!title) return member.fullName.toUpperCase();
  const separator = title.length <= 3 && !title.endsWith('.') ? '. ' : ' ';
  return `${title}${separator}${member.fullName}`.toUpperCase();
}

function addressLine(church: LeaderReportChurch) {
  const street = [church.addressStreet, church.addressNumber].filter(Boolean).join(', ');
  return [street, church.addressNeighborhood, [church.addressCity, church.addressState].filter(Boolean).join('/')]
    .filter(Boolean)
    .join(' · ');
}

// ─── layout: card de troca ──────────────────────────────────────────────────

function renderChangeCard(data: LeaderReportData, options: LeaderReportOptions) {
  const record = data.records.find((item) => item.id === options.recordId) || data.records[0];
  if (!record) return '<p class="empty">Nenhuma troca de dirigente registrada nesta igreja.</p>';

  const church = data.church || {};
  const regional = church.regional || {};
  const has = (key: ChangeFieldKey) => options.fields.includes(key);
  const members = record.totalMembers ?? data.counts?.members ?? null;
  const workers = record.totalWorkers ?? data.counts?.workers ?? null;
  const ownTemple = Boolean(church.hasOwnTemple);
  const frames = options.images.length ? options.images : [];

  const centerBlocks: string[] = [];
  if (has('codigoRegional')) {
    centerBlocks.push(`<p class="line">Código: <b>${esc(church.code) || '—'}</b> &nbsp;&nbsp; Regional: <b>${esc(regional.code || regional.name) || '—'}</b></p>`);
  }
  if (has('entradaSaida')) {
    centerBlocks.push(`<p class="line">Entrada: <b>${money(record.averageIncome)}</b></p>`);
    centerBlocks.push(`<p class="line">Saída: <b>${money(record.averageExpense)}</b></p>`);
  }
  if (has('caixaAtual')) centerBlocks.push(`<p class="line">Caixa atual: <b>${money(record.currentCash)}</b></p>`);
  if (has('maiorEntrada')) centerBlocks.push(`<p class="line">Maior entrada: <b>${money(record.maxIncome)}</b></p>`);
  if (has('documento')) centerBlocks.push(`<p class="line">${esc(church.documentType || 'CNPJ')}: <b>${esc(church.documentNumber || church.cnpj) || '—'}</b></p>`);
  if (has('endereco')) centerBlocks.push(`<p class="line">Endereço: <b>${esc(addressLine(church)) || '—'}</b></p>`);
  if (has('contato')) centerBlocks.push(`<p class="line">Contato: <b>${esc(church.phone || church.whatsapp) || '—'}</b>${church.email ? ` · <b>${esc(church.email)}</b>` : ''}</p>`);
  if (has('fundacao')) centerBlocks.push(`<p class="line">Fundação: <b>${dateLabel(church.foundedAt) || '—'}</b></p>`);
  if (has('igrejaSede')) centerBlocks.push(`<p class="line">Igreja sede: <b>${esc(church.headquarters?.churchName) || '—'}</b></p>`);

  const membersBlock = has('totalMembros') || has('templo')
    ? `<div class="block">
        ${has('totalMembros') ? '<span class="lbl">Total de Membros:</span>' : ''}
        ${has('totalMembros') ? `<p class="line">Obreiros: <b>${workers ?? '—'}</b></p><p class="line">Membros: <b>${members ?? '—'}</b></p>` : ''}
        ${has('templo') ? `<p class="line">Templo: ( ${ownTemple ? '&nbsp;' : 'X'} ) Alugado &nbsp;-&nbsp; ( ${ownTemple ? 'X' : '&nbsp;'} ) Próprio</p>` : ''}
      </div>`
    : '';

  const leaderMeta = [
    has('rolDirigente') && record.newLeaderMember?.rol ? `ROL ${esc(record.newLeaderMember.rol)}` : '',
    has('rolDirigente') && record.function?.name ? esc(record.function.name) : '',
    has('datasMandato') && record.entryDate ? `Entrada ${dateLabel(record.entryDate)}` : '',
    has('datasMandato') ? (record.exitDate ? `Saída ${dateLabel(record.exitDate)}` : 'Em exercício') : '',
  ].filter(Boolean).join(' · ');

  const suggestedBlock = has('obreirosSugeridos')
    ? `<div class="block">
        <span class="lbl">Obreiros Sugeridos</span>
        <div class="value">${esc(leaderLabel(record.newLeaderMember))}</div>
        ${record.newLeaderMember?.spouseName ? `<div class="value muted">e ${esc(record.newLeaderMember.spouseName)}</div>` : ''}
        ${leaderMeta ? `<p class="line muted">${leaderMeta}</p>` : ''}
      </div>`
    : '';

  const indicanteBlock = has('indicante')
    ? `<div class="block"><span class="lbl">Indicante</span><div class="value">${esc(record.indicatedBy) || '—'}</div></div>`
    : '';

  const previousBlock = has('dirigenteAnterior')
    ? `<span class="lbl">Dirigente Anterior</span>
       <div class="value">${esc(leaderLabel(record.previousLeaderMember))}</div>
       ${record.previousExitDate ? `<div class="value soft">Saída ${dateLabel(record.previousExitDate)}</div>` : ''}`
    : '';

  const reasonBlock = has('motivo')
    ? `<div class="section"><span class="lbl">Motivo</span><div class="reason">${esc(record.changeReason) || '—'}</div></div>`
    : '';

  const siblingsBlock = has('congregacoesRegional')
    ? `<div class="section">
        <div class="dark-lbl">Congregações<br/>da Regional</div>
        <div class="siblings">${
          (data.regionalChurches || []).length
            ? data.regionalChurches.map((item) => `<div${item.name === church.name ? ' class="self"' : ''}>${esc(item.name)}</div>`).join('')
            : '<div>—</div>'
        }</div>
      </div>`
    : '';

  const notesBlock = has('observacoes') && record.notes
    ? `<div class="section"><span class="lbl">Observações</span><div class="reason soft">${esc(record.notes)}</div></div>`
    : '';

  return `
  <div class="grid${frames.length ? '' : ' no-photos'}">
    ${frames.length ? `<div class="frames">${frames.map((src) => `<div class="frame"><img src="${esc(src)}" alt="" /></div>`).join('')}</div>` : ''}
    <div class="center">
      <span class="lbl congregation">Congregação:</span>
      <div class="church-name">${esc(church.name) || '—'}</div>
      ${centerBlocks.join('')}
      ${membersBlock}
      ${suggestedBlock}
      ${indicanteBlock}
    </div>
    <div class="right">
      <div class="title">Troca de<br/>Dirigente</div>
      <div class="subtitle">Sugestão</div>
      <hr class="rule" />
      ${previousBlock}
      ${reasonBlock}
      ${siblingsBlock}
      ${notesBlock}
    </div>
  </div>`;
}

// ─── layout: histórico ──────────────────────────────────────────────────────

function historyCell(record: LeaderReportRecord, key: HistoryColumnKey, data: LeaderReportData) {
  switch (key) {
    case 'newLeader': return esc(leaderLabel(record.newLeaderMember));
    case 'rol': return esc(record.newLeaderMember?.rol ?? '—');
    case 'functionName': return esc(record.function?.name || '—');
    case 'entryDate': return dateLabel(record.entryDate) || '—';
    case 'exitDate': return record.exitDate ? dateLabel(record.exitDate) : '<span class="tag">Em exercício</span>';
    case 'duration': return durationLabel(record.entryDate, record.exitDate);
    case 'previousLeader': return esc(leaderLabel(record.previousLeaderMember));
    case 'previousExitDate': return record.previousExitDate ? dateLabel(record.previousExitDate) : '—';
    case 'indicatedBy': return esc(record.indicatedBy || '—');
    case 'changeReason': return esc(record.changeReason || '—');
    case 'totalMembers': return String(record.totalMembers ?? data.counts?.members ?? '—');
    case 'totalWorkers': return String(record.totalWorkers ?? data.counts?.workers ?? '—');
    case 'currentCash': return money(record.currentCash);
    case 'averageIncome': return money(record.averageIncome);
    case 'averageExpense': return money(record.averageExpense);
    case 'maxIncome': return money(record.maxIncome);
    default: return '—';
  }
}

function renderHistory(data: LeaderReportData, options: LeaderReportOptions) {
  const church = data.church || {};
  const regional = church.regional || {};
  const columns = HISTORY_COLUMNS.filter((column) => options.columns.includes(column.key));
  const records = data.records || [];
  const current = records.find((item) => !item.exitDate) || null;

  const identity = [
    church.code ? `Código ${esc(church.code)}` : '',
    regional.name ? `Regional ${esc(regional.name)}` : '',
    regional.campo?.name ? esc(regional.campo.name) : '',
    church.addressCity ? `${esc(church.addressCity)}${church.addressState ? `/${esc(church.addressState)}` : ''}` : '',
  ].filter(Boolean).join(' · ');

  return `
  <div class="hist">
    <div class="hist-head">
      <div>
        <div class="hist-title">Histórico de Dirigentes</div>
        <div class="hist-church">${esc(church.name) || '—'}</div>
        <div class="hist-meta">${identity}</div>
      </div>
      <div class="hist-stats">
        <div><span>Movimentações</span><strong>${records.length}</strong></div>
        <div><span>Em exercício</span><strong>${current ? esc(leaderLabel(current.newLeaderMember)) : 'Nenhum'}</strong></div>
        ${current ? `<div><span>Desde</span><strong>${dateLabel(current.entryDate) || '—'}</strong></div>` : ''}
      </div>
    </div>

    ${options.images.length ? `<div class="hist-photos">${options.images.map((src) => `<img src="${esc(src)}" alt="" />`).join('')}</div>` : ''}

    ${
      records.length
        ? `<table>
            <thead><tr>${columns.map((column) => `<th${column.align === 'right' ? ' class="r"' : ''}>${esc(column.label)}</th>`).join('')}</tr></thead>
            <tbody>${records
              .map((record) => `<tr${record.exitDate ? '' : ' class="active"'}>${columns
                .map((column) => `<td${column.align === 'right' ? ' class="r"' : ''}>${historyCell(record, column.key, data)}</td>`)
                .join('')}</tr>`)
              .join('')}</tbody>
          </table>`
        : '<p class="empty">Nenhuma troca de dirigente registrada nesta igreja.</p>'
    }
  </div>`;
}

// ─── documento ──────────────────────────────────────────────────────────────

const STYLES = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff}
  .sheet{background:#fff;padding:10mm 9mm}
  .empty{padding:20px;text-align:center;color:#6b7280;font-size:9pt}

  .grid{display:grid;grid-template-columns:48mm 1fr 68mm;gap:8mm;align-items:start}
  .grid.no-photos{grid-template-columns:1fr 68mm}
  .frames{display:flex;flex-direction:column;gap:3mm}
  .frame{width:100%;height:30mm;background:#f1f1ee;border:1px solid #dcdcd6;overflow:hidden}
  .frame img{width:100%;height:100%;object-fit:cover;display:block}

  .lbl{color:#c1121f;font-weight:700;text-transform:uppercase;letter-spacing:.02em}
  .congregation{font-size:11pt}
  .church-name{font-size:13pt;font-weight:700;color:#c1121f;text-transform:uppercase;text-decoration:underline;text-underline-offset:2px;margin:1mm 0 3.5mm}
  .line{font-size:8.5pt;margin:1mm 0;color:#1f2937}
  .line b{font-weight:400;color:#111}
  .block{margin-top:5.5mm}
  .block .lbl{font-size:10pt;display:block;margin-bottom:1.5mm}
  .value{font-size:9.5pt;font-weight:700;color:#111;text-transform:uppercase}
  .muted{color:#4b5563;font-weight:400}
  .soft{font-weight:400;color:#4b5563;font-size:8pt;margin-top:1mm}

  .right{text-align:right}
  .title{font-size:19pt;line-height:1.02;font-weight:800;color:#c1121f;text-transform:uppercase;letter-spacing:-.4px}
  .subtitle{font-size:10pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-top:1mm}
  .rule{border:none;border-top:1.2px solid #111;margin:3.5mm 0 4mm}
  .right .lbl{font-size:9.5pt;display:block}
  .right .value{margin-top:1.2mm;font-size:8.5pt}
  .reason{font-size:8.5pt;font-weight:700;text-transform:uppercase;margin-top:1.2mm}
  .section{margin-top:5mm}
  .dark-lbl{font-size:9.5pt;font-weight:700;text-transform:uppercase;line-height:1.15}
  .siblings{font-size:8.5pt;font-weight:700;text-transform:uppercase;margin-top:2mm;line-height:1.45}
  .siblings .self{color:#c1121f}

  .hist-head{display:flex;justify-content:space-between;gap:10mm;align-items:flex-start;border-bottom:1.5px solid #111;padding-bottom:3.5mm;margin-bottom:4.5mm}
  .hist-title{font-size:14pt;font-weight:800;color:#c1121f;text-transform:uppercase;letter-spacing:-.2px}
  .hist-church{font-size:10.5pt;font-weight:700;margin-top:1mm;text-transform:uppercase}
  .hist-meta{font-size:7.5pt;color:#4b5563;margin-top:1mm}
  .hist-stats{display:flex;gap:5mm;text-align:right}
  .hist-stats div{display:flex;flex-direction:column;gap:.8mm}
  .hist-stats span{font-size:6.5pt;text-transform:uppercase;letter-spacing:.1em;color:#6b7280}
  .hist-stats strong{font-size:8.5pt}
  .hist-photos{display:flex;gap:2.5mm;margin-bottom:4.5mm}
  .hist-photos img{width:38mm;height:24mm;object-fit:cover;border:1px solid #dcdcd6}

  table{width:100%;border-collapse:collapse;font-size:7.5pt}
  th,td{border:.5px solid #dde1e7;padding:1.6mm 2mm;text-align:left;vertical-align:top}
  th{background:#f3f4f6;font-weight:700;text-transform:uppercase;font-size:6.5pt;letter-spacing:.05em;white-space:nowrap}
  td.r,th.r{text-align:right;white-space:nowrap}
  tbody tr:nth-child(even) td{background:#fafafa}
  tbody tr.active td{background:#fff7ed}
  .tag{color:#047857;font-weight:700;text-transform:uppercase;font-size:6.5pt}

  .foot{margin-top:7mm;padding-top:2.5mm;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:7pt;color:#6b7280}
`;

const PRINT_STYLES = `
  @page{size:A4 landscape;margin:6mm}
  body{background:#fff}
  .sheet{padding:6mm 8mm}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  tr{page-break-inside:avoid}
  thead{display:table-header-group}
`;

/** Corpo do relatório — reaproveitado na pré-visualização dentro do modal. */
export function buildLeaderReportBody(data: LeaderReportData, options: LeaderReportOptions) {
  const church = data.church || {};
  const regional = church.regional || {};
  const generatedAt = data.generatedAt ? new Date(data.generatedAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
  const content = options.kind === 'change' ? renderChangeCard(data, options) : renderHistory(data, options);

  return `<div class="sheet">
    ${content}
    <div class="foot">
      <span>${esc(regional.campo?.name) ? `${esc(regional.campo?.name)} · ` : ''}Regional ${esc(regional.name || regional.code) || '—'}</span>
      <span>Emitido em ${esc(generatedAt)}${data.generatedBy ? ` por ${esc(data.generatedBy)}` : ''}</span>
    </div>
  </div>`;
}

export const LEADER_REPORT_STYLES = STYLES;

/**
 * Prefixa cada seletor com um escopo para a pré-visualização poder ser injetada
 * na página sem vazar. Sem isso as regras genéricas (`body`, `table`, `th`, `td`,
 * `*`) atingiam a tela inteira atrás do modal e quebravam a listagem.
 *
 * O CSS daqui é simples de propósito — sem `@media`/aninhamento — então este
 * prefixo direto dá conta; a janela de impressão continua usando o CSS original.
 */
export function scopeLeaderReportStyles(scope: string) {
  return STYLES.replace(/(^|\})\s*([^{}]+)\s*\{/g, (_match, brace: string, selectors: string) => {
    const scoped = selectors
      .split(',')
      .map((selector) => {
        const clean = selector.trim();
        if (!clean) return '';
        // `body` vira o próprio contêiner; os demais viram descendentes dele.
        if (clean === 'body') return scope;
        return `${scope} ${clean}`;
      })
      .filter(Boolean)
      .join(',');
    return `${brace}${scoped}{`;
  });
}

/**
 * Documento enviado à impressora. Não tem barra de ações nem estilo de tela: a
 * pré-visualização já acontece dentro do modal, então este HTML existe só para
 * virar papel/PDF.
 */
export function buildLeaderReportHtml(data: LeaderReportData, options: LeaderReportOptions) {
  const title = options.title || (options.kind === 'change' ? 'Troca de Dirigente' : 'Histórico de Dirigentes');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${esc(title)} — ${esc(data.church?.name)}</title>
<style>
  ${STYLES}
  ${PRINT_STYLES}
</style>
</head>
<body>${buildLeaderReportBody(data, options)}</body>
</html>`;
}

/** Espera as imagens carregarem — sem isso o relatório sai sem as fotos. */
function waitForImages(doc: Document, timeoutMs = 8000) {
  const images = Array.from(doc.images).filter((image) => !image.complete);
  if (!images.length) return Promise.resolve();
  return Promise.race([
    Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true });
            // Foto quebrada não pode segurar a impressão do resto.
            image.addEventListener('error', () => resolve(), { once: true });
          })
      )
    ).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Manda o relatório direto para o diálogo de impressão, por um iframe oculto.
 *
 * A versão anterior abria uma janela intermediária com botão "Imprimir" — três
 * telas para uma impressão, e sobrava um `about:blank` para o usuário fechar.
 * Aqui não sobra nada: o iframe se remove sozinho quando a impressão termina.
 */
export async function printLeaderReport(data: LeaderReportData, options: LeaderReportOptions) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
  document.body.appendChild(frame);

  const remove = () => {
    if (frame.parentNode) frame.parentNode.removeChild(frame);
  };

  try {
    const win = frame.contentWindow;
    const doc = frame.contentDocument || win?.document;
    if (!win || !doc) throw new Error('Não foi possível preparar o relatório para impressão.');

    doc.open();
    doc.write(buildLeaderReportHtml(data, options));
    doc.close();

    await waitForImages(doc);

    // `afterprint` fecha o ciclo em Chrome/Firefox; o timeout cobre navegadores
    // que não disparam o evento, para o iframe não ficar preso na página.
    win.addEventListener('afterprint', remove, { once: true });
    setTimeout(remove, 60000);

    win.focus();
    win.print();
  } catch (error) {
    remove();
    throw error;
  }
}
