/**
 * Impressão dos relatórios Conamad no modelo da convenção: brasão e títulos no
 * topo, tabela zebrada que repete o cabeçalho em cada página, situações em cor
 * e rodapé com quem imprimiu e a paginação.
 */
export interface ColunaImpressao {
  chave: string;
  rotulo: string;
  alinhar?: 'direita' | 'centro';
}

export interface OpcoesImpressao {
  titulo: string;
  orientacao: 'portrait' | 'landscape';
  colunas: ColunaImpressao[];
  linhas: Array<Record<string, string>>;
  /** Chave da coluna que separa a lista em blocos com título. */
  agruparPor?: string;
  /** Linha acima da tabela quando não há agrupamento. */
  subtitulo?: string;
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const COR: Record<string, string> = { PAGO: '#0a8a2a', NPAG: '#d81b1b', ISN: '#8a8f98', 'ISN/ID': '#8a8f98', CANC: '#8a8f98' };

function usuarioLogado(): string {
  try {
    const u = JSON.parse(localStorage.getItem('mrm_user') || '{}') as { fullName?: string; name?: string; email?: string };
    return u.fullName || u.name || u.email || '';
  } catch {
    return '';
  }
}

function tabela(o: OpcoesImpressao, linhas: Array<Record<string, string>>) {
  const classe = (c: ColunaImpressao) => (c.alinhar === 'direita' ? ' class="dir"' : c.alinhar === 'centro' ? ' class="cen"' : '');
  const cab = o.colunas.map((c) => `<th${classe(c)}>${esc(c.rotulo)}</th>`).join('');
  const corpo = linhas.map((l) => `<tr>${o.colunas.map((c) => {
    const v = l[c.chave] ?? '';
    const cor = COR[v];
    return `<td${classe(c)}${cor ? ` style="color:${cor}"` : ''}>${esc(v)}</td>`;
  }).join('')}</tr>`).join('');
  return `<table><thead><tr>${cab}</tr></thead><tbody>${corpo}</tbody></table>`;
}

export function imprimirConamad(o: OpcoesImpressao) {
  const blocos = new Map<string, Array<Record<string, string>>>();
  if (o.agruparPor) {
    for (const l of o.linhas) {
      const k = l[o.agruparPor] || '—';
      blocos.set(k, [...(blocos.get(k) ?? []), l]);
    }
  }
  const conteudo = o.agruparPor
    ? [...blocos.entries()].map(([k, ls]) => `<h2>${esc(k)}</h2>${tabela(o, ls)}`).join('')
    : `${o.subtitulo ? `<h2>${esc(o.subtitulo)}</h2>` : ''}${tabela(o, o.linhas)}`;
  const quando = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
  const assinatura = `Impresso em ${quando}${usuarioLogado() ? ` por ${usuarioLogado()}` : ''}`;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(o.titulo)}</title><style>
    @page{size:A4 ${o.orientacao};margin:12mm 10mm 16mm;
      @bottom-left{content:"${assinatura.replace(/["\\]/g, '')}";font:10px Arial,sans-serif;color:#333}
      @bottom-right{content:"Página " counter(page) " de " counter(pages);font:10px Arial,sans-serif;color:#333}}
    *{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;font-size:10px}
    .topo{display:flex;align-items:flex-start;gap:60px;border-bottom:1px solid #e3e3e3;padding-bottom:14px;margin-bottom:18px}
    .topo img{width:88px;height:88px;object-fit:contain}
    .org{font-size:16px;font-weight:700;margin:6px 0 2px}
    .lin{font-size:14px;margin:2px 0}
    .tit{font-size:24px;text-align:center;margin:6px 0 0}
    h2{font-size:14px;margin:14px 0 6px}
    table{width:100%;border-collapse:collapse}
    thead{display:table-header-group}
    th{text-align:left;font-size:9.5px;font-weight:700;padding:4px 7px;border-bottom:3px solid #ddd;vertical-align:bottom}
    td{padding:3.5px 7px;white-space:nowrap}
    tr{break-inside:avoid}
    tbody tr:nth-child(even){background:#f7f7f7}
    .dir{text-align:right}.cen{text-align:center}
  </style></head><body>
    <div class="topo"><img src="${esc(window.location.origin)}/conamad-logo.png" alt=""><div style="flex:1">
      <p class="org">CONVENÇÃO NACIONAL DAS ASSEMBLÉIAS DE DEUS</p>
      <p class="lin">MINISTÉRIO DE MADUREIRA - CONAMAD</p>
      <p class="lin">RELATÓRIO DO SISTEMA DE MINISTROS</p>
      <p class="tit">${esc(o.titulo)}</p>
    </div></div>
    ${conteudo}
    <script>window.onafterprint=function(){window.close();};window.onload=function(){window.print();}</script>
  </body></html>`;
  const janela = window.open('', '_blank', 'width=1100,height=800');
  if (janela) { janela.document.write(html); janela.document.close(); }
}
