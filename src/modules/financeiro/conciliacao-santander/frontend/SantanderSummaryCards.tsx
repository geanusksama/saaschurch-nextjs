'use client'

import React from 'react'

interface SummaryData {
  total_credito: number
  total_debito: number
  saldo_periodo: number
  total_novo: number
  total_conciliado: number
  total_lancado: number
  total_ignorado: number
  total_livro_caixa?: number
  diferenca?: number
}

interface SantanderSummaryCardsProps {
  summary: SummaryData | null
  loading?: boolean
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const Card = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className={`bg-white border rounded-lg p-4 flex flex-col gap-1 border-l-4 ${color}`}>
    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
    <span className="text-xl font-bold text-gray-800">{value}</span>
  </div>
)

const CountCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className={`bg-white border rounded-lg p-4 flex flex-col gap-1 border-l-4 ${color}`}>
    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
    <span className="text-2xl font-bold text-gray-800">{value}</span>
  </div>
)

export function SantanderSummaryCards({ summary, loading }: SantanderSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-gray-100 animate-pulse rounded-lg h-20" />
        ))}
      </div>
    )
  }

  if (!summary) return null

  const diferenca = summary.diferenca ?? (summary.total_credito - summary.total_debito - (summary.total_livro_caixa ?? 0))

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <Card
        label="Total Créditos Santander"
        value={fmt(summary.total_credito)}
        color="border-green-500"
      />
      <Card
        label="Total Débitos Santander"
        value={fmt(summary.total_debito)}
        color="border-red-500"
      />
      <Card
        label="Saldo do Período"
        value={fmt(summary.saldo_periodo)}
        color={summary.saldo_periodo >= 0 ? 'border-blue-500' : 'border-orange-500'}
      />
      {summary.total_livro_caixa !== undefined && (
        <Card
          label="Total Livro Caixa"
          value={fmt(summary.total_livro_caixa)}
          color="border-purple-500"
        />
      )}
      {summary.diferenca !== undefined && (
        <Card
          label="Diferença"
          value={fmt(Math.abs(diferenca))}
          color={Math.abs(diferenca) < 0.01 ? 'border-green-400' : 'border-yellow-500'}
        />
      )}
      <CountCard
        label="Não Conciliados"
        value={summary.total_novo}
        color={summary.total_novo > 0 ? 'border-orange-400' : 'border-green-400'}
      />
      <CountCard
        label="Já Lançados"
        value={summary.total_lancado}
        color="border-teal-500"
      />
    </div>
  )
}
