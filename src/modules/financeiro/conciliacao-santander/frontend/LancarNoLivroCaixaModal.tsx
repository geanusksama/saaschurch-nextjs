'use client'

import React, { useState } from 'react'
import type { SantanderMovimentoDto, LancarNoLivroCaixaDto } from '../dtos/santander.dto'
import { apiBase } from '@/lib/apiBase'

interface LancarNoLivroCaixaModalProps {
  movimento: SantanderMovimentoDto
  churchId: string
  planoDeContasOptions: { value: string; label: string }[]
  formaPagamentoOptions: { value: string; label: string }[]
  onSuccess: (livro_caixa_id: number) => void
  onClose: () => void
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }

// Sugere plano de conta com base na categoria FEBRABAN
function suggestPlano(categoryCode: string | null, type: 'C' | 'D'): string {
  if (!categoryCode) return type === 'C' ? 'RECEITA_OUTROS' : 'DESPESA_OUTROS'
  const code = parseInt(categoryCode, 10)
  if (type === 'C') {
    if (code === 219) return 'RECEITA_DIZIMO'
    if ([209, 213].includes(code)) return 'RECEITA_TRANSFERENCIA'
    return 'RECEITA_OUTROS'
  }
  if ([112, 121].includes(code)) return 'DESPESA_FORNECEDOR'
  if (code === 113) return 'DESPESA_PESSOAL'
  if ([120, 117].includes(code)) return 'DESPESA_TRANSFERENCIA'
  if (code === 126) return 'DESPESA_TRIBUTO'
  return 'DESPESA_OUTROS'
}

export function LancarNoLivroCaixaModal({
  movimento,
  churchId,
  planoDeContasOptions,
  formaPagamentoOptions,
  onSuccess,
  onClose,
}: LancarNoLivroCaixaModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defaultPlano = suggestPlano(movimento.category_code, movimento.credit_debit_type)
  const defaultObs = `Santander | ${movimento.account_id} | ${movimento.history_description ?? movimento.transaction_name ?? ''}`

  const [form, setForm] = useState<LancarNoLivroCaixaDto>({
    santander_movimento_id: movimento.id,
    church_id: churchId,
    plano_de_conta: defaultPlano,
    forma_pagamento: 'PIX',
    observacao: defaultObs,
    data_referencia: movimento.transaction_date.slice(0, 7).split('-').reverse().join('/'),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('mrm_token') ?? ''
      const res = await fetch(`${apiBase}/api/santander/lancar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao lançar')
      onSuccess(data.livro_caixa_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Inserir no Livro Caixa</h2>
            <p className="text-red-100 text-sm">Movimento Santander → Lançamento</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Resumo do movimento */}
        <div className="bg-gray-50 px-6 py-3 border-b">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs text-gray-500">Data</span>
              <p className="font-semibold text-gray-800">{fmtDate(movimento.transaction_date)}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500">Valor</span>
              <p className={`text-xl font-bold ${movimento.credit_debit_type === 'C' ? 'text-green-600' : 'text-red-600'}`}>
                {movimento.credit_debit_type === 'D' ? '− ' : '+ '}{fmt(movimento.amount)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-1 truncate">
            {movimento.history_description ?? movimento.transaction_name ?? '—'}
          </p>
          {movimento.document_number && (
            <p className="text-xs text-gray-400 font-mono">Doc: {movimento.document_number}</p>
          )}
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Tipo <span className="text-gray-400">(automático)</span>
            </label>
            <div className={`px-3 py-2 rounded border text-sm font-semibold ${
              movimento.credit_debit_type === 'C' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {movimento.credit_debit_type === 'C' ? 'RECEITA' : 'DESPESA'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Plano de Conta *</label>
            <select
              value={form.plano_de_conta}
              onChange={(e) => setForm((f) => ({ ...f, plano_de_conta: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {planoDeContasOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Forma de Pagamento</label>
            <select
              value={form.forma_pagamento}
              onChange={(e) => setForm((f) => ({ ...f, forma_pagamento: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {formaPagamentoOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Referência (MM/AAAA)</label>
            <input
              type="text"
              value={form.data_referencia ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, data_referencia: e.target.value }))}
              placeholder="06/2026"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Observação</label>
            <textarea
              value={form.observacao ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? 'Lançando...' : 'Confirmar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
