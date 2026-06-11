'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, RefreshCw, Settings, Upload, ChevronRight, Building2 } from 'lucide-react'
import { apiBase } from '@/lib/apiBase'

export interface SantanderAccount {
  id: string
  display_name: string
  branch_code: string
  account_number: string
  account_digit: string | null
}

interface AccountWithBalance extends SantanderAccount {
  balance?: number | null
  balanceLoading?: boolean
  balanceError?: boolean
}

interface SantanderHomeViewProps {
  credentials: { id: string; apelido: string; ambiente: string }[]
  permissions: string[]
  onSelectAccount: (credentialId: string, account: SantanderAccount) => void
  onOpenConfig: () => void
  onOpenImport: (accounts: SantanderAccount[]) => void
}

function getToken() { return localStorage.getItem('mrm_token') ?? '' }

export function SantanderHomeView({
  credentials,
  permissions,
  onSelectAccount,
  onOpenConfig,
  onOpenImport,
}: SantanderHomeViewProps) {
  const [credentialId, setCredentialId] = useState(credentials[0]?.id ?? '')
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncingAccounts, setSyncingAccounts] = useState(false)

  const canConfig  = permissions.includes('financeiro.santander.configurar')
  const canImport  = permissions.includes('financeiro.santander.importar')
  const canSync    = permissions.includes('financeiro.santander.consultar')

  async function loadAccounts(sync = false) {
    if (!credentialId) return
    setLoading(true)
    setError(null)
    if (sync) setSyncingAccounts(true)
    try {
      const url = `${apiBase}/santander/accounts?credential_id=${credentialId}${sync ? '&sync=true' : ''}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
      const json = await res.json() as { accounts?: SantanderAccount[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar contas')
      setAccounts((json.accounts ?? []).map((a) => ({ ...a, balance: undefined })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar contas')
    } finally {
      setLoading(false)
      setSyncingAccounts(false)
    }
  }

  useEffect(() => { void loadAccounts() }, [credentialId])

  async function loadBalance(accountId: string) {
    setAccounts((prev) => prev.map((a) => a.id === accountId ? { ...a, balanceLoading: true, balanceError: false } : a))
    try {
      const res = await fetch(`${apiBase}/santander/balance?credential_id=${credentialId}&account_id=${accountId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const json = await res.json() as { balance?: { amount?: number }; error?: string }
      if (!res.ok) throw new Error(json.error)
      const amount = json.balance?.amount ?? null
      setAccounts((prev) => prev.map((a) => a.id === accountId ? { ...a, balance: amount, balanceLoading: false } : a))
    } catch {
      setAccounts((prev) => prev.map((a) => a.id === accountId ? { ...a, balance: undefined, balanceLoading: false, balanceError: true } : a))
    }
  }

  const currentCred = credentials.find((c) => c.id === credentialId)

  return (
    <div className="space-y-5 p-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/santander.png" alt="" className="h-7 w-7 object-contain" />
          <div>
            <h2 className="text-sm font-bold text-slate-800">Internet Banking Santander</h2>
            {currentCred && (
              <p className="text-xs text-slate-500">
                {currentCred.ambiente === 'producao' ? '🔴 Produção' : '🟡 Sandbox'} · {currentCred.apelido}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canImport && accounts.length > 0 && (
            <button onClick={() => onOpenImport(accounts)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              Importar FEBRABAN
            </button>
          )}
          {canConfig && (
            <button onClick={onOpenConfig}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
              <Settings className="h-3.5 w-3.5 text-slate-500" />
              Configurações
            </button>
          )}
        </div>
      </div>

      {/* Seletor de credencial */}
      {credentials.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">Empresa / Credencial:</label>
          <select value={credentialId} onChange={(e) => setCredentialId(e.target.value)}
            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-red-400">
            {credentials.map((c) => <option key={c.id} value={c.id}>{c.apelido}</option>)}
          </select>
        </div>
      )}

      {/* Título seção contas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Contas Disponíveis</h3>
          {canSync && (
            <button onClick={() => void loadAccounts(true)} disabled={syncingAccounts}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
              <RefreshCw className={`h-3 w-3 ${syncingAccounts ? 'animate-spin' : ''}`} />
              Sincronizar contas
            </button>
          )}
        </div>

        {error && (
          <div className="px-5 py-3 text-xs text-red-700 bg-red-50 border-b border-red-100">{error}</div>
        )}

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />)}
          </div>
        ) : accounts.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Building2 className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400 mb-1">Nenhuma conta cadastrada</p>
            {canSync && (
              <p className="text-xs text-slate-400">
                Clique em "Sincronizar contas" para buscar do Santander
              </p>
            )}
            {!canSync && (
              <p className="text-xs text-slate-400">Solicite ao administrador para sincronizar as contas</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onSelect={() => onSelectAccount(credentialId, account)}
                onLoadBalance={() => void loadBalance(account.id)}
                canSync={canSync}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AccountRow({
  account,
  onSelect,
  onLoadBalance,
  canSync,
}: {
  account: AccountWithBalance
  onSelect: () => void
  onLoadBalance: () => void
  canSync: boolean
}) {
  const [showBalance, setShowBalance] = useState(false)

  function handleToggleBalance(e: React.MouseEvent) {
    e.stopPropagation()
    if (!showBalance && account.balance === undefined && !account.balanceLoading) {
      onLoadBalance()
    }
    setShowBalance((v) => !v)
  }

  return (
    <div
      onClick={onSelect}
      className="flex items-center justify-between px-5 py-4 hover:bg-red-50 cursor-pointer group transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 group-hover:text-red-700 transition-colors">
            {account.display_name}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Ag. {account.branch_code} · C/C {account.account_number}
            {account.account_digit ? `-${account.account_digit}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {canSync && (
          <div className="text-right" onClick={(e) => e.stopPropagation()}>
            {account.balance !== undefined && showBalance ? (
              <p className="text-sm font-bold text-slate-800">
                {account.balance?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'}
              </p>
            ) : (
              <p className="text-xs text-slate-400">Saldo oculto</p>
            )}
            <button
              onClick={handleToggleBalance}
              disabled={account.balanceLoading}
              className="flex items-center gap-1 text-[10px] text-red-600 hover:text-red-700 mt-0.5 font-medium disabled:opacity-50"
            >
              {account.balanceLoading ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : showBalance ? (
                <><EyeOff className="h-3 w-3" /> Ocultar Saldo</>
              ) : (
                <><Eye className="h-3 w-3" /> Exibir Saldo</>
              )}
            </button>
            {account.balanceError && (
              <p className="text-[10px] text-red-400">Erro ao carregar</p>
            )}
          </div>
        )}
        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-red-400 transition-colors flex-shrink-0" />
      </div>
    </div>
  )
}
