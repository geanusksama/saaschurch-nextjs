'use client'

import React, { useState, useCallback } from 'react'
import { SantanderSummaryCards } from './SantanderSummaryCards'
import { SantanderTable } from './SantanderTable'
import { LancarNoLivroCaixaModal } from './LancarNoLivroCaixaModal'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import type { SantanderMovimentoDto, TransactionsResponseDto } from '../dtos/santander.dto'
import { apiBase } from '@/lib/apiBase'
import { Loader2 } from 'lucide-react'

interface Filters {
  credential_id: string
  account_id: string
  from: string
  to: string
  type: 'all' | 'credit' | 'debit' | 'pix'
  status: string
}

interface ConciliacaoSantanderProps {
  churchId: string
  credentials: { id: string; apelido: string }[]
  accounts: { id: string; display_name: string; branch_code: string; account_number: string }[]
  permissions: string[]
  planoDeContasOptions: { value: string; label: string }[]
  formaPagamentoOptions: { value: string; label: string }[]
}

function getToken() { return localStorage.getItem('mrm_token') ?? '' }

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...options?.headers },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erro na requisição')
  return data
}

function todayIso() { return new Date().toISOString().split('T')[0] }
function firstOfMonthIso() { const t = todayIso(); return t.slice(0, 8) + '01' }

const selectCls = 'h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200'
const labelCls = 'block text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1'

export function ConciliacaoSantander({
  churchId,
  credentials,
  accounts,
  permissions,
  planoDeContasOptions,
  formaPagamentoOptions,
}: ConciliacaoSantanderProps) {
  const [filters, setFilters] = useState<Filters>({
    credential_id: credentials[0]?.id ?? '',
    account_id: accounts[0]?.id ?? '',
    from: firstOfMonthIso(),
    to: todayIso(),
    type: 'all',
    status: '',
  })

  const [data, setData] = useState<TransactionsResponseDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lancarMovimento, setLancarMovimento] = useState<SantanderMovimentoDto | null>(null)

  const handleBuscar = useCallback(async (sync = false) => {
    if (!filters.credential_id || !filters.account_id || !filters.from) {
      setError('Selecione conta e período')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        credential_id: filters.credential_id,
        account_id: filters.account_id,
        from: filters.from,
        to: filters.to,
        sync: sync ? 'true' : 'false',
      })
      // PIX é filtrado localmente por transaction_name — API só aceita C/D
      if (filters.type === 'credit')  params.set('type', 'credit')
      if (filters.type === 'debit')   params.set('type', 'debit')
      if (filters.type === 'pix')     params.set('pix', 'true')
      if (filters.status) params.set('status', filters.status)

      const result = await apiFetch(`/santander/transactions?${params.toString()}`)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar movimentos')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const handleIgnorar = async (mv: SantanderMovimentoDto) => {
    if (!confirm(`Ignorar movimento de ${mv.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}?`)) return
    try {
      await apiFetch('/santander/conciliar', {
        method: 'POST',
        body: JSON.stringify({ santander_movimento_id: mv.id, livro_caixa_id: 0, tipo_match: 'manual', observacao: 'Ignorado pelo usuário' }),
      })
      handleBuscar(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ignorar')
    }
  }

  const handleLancarSuccess = (livro_caixa_id: number) => {
    setLancarMovimento(null)
    alert(`Lançamento criado com sucesso! ID: ${livro_caixa_id}`)
    handleBuscar(false)
  }

  return (
    <div className="space-y-4 p-4">

      {/* Barra de filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-4 py-3 border-b border-slate-100">

          {/* Credencial */}
          <div>
            <label className={labelCls}>Credencial</label>
            <select
              value={filters.credential_id}
              onChange={(e) => setFilters((f) => ({ ...f, credential_id: e.target.value }))}
              className={selectCls}
            >
              <option value="">— selecione —</option>
              {credentials.map((c) => (
                <option key={c.id} value={c.id}>{c.apelido}</option>
              ))}
            </select>
          </div>

          {/* Conta */}
          <div>
            <label className={labelCls}>Conta Santander</label>
            <select
              value={filters.account_id}
              onChange={(e) => setFilters((f) => ({ ...f, account_id: e.target.value }))}
              className={selectCls}
            >
              <option value="">— selecione —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.display_name}</option>
              ))}
            </select>
          </div>

          {/* Período — mesmo DateRangePicker do Livro Caixa */}
          <div>
            <label className={labelCls}>Período</label>
            <DateRangePicker
              from={filters.from}
              to={filters.to}
              onChangeFrom={(v) => setFilters((f) => ({ ...f, from: v }))}
              onChangeTo={(v) => setFilters((f) => ({ ...f, to: v }))}
            />
          </div>

          {/* Tipo */}
          <div>
            <label className={labelCls}>Tipo</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as Filters['type'] }))}
              className={selectCls}
            >
              <option value="all">Todos</option>
              <option value="credit">Crédito</option>
              <option value="debit">Débito</option>
              <option value="pix">PIX</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className={labelCls}>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className={selectCls}
            >
              <option value="">Todos</option>
              <option value="novo">Novo</option>
              <option value="sem_lancamento">Sem Lançamento</option>
              <option value="conciliado">Conciliado</option>
              <option value="lancado">Lançado</option>
              <option value="ignorado">Ignorado</option>
            </select>
          </div>

          {/* Botões */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => handleBuscar(false)}
              disabled={loading}
              className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Filtrar Local'}
            </button>

            {permissions.includes('financeiro.santander.consultar') && (
              <button
                onClick={() => handleBuscar(true)}
                disabled={loading}
                className="flex h-8 items-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 shadow-sm transition-colors"
              >
                {loading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <img src="/santander-white.png" alt="" className="h-4 w-4 object-contain" />
                }
                {loading ? 'Buscando...' : 'Buscar no Santander'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 text-xs text-red-700 bg-red-50 border-t border-red-100">
            {error}
          </div>
        )}
      </div>

      {/* Cards de resumo */}
      <SantanderSummaryCards summary={data?.summary ?? null} loading={loading} />

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Movimentos Santander</h3>
          {data && (
            <span className="text-xs text-slate-400">{data.pagination.total} movimentos</span>
          )}
        </div>
        <div className="p-2">
          <SantanderTable
            movimentos={data?.movimentos ?? []}
            loading={loading}
            permissions={permissions}
            onVerDetalhes={() => {}}
            onInserirLivroCaixa={setLancarMovimento}
            onConciliarManual={() => {}}
            onIgnorar={handleIgnorar}
          />
        </div>
      </div>

      {lancarMovimento && (
        <LancarNoLivroCaixaModal
          movimento={lancarMovimento}
          churchId={churchId}
          planoDeContasOptions={planoDeContasOptions}
          formaPagamentoOptions={formaPagamentoOptions}
          onSuccess={handleLancarSuccess}
          onClose={() => setLancarMovimento(null)}
        />
      )}
    </div>
  )
}
