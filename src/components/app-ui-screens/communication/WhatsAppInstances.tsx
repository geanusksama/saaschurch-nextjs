'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Smartphone, Plus, Trash2, RefreshCw, QrCode, CheckCircle,
  XCircle, Loader2, Wifi, WifiOff, AlertCircle, Users, Shield,
  MoreVertical, PowerOff, Pencil
} from 'lucide-react'
import { toast } from 'sonner'
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances'
import type { WhatsAppInstance } from '@/types/whatsapp'

// ── tipos ────────────────────────────────────────────────────────────────────

interface SystemUser {
  id: string
  fullName: string
  email: string
  profileType?: string | null
  role?: { id: string; name: string } | null
}

// ── helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WhatsAppInstance['status'] }) {
  const map: Record<string, { label: string; cls: string; Icon: React.FC<{ className?: string }> }> = {
    connected:    { label: 'Conectado',       cls: 'bg-green-100 text-green-700',  Icon: CheckCircle },
    disconnected: { label: 'Desconectado',    cls: 'bg-red-100 text-red-700',      Icon: XCircle },
    connecting:   { label: 'Conectando...',   cls: 'bg-yellow-100 text-yellow-700', Icon: Loader2 },
    qr_code:      { label: 'Aguard. QR Code', cls: 'bg-blue-100 text-blue-700',    Icon: QrCode },
  }
  const { label, cls, Icon } = map[status] ?? map.disconnected
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className={`bg-white border rounded-xl p-4 flex flex-col gap-1 ${color}`}>
      <span className="text-2xl font-bold text-slate-900">{value}</span>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  )
}

// ── QR Modal ─────────────────────────────────────────────────────────────────

