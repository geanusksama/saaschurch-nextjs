/**
 * Imprimir e exportar no MODELO DO SISTEMA (mesmo das telas de Secretaria,
 * Conamad, Patrimônio): o PrintModal deixa escolher colunas, ordem,
 * agrupamento e orientação; a impressão sai pelo printReport (quadro
 * invisível — não deixa página em branco aberta) e o Excel é .xlsx.
 *
 * Uso:
 *   const saida = useSaidaRelatorio({ titulo, subtitulo, colunas, linhas, grupos })
 *   <Permissao ...><button onClick={saida.abrirImpressao}>Imprimir</button></Permissao>
 *   <Permissao ...><button onClick={saida.exportarExcel}>Exportar Excel</button></Permissao>
 *   {saida.modal}
 */
import { useState, type ReactNode } from 'react'
import * as XLSX from 'xlsx'
import { printReport, type PrintOrientation } from '../../../lib/printReport'
import { PrintModal } from '../shared/PrintModal'

export interface ColunaSaida<T> {
  id: string
  rotulo: string
  texto: (linha: T) => string | number
  /** começa desmarcada no PrintModal */
  oculta?: boolean
}

/** printReport monta HTML com o texto cru: escapa tudo que vem de fora (nomes do WhatsApp...). */
const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function useSaidaRelatorio<T>(o: {
  titulo: string
  subtitulo?: string
  colunas: ColunaSaida<T>[]
  linhas: T[]
  /** ids de colunas que podem agrupar a impressão */
  grupos?: string[]
  ordemPadrao?: string
  orientacao?: PrintOrientation
}): { abrirImpressao: () => void; exportarExcel: () => void; modal: ReactNode } {
  const [aberto, setAberto] = useState(false)

  const exportarExcel = () => {
    if (!o.linhas.length) return
    const ws = XLSX.utils.aoa_to_sheet([o.colunas.map(c => c.rotulo), ...o.linhas.map(l => o.colunas.map(c => c.texto(l)))])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, o.titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, ' ') || 'Relatório')
    XLSX.writeFile(wb, `${slug(o.titulo) || 'relatorio'}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const imprimir = (orientacao: PrintOrientation, ordem: string, cols: string[], grupo?: boolean | string) => {
    setAberto(false)
    const def = o.colunas.find(c => c.id === ordem)
    const ordenadas = def
      ? [...o.linhas].sort((a, b) => {
          const x = def.texto(a), y = def.texto(b)
          return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')
        })
      : o.linhas
    const escolhidas = o.colunas.filter(c => cols.includes(c.id))
    const grupoCol = typeof grupo === 'string' && grupo ? o.colunas.find(c => c.id === grupo) : undefined
    printReport({
      title: esc(o.titulo),
      subtitle: o.subtitulo ? esc(o.subtitulo) : undefined,
      orientation: orientacao,
      columns: escolhidas.map(c => ({ key: c.id, label: esc(c.rotulo) })),
      rows: ordenadas.map(l => Object.fromEntries(o.colunas.map(c => [c.id, esc(c.texto(l)) || '—']))),
      groupByKey: grupoCol?.id,
      groupByLabel: grupoCol ? esc(grupoCol.rotulo) : undefined,
    })
  }

  const modal = aberto ? (
    <PrintModal open onClose={() => setAberto(false)} onPrint={imprimir}
      sortOptions={o.colunas.map(c => ({ value: c.id, label: c.rotulo }))}
      columnOptions={o.colunas.map(c => ({ value: c.id, label: c.rotulo, defaultChecked: !c.oculta }))}
      defaultSort={o.ordemPadrao ?? o.colunas[0]?.id}
      groupOptions={(o.grupos ?? []).map(id => o.colunas.find(c => c.id === id)).filter((c): c is ColunaSaida<T> => !!c).map(c => ({ value: c.id, label: c.rotulo }))}
      defaultOrientation={o.orientacao ?? 'landscape'} />
  ) : null

  return { abrirImpressao: () => { if (o.linhas.length) setAberto(true) }, exportarExcel, modal }
}
