'use client'

import { useState, useCallback } from 'react'
import { ChevronLeft, Download, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { SantanderTable } from './SantanderTable'
import { LancarNoLivroCaixaModal } from './LancarNoLivroCaixaModal'
import { SantanderSummaryCards } from './SantanderSummaryCards'
import type { SantanderMovimentoDto, TransactionsResponseDto } from '../dtos/santander.dto'
import type { SantanderAccount } from './SantanderHomeView'
import { apiBase } from '@/lib/apiBase'

type Tab = 'conta' | 'pix' | 'cartoes'

interface SantanderExtratoViewProps {
  credentialId: string
  account: SantanderAccount
  permissions: string[]
  churchId: string
  planoDeContasOptions: { value: string; label: string }[]
  formaPagamentoOptions: { value: string; label: string }[]
  onBack: () => void
}

function getToken() { return localStorage.getItem('mrm_token') ?? '' }

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...options?.headers },
  })
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Erro na requisição')
  return data
}

function todayIso() { return new Date().toISOString().split('T')[0] }
function sevenDaysAgoIso() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}

function exportToCsv(movimentos: SantanderMovimentoDto[], tab: Tab) {
  const headers = ['Data', 'Tipo', 'Valor (R$)', 'Histórico', 'Documento', 'Categoria', 'Status']
  const rows = movimentos.map((m) => [
    m.transaction_date ?? '',
    m.credit_debit_type === 'C' ? 'Crédito' : 'Débito',
    m.amount?.toFixed(2).replace('.', ',') ?? '0,00',
    m.transaction_name ?? '',
    m.document_number ?? '',
    m.category_code ?? '',
    m.status ?? '',
  ])
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `santander_${tab}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const tabs: { key: Tab; label: string }[] = [
  { key: 'conta', label: 'Conta Corrente' },
  { key: 'pix',   label: 'PIX' },
  { key: 'cartoes', label: 'Cartões' },
]

export function SantanderExtratoView({
  credentialId,
  account,
  permissions,
  churchId,
  planoDeContasOptions,
  formaPagamentoOptions,
  onBack,
}: SantanderExtratoViewProps) {
  const [tab, setTab] = useState<Tab>('conta')
  const [from, setFrom] = useState(sevenDaysAgoIso())
  const [to, setTo]     = useState(todayIso())
  const [search, setSearch] = useState('')

  const [data, setData]     = useState<TransactionsResponseDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [lancarMv, setLancarMv] = useState<SantanderMovimentoDto | null>(null)

  const canSync     = permissions.includes('financeiro.santander.consultar')
  const canExport   = permissions.includes('financeiro.santander.exportar')

  const buscar = useCallback(async (sync = false) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        credential_id: credentialId,
        account_id: account.id,
        from,
        to,
        sync: sync ? 'true' : 'false',
      })
      if (tab === 'pix')    params.set('pix', 'true')
      if (tab === 'cartoes') params.set('type', 'debit')   // cartões PJ = débito

      const result = await apiFetch(`/santander/transactions?${params.toString()}`)
      setData(result as TransactionsResponseDto)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar movimentos')
    } finally {
      setLoading(false)
    }
  }, [credentialId, account.id, from, to, tab])

  const handleIgnorar = async (mv: SantanderMovimentoDto) => {
    if (!confirm(`Ignorar movimento de ${mv.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}?`)) return
    try {
      await apiFetch('/santander/conciliar', {
        method: 'POST',
        body: JSON.stringify({ santander_movimento_id: mv.id, livro_caixa_id: 0, tipo_match: 'manual', observacao: 'Ignorado' }),
      })
      void buscar(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ignorar')
    }
  }

  const handleDesfazer = async (mv: SantanderMovimentoDto) => {
    const concId = mv.conciliacao_id
    if (!concId) return
    if (!confirm('Desfazer a conciliação deste movimento?')) return
    try {
      await apiFetch(`/santander/conciliar?id=${concId}`, { method: 'DELETE' })
      void buscar(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desfazer')
    }
  }

  // Filtra por busca textual (client-side)
  const movimentosFiltrados = (data?.movimentos ?? []).filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.transaction_name?.toLowerCase().includes(q) ||
      m.document_number?.toLowerCase().includes(q) ||
      String(m.amount).includes(q)
    )
  })

  return (
    <div className="space-y-4 p-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Contas Disponíveis
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-xs text-slate-600 font-medium">{account.display_name}</span>
        <span className="text-slate-300">/</span>
        <span className="text-xs text-slate-400">Ag. {account.branch_code} · C/C {account.account_number}</span>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setData(null); setError(null) }}
              className={`px-5 py-3 text-xs font-semibold transition-colors border-b-2 ${
                tab === t.key
                  ? 'border-red-600 text-red-700 bg-red-50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">Período</label>
            <DateRangePicker from={from} to={to} onChangeFrom={setFrom} onChangeTo={setTo} />
          </div>

          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              {tab === 'pix' ? 'ID/Transação' : 'Buscar'}
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'pix' ? 'ID ou valor' : 'Histórico ou documento'}
              className="h-8 w-48 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200"
            />
          </div>

          <div className="flex gap-2 ml-auto">
            <button onClick={() => void buscar(false)} disabled={loading}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Filtrar'}
            </button>
            {canSync && (
              <button onClick={() => void buscar(true)} disabled={loading}
                className="flex items-center gap-2 h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 shadow-sm transition-colors">
                {loading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <img src="/santander-white.png" alt="" className="h-4 w-4 object-contain" />
                }
                {loading ? 'Consultando...' : 'Consultar Santander'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100">{error}</div>
        )}
      </div>

      {/* Cards de resumo */}
      <SantanderSummaryCards summary={data?.summary ?? null} loading={loading} />

      {/* Tabela de movimentos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tab === 'conta' && <TrendingUp className="h-4 w-4 text-slate-400" />}
            {tab === 'pix'   && <img src="/santander.png" alt="" className="h-4 w-4 object-contain opacity-60" />}
            {tab === 'cartoes' && <Minus className="h-4 w-4 text-slate-400" />}
            <h3 className="text-sm font-semibold text-slate-800">
              {tab === 'conta' && 'Extrato — Conta Corrente'}
              {tab === 'pix'   && 'Extrato PIX'}
              {tab === 'cartoes' && 'Extrato — Cartões'}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <span className="text-xs text-slate-400">{data.pagination.total} movimentos</span>
            )}
            {canExport && movimentosFiltrados.length > 0 && (
              <button onClick={() => exportToCsv(movimentosFiltrados, tab)}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                <Download className="h-3 w-3" />
                Exportar CSV
              </button>
            )}
          </div>
        </div>

        {!data && !loading && (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            {tab === 'pix' ? (
              <div className="space-y-1">
                <p className="font-medium">Extrato PIX</p>
                <p className="text-xs">Selecione o período e clique em "Consultar Santander"</p>
              </div>
            ) : tab === 'cartoes' ? (
              <div className="space-y-1">
                <p className="font-medium">Extrato de Cartões</p>
                <p className="text-xs">Transações de débito da conta — selecione o período e consulte</p>
              </div>
            ) : (
              <p>Selecione o período e clique em "Consultar Santander" ou "Filtrar"</p>
            )}
          </div>
        )}

        {(data || loading) && (
          <div className="p-2">
            <SantanderTable
              movimentos={movimentosFiltrados}
              loading={loading}
              permissions={permissions}
              onVerDetalhes={() => {}}
              onInserirLivroCaixa={setLancarMv}
              onConciliarManual={() => {}}
              onDesfazerConciliacao={handleDesfazer}
              onIgnorar={handleIgnorar}
            />
          </div>
        )}
      </div>

      {/* Rodapé estilo Santander */}
      <div className="text-center text-[10px] text-slate-400 py-2">
        Banco Santander (Brasil) S.A. · CNPJ: 90.400.888/0001-42
      </div>

      {lancarMv && (
        <LancarNoLivroCaixaModal
          movimento={lancarMv}
          churchId={churchId}
          planoDeContasOptions={planoDeContasOptions}
          formaPagamentoOptions={formaPagamentoOptions}
          onSuccess={(id) => { setLancarMv(null); alert(`Lançamento ID: ${id}`); void buscar(false) }}
          onClose={() => setLancarMv(null)}
        />
      )}
    </div>
  )
}