function QrCodeModal({ qrCode, onClose }: { qrCode: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-slate-900 text-center mb-2">Escanear QR Code</h3>
        <p className="text-sm text-slate-500 text-center mb-4">
          WhatsApp → Menu → Aparelhos conectados → Conectar aparelho
        </p>
        <div className="flex items-center justify-center bg-slate-50 rounded-xl p-4">
          {qrCode.startsWith('data:image') ? (
            <img src={qrCode} alt="QR Code" className="w-48 h-48" />
          ) : (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
              alt="QR Code"
              className="w-48 h-48"
            />
          )}
        </div>
        <p className="text-xs text-slate-400 text-center mt-3">
          QR Code expira em alguns minutos. Atualize se necessário.
        </p>
        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}

// ── Users Modal ───────────────────────────────────────────────────────────────

function UsersModal({
  instance,
  onClose,
}: {
  instance: WhatsAppInstance
  onClose: () => void
}) {
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([])
  const [authorizedIds, setAuthorizedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterPerfil, setFilterPerfil] = useState('')
  const [filterFuncao, setFilterFuncao] = useState('')
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') : null

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // Role-group isolation helpers
  const currentMrmUser = (() => { try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; } })();
  const currentProfileType: string = currentMrmUser.profileType || '';
  const currentRoleName: string = currentMrmUser.roleName || currentMrmUser.role?.name || '';
  const isMasterOrAdmin = ['master', 'admin'].includes(currentProfileType);

  const getRoleGroup = (name: string): string | null => {
    const lower = name.toLowerCase();
    if (lower.includes('sec')) return 'sec';
    if (lower.includes('tes')) return 'tes';
    return null;
  };

  // Only master/admin bypass group isolation
  const currentGroup = isMasterOrAdmin ? null : getRoleGroup(currentRoleName);

  useEffect(() => {
    const activeFieldId = typeof window !== 'undefined' ? localStorage.getItem('mrm_active_field_id') || '' : ''
    const usersUrl = `/api/users?limit=200` + (activeFieldId ? `&campoId=${activeFieldId}` : '')

    Promise.all([
      fetch(usersUrl, { headers }).then(r => r.json()),
      fetch(`/api/whatsapp/instances/${instance.id}/users`, { headers }).then(r => r.json()),
    ]).then(([usersRes, authorizedRes]) => {
      setSystemUsers(Array.isArray(usersRes) ? usersRes : Array.isArray(usersRes?.users) ? usersRes.users : [])
      const ids = new Set<string>(
        Array.isArray(authorizedRes) ? authorizedRes.map((u: { user_id: string }) => u.user_id) : []
      )
      setAuthorizedIds(ids)
    }).catch(() => toast.error('Erro ao carregar usuários')).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id])

  const toggle = async (userId: string, checked: boolean) => {
    setSaving(userId)
    try {
      if (checked) {
        const res = await fetch(`/api/whatsapp/instances/${instance.id}/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ user_id: userId }),
        })
        if (!res.ok) throw new Error()
        setAuthorizedIds(prev => new Set([...prev, userId]))
        toast.success('Usuário autorizado!')
      } else {
        const res = await fetch(`/api/whatsapp/instances/${instance.id}/users?userId=${userId}`, {
          method: 'DELETE',
          headers,
        })
        if (!res.ok) throw new Error()
        setAuthorizedIds(prev => { const s = new Set(prev); s.delete(userId); return s })
        toast.success('Acesso revogado.')
      }
    } catch {
      toast.error('Erro ao atualizar permissão.')
    } finally {
      setSaving(null)
    }
  }

  const allRoles: string[] = Array.from(
    new Set(systemUsers.map((u: any) => u.role?.name).filter(Boolean))
  ) as string[];

  const filtered = systemUsers.filter(u => {
    const matchSearch =
      u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())

    const matchPerfil = !filterPerfil || u.profileType === filterPerfil

    const matchFuncao =
      !filterFuncao ||
      (filterFuncao === '__none__' ? !u.role : u.role?.name === filterFuncao)

    // Regra 1: Users below admin cannot see master accounts
    const matchMasterVisibility = isMasterOrAdmin || u.profileType !== 'master'

    // Regra 2: Role-group isolation (sec/tes)
    const matchGroup = !currentGroup || getRoleGroup(u.role?.name || '') === currentGroup

    return matchSearch && matchPerfil && matchFuncao && matchMasterVisibility && matchGroup
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-slate-900">Usuários autorizados</h3>
          </div>
          <p className="text-sm text-slate-500">
            Instância: <span className="font-medium text-slate-700">{instance.name}</span>
            {instance.phone_number && ` · ${instance.phone_number}`}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Apenas usuários marcados podem enviar mensagens por este número.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="px-5 pt-4 space-y-2.5">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar usuário..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filterPerfil}
              onChange={e => setFilterPerfil(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white text-slate-800"
            >
              <option value="">Todos os perfis</option>
              <option value="master">Master</option>
              <option value="admin">Administrador</option>
              <option value="campo">Campo</option>
              <option value="church">Igreja</option>
            </select>
            <select
              value={filterFuncao}
              onChange={e => setFilterFuncao(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white text-slate-800"
            >
              <option value="">Todas as funções</option>
              <option value="__none__">Sem função</option>
              {allRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {loading ? (
            <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">Nenhum usuário encontrado</div>
          ) : filtered.map(u => (
            <label
              key={u.id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              <div className="relative">
                {saving === u.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                ) : (
                  <input
                    type="checkbox"
                    checked={authorizedIds.has(u.id)}
                    onChange={e => toggle(u.id, e.target.checked)}
                    className="w-4 h-4 accent-purple-600"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{u.fullName}</p>
                <p className="text-xs text-slate-400 truncate">{u.email}</p>
              </div>
              {u.profileType && (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full capitalize flex-shrink-0">
                  {u.profileType}
                </span>
              )}
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">{authorizedIds.size} usuário(s) autorizado(s)</span>
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditInstanceModal({
  instance,
  onClose,
  onSave,
  onLoadDetails,
}: {
  instance: WhatsAppInstance
  onClose: () => void
  onSave: (data: { name: string; instance_id: string; token: string; client_token: string }) => Promise<void>
  onLoadDetails: () => Promise<WhatsAppInstance>
}) {
  const [form, setForm] = useState({ name: instance.name, instance_id: '', token: '', client_token: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    onLoadDetails()
      .then(details => {
        if (cancelled) return
        setForm({
          name: details.name ?? '',
          instance_id: details.instance_id ?? '',
          token: details.token ?? '',
          client_token: details.client_token ?? '',
        })
      })
      .catch(() => toast.error('Erro ao carregar dados da instância'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id])

  const handleSave = async () => {
    if (!form.name || !form.instance_id || !form.token || !form.client_token) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Pencil className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-slate-900">Editar instância</h3>
          </div>
        </div>
        {loading ? (
          <div className="py-10 flex flex-col items-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 gap-4">
            {[
              { label: 'Nome da instância',    key: 'name',         placeholder: 'Ex: Suporte, Vendas...', mono: false },
              { label: 'Instance ID (Z-API)',  key: 'instance_id',  placeholder: 'Ex: 3C16B27...',         mono: true  },
              { label: 'Token (Z-API)',         key: 'token',        placeholder: 'Token da instância',      mono: true  },
              { label: 'Client Token (Z-API)', key: 'client_token', placeholder: 'Security Token Z-API',    mono: true  },
            ].map(({ label, key, placeholder, mono }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className={`w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${mono ? 'font-mono' : ''}`}
                />
              </div>
            ))}
          </div>
        )}
        <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !form.name || !form.instance_id || !form.token || !form.client_token || saving}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row menu ──────────────────────────────────────────────────────────────────

function RowMenu({
  instance,
  onGetQr,
  onRefreshStatus,
  onDisconnect,
  onDelete,
  onManageUsers,
  onEdit,
}: {
  instance: WhatsAppInstance
  onGetQr: () => void
  onRefreshStatus: () => void
  onDisconnect: () => void
  onDelete: () => void
  onManageUsers: () => void
  onEdit: () => void
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const reposition = () => {
      if (!btnRef.current) return
      const rect = btnRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + 4, left: rect.right - 180 })
    }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + 4, left: rect.right - 180 })
    }
    setOpen(v => !v)
  }

  const item = (cb: () => void, label: string, Icon: React.FC<{ className?: string }>, cls = 'text-slate-700') => (
    <button
      onClick={() => { cb(); setOpen(false) }}
      className={`w-full px-4 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2 ${cls}`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  )

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={toggleOpen}
        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left }}
          className="bg-white border border-slate-200 rounded-xl shadow-lg z-[999] py-1 min-w-[180px]"
        >
          {item(onEdit, 'Editar instância', Pencil)}
          {item(onManageUsers, 'Gerenciar usuários', Users)}
          {item(onRefreshStatus, 'Verificar status', RefreshCw)}
          {instance.status !== 'connected' && item(onGetQr, 'Obter QR Code', QrCode)}
          {instance.status === 'connected' && item(onDisconnect, 'Desconectar', PowerOff, 'text-yellow-600')}
          <hr className="my-1 border-slate-100" />
          {item(onDelete, 'Excluir instância', Trash2, 'text-red-600')}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WhatsAppInstances() {
  const { instances, isLoading, createInstance, deleteInstance, getStatus, getQrCode, disconnectInstance, updateInstance, getInstanceDetails } =
    useWhatsAppInstances()

  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ name: '', instance_id: '', token: '', client_token: '' })
  const [creating, setCreating]   = useState(false)
  const [qrCode, setQrCode]       = useState<string | null>(null)
  const [pollingId, setPollingId] = useState<string | null>(null)
  const [usersInst, setUsersInst] = useState<WhatsAppInstance | null>(null)
  const [editInst, setEditInst]   = useState<WhatsAppInstance | null>(null)
  const pollingRef                = useRef<ReturnType<typeof setInterval> | null>(null)

  // stats
  const total      = instances.length
  const connected  = instances.filter(i => i.status === 'connected').length
  const disconnected = instances.filter(i => i.status === 'disconnected').length
  const inactive   = instances.filter(i => !i.is_active).length

  // Polling status durante QR
  useEffect(() => {
    if (!pollingId) {
      if (pollingRef.current) clearInterval(pollingRef.current)
      return
    }
    pollingRef.current = setInterval(async () => {
      const res = await getStatus(pollingId)
      if (res?.connected) { setPollingId(null); setQrCode(null) }
    }, 3000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [pollingId, getStatus])

  const handleCreate = async () => {
    if (!form.name || !form.instance_id || !form.token || !form.client_token) return
    setCreating(true)
    try {
      await createInstance(form)
      setForm({ name: '', instance_id: '', token: '', client_token: '' })
      setShowForm(false)
      toast.success('Instância criada! Clique em "QR Code" para conectar.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar instância')
    } finally {
      setCreating(false)
    }
  }

  const handleGetQr = async (id: string) => {
    const qr = await getQrCode(id)
    if (qr) { setQrCode(qr); setPollingId(id) }
    else toast.error('Não foi possível obter o QR Code. Verifique as credenciais.')
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Excluir "${name}"? Todas as conversas serão removidas.`)) return
    try {
      await deleteInstance(id)
      toast.success(`Instância "${name}" removida.`)
    } catch {
      toast.error('Erro ao excluir instância.')
    }
  }

  const handleEditSave = async (id: string, data: { name: string; instance_id: string; token: string; client_token: string }) => {
    try {
      await updateInstance(id, data)
      toast.success('Instância atualizada!')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar instância')
    }
  }

  return (
    <div className="p-6 space-y-6">
      {qrCode && <QrCodeModal qrCode={qrCode} onClose={() => { setQrCode(null); setPollingId(null) }} />}
      {usersInst && <UsersModal instance={usersInst} onClose={() => setUsersInst(null)} />}
      {editInst && (
        <EditInstanceModal
          instance={editInst}
          onClose={() => setEditInst(null)}
          onSave={data => handleEditSave(editInst.id, data)}
          onLoadDetails={() => getInstanceDetails(editInst.id)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Instâncias WhatsApp</h1>
            <p className="text-slate-500 text-sm">Gerencie números Z-API e controle de acesso por usuário</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm"
        >
          <Plus className="w-4 h-4" /> Nova Instância
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de instâncias" value={total} color="border-slate-200" />
        <StatCard label="Conectadas"           value={connected}    sub="ativas agora"      color="border-green-200" />
        <StatCard label="Desconectadas"        value={disconnected} sub="sem conexão"        color="border-red-200" />
        <StatCard label="Inativas"             value={inactive}     sub="desabilitadas"      color="border-slate-200" />
      </div>

      {/* Info Webhook */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex gap-3 text-sm text-blue-700">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Configure o webhook na Z-API</p>
          <p className="text-blue-600 mt-0.5">
            URL:{' '}
            <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">
              {typeof window !== 'undefined' ? window.location.origin : 'https://seu-dominio.com'}/api/whatsapp/webhook
            </code>
          </p>
        </div>
      </div>

      {/* Form nova instância */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Nova Instância Z-API</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Nome da instância',    key: 'name',         placeholder: 'Ex: Suporte, Vendas...', mono: false },
              { label: 'Instance ID (Z-API)',  key: 'instance_id',  placeholder: 'Ex: 3C16B27...',         mono: true  },
              { label: 'Token (Z-API)',         key: 'token',        placeholder: 'Token da instância',      mono: true  },
              { label: 'Client Token (Z-API)', key: 'client_token', placeholder: 'Security Token Z-API',    mono: true  },
            ].map(({ label, key, placeholder, mono }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className={`w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${mono ? 'font-mono' : ''}`}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!form.name || !form.instance_id || !form.token || !form.client_token || creating}
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              {creating ? 'Criando...' : 'Criar Instância'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">
          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" /> Carregando instâncias...
        </div>
      ) : instances.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma instância configurada</p>
          <p className="text-sm mt-1">Clique em "Nova Instância" para adicionar um número WhatsApp</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Instância</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Telefone</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Instance ID</th>
                <th className="px-4 py-3 text-center">Ativa</th>
                <th className="px-4 py-3 text-center">Usuários</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {instances.map(inst => (
                <tr key={inst.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Nome */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Smartphone className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{inst.name}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(inst.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge status={inst.status} />
                  </td>

                  {/* Telefone */}
                  <td className="px-4 py-3 hidden md:table-cell text-slate-600">
                    {inst.phone_number || <span className="text-slate-300">—</span>}
                  </td>

                  {/* Instance ID */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <code className="text-xs text-slate-500 font-mono">{inst.instance_id}</code>
                  </td>

                  {/* Ativa */}
                  <td className="px-4 py-3 text-center">
                    {inst.is_active
                      ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                      : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />}
                  </td>

                  {/* Usuários */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setUsersInst(inst)}
                      title="Gerenciar usuários autorizados"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium"
                    >
                      <Users className="w-3.5 h-3.5" /> Gerenciar
                    </button>
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {inst.status !== 'connected' && (
                        <button
                          onClick={() => handleGetQr(inst.id)}
                          title="Obter QR Code"
                          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                      )}
                      {inst.status === 'connected' && (
                        <button
                          onClick={() => disconnectInstance(inst.id)}
                          title="Desconectar"
                          className="p-1.5 rounded-lg text-yellow-500 hover:bg-yellow-50"
                        >
                          <WifiOff className="w-4 h-4" />
                        </button>
                      )}
                      <RowMenu
                        instance={inst}
                        onGetQr={() => handleGetQr(inst.id)}
                        onRefreshStatus={() => getStatus(inst.id)}
                        onDisconnect={() => disconnectInstance(inst.id)}
                        onDelete={() => handleDelete(inst.id, inst.name)}
                        onManageUsers={() => setUsersInst(inst)}
                        onEdit={() => setEditInst(inst)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
