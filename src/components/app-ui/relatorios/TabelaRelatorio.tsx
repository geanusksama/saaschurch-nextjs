/**
 * Peças comuns dos relatórios (Rastreador do site, Relatórios do WhatsApp):
 *  - exportarExcel: planilha .xlsx de uma tabela
 *  - imprimirSecoes: imprime título, período e várias tabelas por um quadro
 *    invisível (A4 deitado), sem abrir janela nova
 *  - JanelaTabela: a janela que abre ao clicar num gráfico, com a lista e os
 *    botões Exportar e Imprimir (marcados na árvore de permissões por quem usa)
 */
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

export type Celula = string | number
export interface Secao { titulo: string; colunas: string[]; linhas: Celula[][] }

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Excel (.xlsx) de uma tabela simples. */
export function exportarExcel(nomeArquivo: string, colunas: string[], linhas: Celula[][]) {
  const ws = XLSX.utils.aoa_to_sheet([colunas, ...linhas])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
  XLSX.writeFile(wb, `${slug(nomeArquivo) || 'relatorio'}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

/**
 * Imprime várias tabelas (uma aba inteira do relatório) por um quadro
 * invisível — como o printReport do sistema: nada de janela nova sobrando.
 */
export function imprimirSecoes(titulo: string, subtitulo: string, secoes: Secao[], textoLivre?: string) {
  const esc = (v: Celula) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const tabelas = secoes.filter(s => s.linhas.length).map(s => `
    <h2>${esc(s.titulo)}</h2>
    <table><thead><tr>${s.colunas.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${s.linhas.map(l => `<tr>${l.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')
  const quadro = document.createElement('iframe')
  quadro.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;'
  document.body.appendChild(quadro)
  const w = quadro.contentWindow
  if (!w) { quadro.remove(); toast.error('Não foi possível preparar a impressão.'); return }
  w.document.open()
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:0}h1{font-size:17px;margin:0}
h2{font-size:13px;margin:18px 0 6px}p.sub{color:#555;margin:4px 0 12px}pre{white-space:pre-wrap;font-family:inherit;font-size:12px}
table{border-collapse:collapse;width:100%;margin-bottom:6px;page-break-inside:auto}tr{page-break-inside:avoid}
th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f1f5f9}
@page{size:A4 landscape;margin:12mm}</style></head><body>
<h1>${esc(titulo)}</h1><p class="sub">${esc(subtitulo)} · impresso em ${esc(new Date().toLocaleString('pt-BR'))}</p>
${textoLivre ? `<pre>${esc(textoLivre)}</pre>` : ''}${tabelas || (textoLivre ? '' : '<p>Sem dados.</p>')}
</body></html>`)
  w.document.close()
  const limpar = () => { if (document.body.contains(quadro)) quadro.remove() }
  w.addEventListener('afterprint', limpar)
  setTimeout(() => { w.focus(); w.print(); setTimeout(limpar, 60_000) }, 250)
}

export function JanelaTabela({
  titulo, subtitulo, colunas, linhas, carregando, onFechar, onLinha, acoes,
}: {
  titulo: string
  subtitulo: string
  colunas: string[]
  linhas: Celula[][]
  carregando?: boolean
  onFechar: () => void
  onLinha?: (indice: number) => void
  /** botões Exportar/Imprimir já marcados com <Permissao> por quem usa */
  acoes: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{titulo}</h3>
            <p className="text-xs text-slate-500">{subtitulo} · {carregando ? 'carregando…' : `${linhas.length} linha(s)`}</p>
          </div>
          {acoes}
          <button type="button" onClick={onFechar} title="Fechar" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-auto">
          {carregando ? <p className="p-6 text-center text-sm text-slate-500">Carregando…</p> : linhas.length ? (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                <tr>{colunas.map(h => <th key={h} className="text-left font-semibold text-slate-600 dark:text-slate-300 px-3 py-2 whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {linhas.map((l, i) => (
                  <tr key={i} onClick={onLinha ? () => onLinha(i) : undefined} className={onLinha ? 'hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer' : ''}>
                    {l.map((c, j) => <td key={j} className="px-3 py-2 align-top">{c === '' ? '—' : c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="p-6 text-center text-sm text-slate-500">Nada neste grupo.</p>}
        </div>
      </div>
    </div>
  )
}
