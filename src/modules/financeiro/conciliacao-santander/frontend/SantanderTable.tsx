'use client'

import React from 'react'
import type { SantanderMovimentoDto } from '../dtos/santander.dto'

interface SantanderTableProps {
  movimentos: SantanderMovimentoDto[]
  loading?: boolean
  onVerDetalhes: (mv: SantanderMovimentoDto) => void
  onInserirLivroCaixa: (mv: SantanderMovimentoDto) => void
  onConciliarManual: (mv: SantanderMovimentoDto) => void
  onIgnorar: (mv: SantanderMovimentoDto) => void
  onDesfazerConciliacao?: (mv: SantanderMovimentoDto) => void
  permissions: string[]
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  novo:                  { label: 'Novo',          class: 'bg-gray-100 text-gray-700' },
  match_exato:           { label: 'Match Exato',   class: 'bg-green-100 text-green-700' },
  match_sugerido:        { label: 'Sugerido',      class: 'bg-yellow-100 text-yellow-700' },
  sem_lancamento:        { label: 'Sem Lançamento',class: 'bg-orange-100 text-orange-700' },
  conciliado:            { label: 'Conciliado',    class: 'bg-teal-100 text-teal-700' },
  ignorado:              { label: 'Ignorado',      class: 'bg-gray-200 text-gray-500' },
  lancado:               { label: 'Lançado',       class: 'bg-blue-100 text-blue-700' },
  duplicado:             { label: 'Duplicado',     class: 'bg-red-100 text-red-700' },
  sem_movimento_bancario:{ label: 'Só no Sistema', class: 'bg-purple-100 text-purple-700' },
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: string) => {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

export function SantanderTable({
  movimentos,
  loading,
  onVerDetalhes,
  onInserirLivroCaixa,
  onConciliarManual,
  onIgnorar,
  onDesfazerConciliacao,
  permissions,
}: SantanderTableProps) {
  const canLancar = permissions.includes('financeiro.santander.lancar_livro_caixa')
  const canConciliar = permissions.includes('financeiro.santander.conciliar')
  const canIgnorar = permissions.includes('financeiro.santander.ignorar')

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-gray-100 animate-pulse rounded h-10" />
        ))}
      </div>
    )
  }

  if (movimentos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg">Nenhum movimento encontrado</p>
        <p className="text-sm mt-1">Ajuste os filtros ou clique em "Buscar no Santander"</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
            <th className="px-3 py-2">Data</th>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2 text-right">Valor</th>
            <th className="px-3 py-2">Histórico</th>
            <th className="px-3 py-2">Documento</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {movimentos.map((mv) => {
            const statusInfo = STATUS_LABELS[mv.status] ?? { label: mv.status, class: 'bg-gray-100' }
            const isLancado = mv.status === 'lancado' || mv.status === 'conciliado'
            const isIgnorado = mv.status === 'ignorado'

            return (
              <tr
                key={mv.id}
                className={`hover:bg-blue-50 transition-colors ${isIgnorado ? 'opacity-40' : ''}`}
              >
                <td className="px-3 py-2 whitespace-nowrap font-mono">
                  {fmtDate(mv.transaction_date)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold text-xs px-1.5 py-0.5 rounded ${
                      mv.credit_debit_type === 'C'
                        ? 'text-green-700 bg-green-50'
                        : 'text-red-700 bg-red-50'
                    }`}
                  >
                    {mv.credit_debit_type === 'C' ? '▲ CR' : '▼ DB'}
                  </span>
                </td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${
                  mv.credit_debit_type === 'C' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {fmt(mv.amount)}
                </td>
                <td className="px-3 py-2 max-w-[200px] truncate text-gray-700">
                  {mv.history_description ?? mv.transaction_name ?? '—'}
                </td>
                <td className="px-3 py-2 font-mono text-gray-500 text-xs">
                  {mv.document_number ?? '—'}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.class}`}>
                    {statusInfo.label}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onVerDetalhes(mv)}
                      className="text-gray-400 hover:text-gray-700 text-xs px-1.5 py-1 rounded hover:bg-gray-100"
                      title="Ver detalhes"
                    >
                      🔍
                    </button>
                    {canLancar && !isLancado && !isIgnorado && (
                      <button
                        onClick={() => onInserirLivroCaixa(mv)}
                        className="text-blue-600 hover:text-blue-800 text-xs px-1.5 py-1 rounded hover:bg-blue-50"
                        title="Inserir no Livro Caixa"
                      >
                        + Lançar
                      </button>
                    )}
                    {canConciliar && !isLancado && !isIgnorado && (
                      <button
                        onClick={() => onConciliarManual(mv)}
                        className="text-teal-600 hover:text-teal-800 text-xs px-1.5 py-1 rounded hover:bg-teal-50"
                        title="Conciliar manualmente"
                      >
                        ⟺
                      </button>
                    )}
                    {canConciliar && isLancado && onDesfazerConciliacao && (
                      <button
                        onClick={() => onDesfazerConciliacao(mv)}
                        className="text-gray-400 hover:text-orange-600 text-xs px-1.5 py-1 rounded hover:bg-orange-50"
                        title="Desfazer conciliação"
                      >
                        ↩
                      </button>
                    )}
                    {canIgnorar && !isIgnorado && !isLancado && (
                      <button
                        onClick={() => onIgnorar(mv)}
                        className="text-gray-400 hover:text-red-600 text-xs px-1.5 py-1 rounded hover:bg-red-50"
                        title="Ignorar movimento"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
