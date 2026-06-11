'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Eye, EyeOff, AlertCircle, RefreshCw } from 'lucide-react'
import { apiBase } from '@/lib/apiBase'
import type { SantanderCredentialDto } from '../dtos/santander.dto'

interface CredenciaisModalProps {
  onClose: () => void
  onUpdated: () => void
}

function getToken() { return localStorage.getItem('mrm_token') ?? '' }

export function CredenciaisModal({ onClose, onUpdated }: CredenciaisModalProps) {
  const [credentials, setCredentials] = useState<SantanderCredentialDto[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)

  const [form, setForm] = useState({
    apelido: '',
    client_id: '',
    client_secret: '',
    ambiente: 'sandbox' as 'sandbox' | 'producao',
    certificate_public: '',
    certificate_private: '',
  })

  async function loadCredentials() {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/santander/credentials`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const json = await res.json() as { credentials?: SantanderCredentialDto[] }
      setCredentials(Array.isArray(json.credentials) ? json.credentials : [])
    } catch {
      setError('Erro ao carregar credenciais')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadCredentials() }, [])

  async function handleSave() {
    if (!form.client_id.trim() || !form.client_secret.trim()) {
      setError('ClientID e Client Secret são obrigatórios')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, string> = {
        apelido: form.apelido || `Conta ${form.ambiente}`,
        client_id: form.client_id.trim(),
        client_secret: form.client_secret,
        ambiente: form.ambiente,
      }
      if (form.certificate_public.trim()) body.certificate_public = form.certificate_public.trim()
      if (form.certificate_private.trim()) body.certificate_private = form.certificate_private.trim()

      const res = await fetch(`${apiBase}/santander/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')
      setAdding(false)
      setForm({ apelido: '', client_id: '', client_secret: '', ambiente: 'sandbox', certificate_public: '', certificate_private: '' })
      void loadCredentials()
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200'
  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <img src="/santander.png" alt="" className="h-5 w-5 object-contain" />
            <h2 className="text-sm font-bold text-slate-800">Credenciais Santander</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />)}
            </div>
          ) : credentials.length === 0 && !adding ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400 mb-3">Nenhuma credencial cadastrada.</p>
              <p className="text-xs text-slate-400">
                Obtenha seu ClientID e Client Secret no portal{' '}
                <span className="font-semibold">developer.santander.com.br</span>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {credentials.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{c.apelido}</p>
                    <p className="text-xs text-slate-500">
                      {c.ambiente === 'producao' ? '🔴 Produção' : '🟡 Sandbox'}{' '}
                      · {c.client_id_masked ?? '—'}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                    {c.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {adding && (
            <div className="space-y-3 border border-slate-200 rounded-lg p-4 bg-slate-50">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Nova Credencial</h3>

              <div>
                <label className={labelCls}>Apelido</label>
                <input value={form.apelido} onChange={(e) => setForm((f) => ({ ...f, apelido: e.target.value }))}
                  placeholder="Ex: Conta Principal" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Client ID *</label>
                <input value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                  placeholder="Client ID do portal Santander" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Client Secret *</label>
                <div className="relative">
                  <input type={showSecret ? 'text' : 'password'} value={form.client_secret}
                    onChange={(e) => setForm((f) => ({ ...f, client_secret: e.target.value }))}
                    placeholder="Client Secret" className={`${inputCls} pr-8`} />
                  <button type="button" onClick={() => setShowSecret((s) => !s)}
                    className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600">
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Ambiente *</label>
                <select value={form.ambiente} onChange={(e) => setForm((f) => ({ ...f, ambiente: e.target.value as 'sandbox' | 'producao' }))}
                  className={inputCls}>
                  <option value="sandbox">Sandbox (Homologação)</option>
                  <option value="producao">Produção</option>
                </select>
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-700">
                  Certificados mTLS (opcional — usa arquivo do servidor por padrão)
                </summary>
                <div className="mt-3 space-y-2">
                  <div>
                    <label className={labelCls}>Certificado Público (PEM)</label>
                    <textarea value={form.certificate_public}
                      onChange={(e) => setForm((f) => ({ ...f, certificate_public: e.target.value }))}
                      rows={3} placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono outline-none focus:border-red-400" />
                  </div>
                  <div>
                    <label className={labelCls}>Chave Privada (PEM)</label>
                    <textarea value={form.certificate_private}
                      onChange={(e) => setForm((f) => ({ ...f, certificate_private: e.target.value }))}
                      rows={3} placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono outline-none focus:border-red-400" />
                  </div>
                </div>
              </details>

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 h-8 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button onClick={() => { setAdding(false); setError(null) }}
                  className="h-8 px-4 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center">
          {!adding ? (
            <button onClick={() => { setAdding(true); setError(null) }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors">
              <Plus className="h-3.5 w-3.5" />
              Nova Credencial
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={() => void loadCredentials()}
              className="h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Recarregar
            </button>
            <button onClick={onClose}
              className="h-8 px-4 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
