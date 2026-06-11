'use client'

import { useState, useRef } from 'react'
import { X, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import { apiBase } from '@/lib/apiBase'

interface ImportarFebrabanModalProps {
  credentials: { id: string; apelido: string }[]
  accounts: { id: string; display_name: string }[]
  onClose: () => void
  onImported: () => void
}

interface PreviewResult {
  total?: number
  valid?: number
  invalid?: number
  periodo?: string
}

interface ImportResult {
  imported?: number
  skipped?: number
  errors?: number
  message?: string
}

function getToken() { return localStorage.getItem('mrm_token') ?? '' }

export function ImportarFebrabanModal({ credentials, accounts, onClose, onImported }: ImportarFebrabanModalProps) {
  const [credentialId, setCredentialId] = useState(credentials[0]?.id ?? '')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(null)
    setResult(null)
    setError(null)

    if (!credentialId || !accountId) {
      setError('Selecione a credencial e a conta antes de escolher o arquivo')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', f)
      formData.append('credential_id', credentialId)
      formData.append('account_id', accountId)
      formData.append('preview', 'true')
      const res = await fetch(`${apiBase}/santander/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      })
      const json = await res.json() as PreviewResult & { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro no preview')
      setPreview(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo')
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!file || !credentialId || !accountId) return
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('credential_id', credentialId)
      formData.append('account_id', accountId)
      const res = await fetch(`${apiBase}/santander/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      })
      const json = await res.json() as ImportResult & { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro ao importar')
      setResult(json)
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200'
  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-red-600" />
            <h2 className="text-sm font-bold text-slate-800">Importar FEBRABAN 240</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {result ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-sm font-bold text-slate-800">Importação concluída!</p>
              {result.message && <p className="text-xs text-slate-500 text-center">{result.message}</p>}
              <div className="grid grid-cols-3 gap-6 text-center w-full">
                <div>
                  <p className="text-2xl font-bold text-green-600">{result.imported ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Importados</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-400">{result.skipped ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Ignorados</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{result.errors ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Erros</p>
                </div>
              </div>
              <button onClick={onClose}
                className="mt-2 h-8 px-6 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors">
                Fechar
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Credencial</label>
                  <select value={credentialId} onChange={(e) => setCredentialId(e.target.value)} className={inputCls}>
                    <option value="">— selecione —</option>
                    {credentials.map((c) => <option key={c.id} value={c.id}>{c.apelido}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Conta</label>
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
                    <option value="">— selecione —</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                  </select>
                </div>
              </div>

              <div
                onClick={() => fileRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-red-400 hover:bg-red-50 transition-colors"
              >
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                {file ? (
                  <p className="text-sm font-semibold text-slate-700">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-slate-500">Clique para selecionar arquivo</p>
                    <p className="text-xs text-slate-400 mt-1">.txt · .rem · .ret — máx 10 MB</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".txt,.rem,.ret" onChange={handleFileChange} className="hidden" />
              </div>

              {loading && (
                <p className="text-center text-xs text-slate-400 animate-pulse">Processando arquivo...</p>
              )}

              {preview && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-xs font-bold text-green-700 mb-2">Preview do arquivo</p>
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div>
                      <p className="text-base font-bold text-slate-800">{preview.total ?? 0}</p>
                      <p className="text-slate-500">Total</p>
                    </div>
                    <div>
                      <p className="text-base font-bold text-green-700">{preview.valid ?? 0}</p>
                      <p className="text-slate-500">Válidos</p>
                    </div>
                    <div>
                      <p className="text-base font-bold text-red-600">{preview.invalid ?? 0}</p>
                      <p className="text-slate-500">Inválidos</p>
                    </div>
                  </div>
                  {preview.periodo && (
                    <p className="text-[10px] text-green-600 mt-2 text-center">Período: {preview.periodo}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {!result && (
          <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
            <button onClick={onClose}
              className="h-8 px-4 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button onClick={() => void handleImport()}
              disabled={!file || !credentialId || !accountId || loading}
              className="h-8 px-4 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
              {loading ? 'Importando...' : 'Importar Movimentos'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
