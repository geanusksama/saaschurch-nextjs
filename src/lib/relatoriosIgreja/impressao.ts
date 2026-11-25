import type { ColunaDef, Linha, RelatorioDef } from './tipos';

/**
 * Impressão no modelo da origem: nome da igreja e título no topo, blocos por
 * agrupamento com os totais de cada bloco, total geral no fim, rodapé com quem
 * imprimiu e a paginação.
 */

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function formatar(c: ColunaDef, v: Linha[string]): string {
  if (v == null || v === '') return '';
  if (c.tipo === 'moeda') return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (c.tipo === 'percentual') return `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  if (c.tipo === 'data') { const s = String(v).slice(0, 10).split('-'); return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : String(v); }
  return String(v);
}

export function totaisDe(rel: RelatorioDef, linhas: Linha[]): Array<[string, string]> {
  // Coluna sem nenhum valor (ex.: "Mostrar Valor" desmarcado) não ganha total: sairia 0,00.
  return (rel.totais ?? []).filter((t) => t.tipo === 'contagem' || !linhas.length || linhas.some((l) => l[t.coluna ?? ''] != null)).map((t) => {
    if (t.tipo === 'contagem') return [t.rotulo, String(linhas.length)];
    const col = rel.colunas.find((c) => c.id === t.coluna);
    const soma = linhas.reduce((s, l) => s + Number(l[t.coluna ?? ''] || 0), 0);
    return [t.rotulo, col ? formatar(col, soma) : String(soma)];
  });
}

function usuarioLogado(): string {
  try {
    const u = JSON.parse(localStorage.getItem('mrm_user') || '{}') as { fullName?: string; name?: string; email?: string };
    return u.fullName || u.name || u.email || '';
  } catch { return ''; }
}

export function imprimirRelatorio(o: { organizacao: string; rel: RelatorioDef; colunas: ColunaDef[]; linhas: Linha[]; agrupar: boolean; filtrosTexto?: string }) {
  const { rel, colunas } = o;
  const dir = (c: ColunaDef) => (c.tipo === 'numero' || c.tipo === 'moeda' || c.tipo === 'percentual' ? ' class="dir"' : '');
  const tabela = (ls: Linha[]) => `<table><thead><tr>${colunas.map((c) => `<th${dir(c)}>${esc(c.rotulo)}</th>`).join('')}</tr></thead><tbody>${
    ls.map((l) => `<tr>${colunas.map((c) => `<td${dir(c)}>${esc(formatar(c, l[c.id]))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const totais = (ls: Linha[], geral = false) => {
    const t = totaisDe(rel, ls);
    if (!t.length) return '';
    return `<div class="tot">${t.map(([r, v]) => `<div>${esc(geral ? r.replace(/^Quantidade de/, 'Total de') : r)} : <b>${esc(v)}</b></div>`).join('')}</div>`;
  };
  let corpo: string;
  if (o.agrupar && rel.agruparPor) {
    const blocos = new Map<string, Linha[]>();
    for (const l of o.linhas) { const k = String(l[rel.agruparPor] ?? '—'); blocos.set(k, [...(blocos.get(k) ?? []), l]); }
    corpo = [...blocos.entries()].map(([k, ls]) => `<h2>${esc(k)}</h2>${tabela(ls)}${totais(ls)}`).join('') + totais(o.linhas, true);
  } else {
    corpo = tabela(o.linhas) + totais(o.linhas, true);
  }
  const quando = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
  const assinatura = `Impresso em ${quando}${usuarioLogado() ? ` por ${usuarioLogado()}` : ''}`.replace(/["\\]/g, '');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(rel.titulo ?? rel.nome)}</title><style>
    @page{size:A4 ${rel.orientacao ?? 'portrait'};margin:12mm 10mm 16mm;
      @bottom-left{content:"${assinatura}";font:9px Arial,sans-serif;color:#333}
      @bottom-right{content:"Página " counter(page) " de " counter(pages);font:9px Arial,sans-serif;color:#333}}
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;font-size:10px}
    .org{font-size:15px;font-weight:700;margin:0 0 4px} .tit{font-size:13px;margin:0 0 4px} .fil{font-size:9px;color:#555;margin:0 0 12px}
    h2{font-size:11px;margin:12px 0 4px;padding:3px 0;border-bottom:1px solid #999}
    table{width:100%;border-collapse:collapse} thead{display:table-header-group}
    th{text-align:left;font-size:9.5px;font-weight:700;padding:3px 6px;border-bottom:2px solid #bbb}
    td{padding:2.5px 6px;vertical-align:top} tr{break-inside:avoid} tbody tr:nth-child(even){background:#f6f6f6}
    .dir{text-align:right} .tot{display:flex;flex-direction:column;align-items:flex-end;margin:4px 0 8px;font-size:10px}
  </style></head><body>
    <p class="org">${esc(o.organizacao)}</p><p class="tit">${esc(rel.titulo ?? rel.nome)}</p>
    ${o.filtrosTexto ? `<p class="fil">${esc(o.filtrosTexto)}</p>` : ''}
    ${corpo}
    <script>window.onafterprint=function(){window.close();};window.onload=function(){window.print();}</script>
  </body></html>`;
  const janela = window.open('', '_blank', 'width=1100,height=800');
  if (janela) { janela.document.write(html); janela.document.close(); }
}
