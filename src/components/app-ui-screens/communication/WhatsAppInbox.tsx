'use client'

import {
  useState, useRef, useEffect, useCallback,
  KeyboardEvent, ChangeEvent,
} from 'react'
import {
  MessageSquare, Search, Send, Paperclip, MoreVertical,
  CheckCheck, Check, Clock, X, Plus, RefreshCw,
  Image as ImageIcon, Video, FileText, Mic, StopCircle,
  ChevronDown, Loader2, Volume2, Download, Trash2, Smartphone,
  ImageOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { useWhatsAppConversations } from '@/hooks/useWhatsAppConversations'
import { useWhatsAppMessages } from '@/hooks/useWhatsAppMessages'
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances'
import type { WhatsAppConversation, WhatsAppMessage } from '@/types/whatsapp'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function StatusIcon({ status, outbound }: { status: string; outbound?: boolean }) {
  const dim = outbound ? 'text-blue-200' : 'text-slate-400'
  if (status === 'read')      return <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
  if (status === 'delivered') return <CheckCheck className={`w-3.5 h-3.5 ${dim}`} />
  if (status === 'sent')      return <Check className={`w-3.5 h-3.5 ${dim}`} />
  if (status === 'failed')    return <X className="w-3.5 h-3.5 text-red-400" />
  return <Clock className={`w-3.5 h-3.5 ${dim} animate-pulse`} />
}

const AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-sky-600',
]
function avatarColor(str: string) {
  let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function getInitials(name?: string | null, phone?: string) {
  if (name) {
    const words = name.trim().split(/\s+/).filter(w => /[a-zA-ZÀ-ÿ]/i.test(w[0] ?? ''))
    return words.slice(0, 2).map(w => w[0].toUpperCase()).join('') || name[0]?.toUpperCase() || '?'
  }
  return phone ? phone.replace(/\D/g, '').slice(-2) : '?'
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg, onDelete }: { msg: WhatsAppMessage; onDelete: (id: string) => void }) {
  const [hover, setHover]       = useState(false)
  const [imgError, setImgError] = useState(false)
  const isOut     = msg.direction === 'outbound'
  const isDeleted = msg.status === 'deleted'

  const bubbleCls = isOut
    ? 'bg-blue-600 text-white rounded-br-none'
    : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-600'
  const timeClr = isOut ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'

  return (
    <div
      className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-1 px-2`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-end gap-1">
        {isOut && hover && !isDeleted && (
          <button onClick={() => onDelete(msg.id)} title="Excluir"
            className="p-1 rounded-full bg-white dark:bg-slate-700 shadow text-red-400 hover:text-red-600 flex-shrink-0 mb-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        <div className={`max-w-[72%] min-w-[80px] px-3 py-2 rounded-2xl shadow-sm ${bubbleCls}`}>
          {isDeleted ? (
            <p className="text-sm italic opacity-60">Mensagem excluída</p>
          ) : (
            <>
              {msg.type === 'image' && msg.media_url && !imgError && (
                <a href={msg.media_url} target="_blank" rel="noreferrer">
                  <img src={msg.media_url} alt="imagem"
                    className="max-w-full rounded-xl mb-1 max-h-56 object-cover cursor-zoom-in"
                    onError={() => setImgError(true)} />
                </a>
              )}
              {msg.type === 'image' && (imgError || !msg.media_url) && (
                <div className="flex items-center gap-2 py-1 opacity-60 text-xs">
                  <ImageOff className="w-4 h-4" /> Imagem indisponível
                </div>
              )}
              {msg.type === 'video' && msg.media_url && (
                <video controls src={msg.media_url} className="max-w-full rounded-xl mb-1 max-h-56" />
              )}
              {msg.type === 'audio' && msg.media_url && (
                <div className="flex items-center gap-2 py-1">
                  <Volume2 className="w-4 h-4 flex-shrink-0 opacity-70" />
                  <audio controls src={msg.media_url} className="h-8 max-w-full" />
                </div>
              )}
              {msg.type === 'document' && (
                <a href={msg.media_url ?? '#'} target="_blank" rel="noreferrer" download
                  className={`flex items-center gap-2 py-1 text-sm ${isOut ? 'text-blue-100 hover:text-white' : 'text-blue-600 dark:text-blue-400 hover:underline'}`}>
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate max-w-[180px]">{msg.content ?? 'documento'}</span>
                  <Download className="w-3.5 h-3.5 flex-shrink-0" />
                </a>
              )}
              {msg.type === 'sticker' && msg.media_url && (
                <img src={msg.media_url} alt="sticker" className="w-28 h-28 object-contain" />
              )}
              {msg.type !== 'document' && msg.content && (
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
              )}
            </>
          )}
          <div className={`flex items-center justify-end gap-1 mt-0.5 ${timeClr}`}>
            <span className="text-[10px]">{formatTime(msg.created_at)}</span>
            {isOut && !isDeleted && <StatusIcon status={msg.status} outbound />}
          </div>
        </div>

        {!isOut && hover && !isDeleted && (
          <button onClick={() => onDelete(msg.id)} title="Excluir"
            className="p-1 rounded-full bg-white dark:bg-slate-700 shadow text-red-400 hover:text-red-600 flex-shrink-0 mb-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── ConversationItem ──────────────────────────────────────────────────────────

function ConversationItem({ conv, active, onClick }: {
  conv: WhatsAppConversation; active: boolean; onClick: () => void
}) {
  const name     = conv.contact_name ?? conv.phone
  const initials = getInitials(conv.contact_name, conv.phone)
  const grad     = avatarColor(name)

  return (
    <button onClick={onClick}
      className={`w-full px-4 py-3 flex items-center gap-3 transition-colors border-b border-slate-100 dark:border-slate-700 text-left ${
        active
          ? 'bg-blue-50 dark:bg-slate-700 border-l-4 border-l-blue-500'
          : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
      }`}
    >
      <div className={`w-11 h-11 bg-gradient-to-br ${grad} rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{name}</p>
          <span className="text-[11px] text-slate-400 flex-shrink-0 ml-2">{formatTime(conv.last_message_at)}</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{conv.last_message ?? '...'}</p>
          {(conv.unread_count ?? 0) > 0 && (
            <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Audio recorder hook ───────────────────────────────────────────────────────

function useAudioRecorder() {
  const [recording, setRecording] = useState(false)
  const [duration, setDuration]   = useState(0)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mr = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(200)
      mediaRef.current = mr
      setRecording(true); setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch { toast.error('Permissão de microfone negada.') }
  }, [])

  const stop = useCallback((): Promise<File | null> => new Promise(resolve => {
    const mr = mediaRef.current
    if (!mr) return resolve(null)
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType })
      resolve(new File([blob], `audio-${Date.now()}.webm`, { type: mr.mimeType }))
      mr.stream.getTracks().forEach(t => t.stop())
    }
    mr.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false); setDuration(0)
  }), [])

  const cancel = useCallback(() => {
    const mr = mediaRef.current
    if (!mr) return
    mr.onstop = null; mr.stop()
    mr.stream.getTracks().forEach(t => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false); setDuration(0)
  }, [])

  const fmtDur = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  return { recording, duration: fmtDur(duration), start, stop, cancel }
}

// ── Main ──────────────────────────────────────────────────────────────────────

type StatusFilter = 'open' | 'closed' | 'all'
type AttachType   = 'image' | 'video' | 'document' | 'audio'

export default function WhatsAppInbox() {
  const {
    conversations, isLoading: convLoading, refetch,
    markAsRead, closeConversation, reopenConversation, createConversation,
  } = useWhatsAppConversations()
  const { instances } = useWhatsAppInstances()

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const selectedConv = conversations.find(c => c.id === selectedConvId) ?? null
  const { messages, isLoading: msgLoading, hasMore, loadMore, sendMessage } = useWhatsAppMessages(selectedConvId)

  const [text, setText]                   = useState('')
  const [sending, setSending]             = useState(false)
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('open')
  const [showNewConv, setShowNewConv]     = useState(false)
  const [newPhone, setNewPhone]           = useState('')
  const [newName, setNewName]             = useState('')
  const [newInstanceId, setNewInstanceId] = useState('')
  const [creatingConv, setCreatingConv]   = useState(false)
  const [showAttach, setShowAttach]       = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [showConvMenu, setShowConvMenu]   = useState(false)

  const imgRef = useRef<HTMLInputElement>(null)
  const vidRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)
  const audRef = useRef<HTMLInputElement>(null)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : ''
  const { recording, duration, start: startRec, stop: stopRec, cancel: cancelRec } = useAudioRecorder()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [text])

  const handleSelectConv = (conv: WhatsAppConversation) => {
    setSelectedConvId(conv.id)
    setShowConvMenu(false)
    if ((conv.unread_count ?? 0) > 0) markAsRead(conv.id)
  }

  const handleSend = async () => {
    const content = text.trim()
    if (!content || sending) return
    setSending(true); setText('')
    try { await sendMessage(content) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao enviar'); setText(content) }
    finally { setSending(false) }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const uploadAndSend = async (file: File, type: AttachType) => {
    if (!selectedConvId) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/whatsapp/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error ?? 'Falha no upload')
      }
      const { url, fileName } = await r.json()
      await sendMessage(fileName ?? file.name, type, { mediaUrl: url, fileName })
      toast.success('Arquivo enviado!')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao enviar arquivo')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, type: AttachType) => {
    const file = e.target.files?.[0]
    if (file) uploadAndSend(file, type)
    e.target.value = ''
  }

  const pickFile = (ref: React.RefObject<HTMLInputElement | null>) => {
    setShowAttach(false)
    setTimeout(() => ref.current?.click(), 10)
  }

  const handleStopRecording = async () => {
    const file = await stopRec()
    if (file) await uploadAndSend(file, 'audio')
  }

  const handleDeleteMessage = async (msgId: string) => {
    const res = await fetch(`/api/whatsapp/messages/${msgId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) { toast.error('Não foi possível excluir.'); return }
    toast.success('Mensagem excluída.')
  }

  const handleDeleteConversation = async () => {
    if (!selectedConvId) return
    setShowConvMenu(false)
    const res = await fetch(`/api/whatsapp/conversations/${selectedConvId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) { toast.error('Não foi possível excluir a conversa.'); return }
    setSelectedConvId(null)
    toast.success('Conversa excluída.')
  }

  const handleNewConversation = async () => {
    if (!newPhone || !newInstanceId) return
    setCreatingConv(true)
    try {
      const conv = await createConversation({
        instance_id: newInstanceId,
        phone: newPhone.replace(/\D/g, ''),
        contact_name: newName || undefined,
      })
      setSelectedConvId(conv.id)
      setShowNewConv(false); setNewPhone(''); setNewName('')
      setStatusFilter('open')
      toast.success('Conversa criada!')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao criar conversa') }
    finally { setCreatingConv(false) }
  }

  const filtered = conversations.filter(c => {
    if (statusFilter === 'open'   && c.status !== 'open')   return false
    if (statusFilter === 'closed' && c.status !== 'closed') return false
    if (!search) return true
    const q = search.toLowerCase()
    return (c.contact_name ?? '').toLowerCase().includes(q) || c.phone.includes(q) || (c.last_message ?? '').toLowerCase().includes(q)
  })

  const counts   = { open: conversations.filter(c => c.status === 'open').length, closed: conversations.filter(c => c.status === 'closed').length, all: conversations.length }
  const unread   = conversations.filter(c => (c.unread_count ?? 0) > 0).length
  const isClosed = selectedConv?.status === 'closed'

  const convInstance = selectedConv
    ? (selectedConv.instance ?? instances.find(i => i.id === selectedConv.instance_id))
    : null

  const convName = selectedConv ? (selectedConv.contact_name ?? selectedConv.phone) : ''
  const convGrad = selectedConv ? avatarColor(convName) : 'from-blue-500 to-blue-600'

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)', padding: '1rem' }}>

      {/* Hidden file inputs */}
      <input ref={imgRef} type="file" accept="image/*"                                         className="hidden" onChange={e => handleFileChange(e, 'image')} />
      <input ref={vidRef} type="file" accept="video/*"                                         className="hidden" onChange={e => handleFileChange(e, 'video')} />
      <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" className="hidden" onChange={e => handleFileChange(e, 'document')} />
      <input ref={audRef} type="file" accept="audio/*"                                         className="hidden" onChange={e => handleFileChange(e, 'audio')} />

      {/* Modal nova conversa */}
      {showNewConv && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewConv(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" /> Nova Conversa
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Número (DDI+DDD+número)</label>
                <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="5511999990001"
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nome (opcional)</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="João Silva"
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Instância WhatsApp</label>
                <select value={newInstanceId} onChange={e => setNewInstanceId(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecionar número...</option>
                  {instances.map(i => (
                    <option key={i.id} value={i.id}>{i.name}{i.phone_number ? ` — ${i.phone_number}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowNewConv(false)}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                Cancelar
              </button>
              <button onClick={handleNewConversation} disabled={!newPhone || !newInstanceId || creatingConv}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1">
                {creatingConv && <Loader2 className="w-4 h-4 animate-spin" />}
                {creatingConv ? 'Criando...' : 'Iniciar conversa'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="flex flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden min-h-0"
        onClick={() => { setShowAttach(false); setShowConvMenu(false) }}
      >
        {/* ── Sidebar ── */}
        <div className="w-[300px] border-r border-slate-200 dark:border-slate-700 flex flex-col flex-shrink-0 bg-white dark:bg-slate-800">
          <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">WhatsApp</p>
                {unread > 0 && <p className="text-[11px] text-blue-600 font-medium">{unread} não lida{unread > 1 ? 's' : ''}</p>}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={e => { e.stopPropagation(); refetch() }} title="Atualizar"
                className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={e => { e.stopPropagation(); setShowNewConv(true) }} title="Nova conversa"
                className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversas..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex border-b border-slate-100 dark:border-slate-700">
            {([
              { key: 'open',   label: 'Abertas',    count: counts.open },
              { key: 'closed', label: 'Encerradas', count: counts.closed },
              { key: 'all',    label: 'Todas',      count: counts.all },
            ] as { key: StatusFilter; label: string; count: number }[]).map(({ key, label, count }) => (
              <button key={key} onClick={() => setStatusFilter(key)}
                className={`flex-1 py-2 text-xs font-medium relative transition-colors ${statusFilter === key ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                {label}
                {count > 0 && (
                  <span className={`ml-1 text-[10px] px-1 rounded-full ${statusFilter === key ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>{count}</span>
                )}
                {statusFilter === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {convLoading ? (
              <div className="p-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Nenhuma conversa</p>
                <button onClick={() => setShowNewConv(true)} className="mt-3 text-xs text-blue-600 hover:underline">+ Nova conversa</button>
              </div>
            ) : (
              filtered.map(conv => (
                <ConversationItem key={conv.id} conv={conv} active={conv.id === selectedConvId} onClick={() => handleSelectConv(conv)} />
              ))
            )}
          </div>
        </div>

        {/* ── Chat Area ── */}
        {selectedConv ? (
          <div className="flex-1 flex flex-col min-w-0 min-h-0">

            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 bg-gradient-to-br ${convGrad} rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                  {getInitials(selectedConv.contact_name, selectedConv.phone)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {selectedConv.contact_name ?? selectedConv.phone}
                  </p>
                  {selectedConv.contact_name && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{selectedConv.phone}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {convInstance && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <Smartphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <div className="text-right">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 leading-none">{convInstance.name}</p>
                      {convInstance.phone_number && (
                        <p className="text-[10px] text-blue-500 dark:text-blue-400 leading-none mt-0.5">{convInstance.phone_number}</p>
                      )}
                    </div>
                  </div>
                )}

                {isClosed ? (
                  <button onClick={() => reopenConversation(selectedConv.id)}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                    Reabrir
                  </button>
                ) : (
                  <button onClick={() => closeConversation(selectedConv.id)}
                    className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium">
                    Encerrar
                  </button>
                )}

                <div className="relative">
                  <button onClick={e => { e.stopPropagation(); setShowConvMenu(v => !v) }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <MoreVertical className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  </button>
                  {showConvMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-30 min-w-[180px]"
                      onClick={e => e.stopPropagation()}>
                      <button onClick={handleDeleteConversation}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 className="w-4 h-4" /> Excluir conversa
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="text-center py-1.5 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
                <button onClick={loadMore} disabled={msgLoading} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mx-auto">
                  {msgLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
                  Carregar anteriores
                </button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-4 bg-slate-100 dark:bg-slate-900 min-h-0">
              {msgLoading && messages.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-8">Nenhuma mensagem ainda.</div>
              ) : (
                messages.map(msg => <MessageBubble key={msg.id} msg={msg} onDelete={handleDeleteMessage} />)
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 relative flex-shrink-0">
              {uploading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300 z-10">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> Enviando arquivo...
                </div>
              )}

              {isClosed && (
                <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-2 mb-2 text-sm text-amber-700 dark:text-amber-400">
                  <span>Conversa encerrada</span>
                  <button onClick={() => reopenConversation(selectedConv.id)}
                    className="ml-3 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 font-medium">
                    Reabrir para responder
                  </button>
                </div>
              )}

              {recording ? (
                <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl border border-red-200 dark:border-red-700">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-red-600 dark:text-red-400 font-mono font-medium">{duration}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex-1">Gravando áudio...</span>
                  <button onClick={cancelRec} className="p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
                  <button onClick={handleStopRecording} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 flex items-center gap-1">
                    <StopCircle className="w-3.5 h-3.5" /> Enviar
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setShowAttach(v => !v) }}
                      disabled={isClosed}
                      className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-40"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>

                    {showAttach && (
                      <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-2 z-30 min-w-[210px]"
                        onClick={e => e.stopPropagation()}>
                        {([
                          { icon: ImageIcon, label: 'Imagem',              color: 'text-violet-500', ref: imgRef },
                          { icon: Video,     label: 'Vídeo',               color: 'text-red-500',    ref: vidRef },
                          { icon: FileText,  label: 'Documento',           color: 'text-blue-500',   ref: docRef },
                          { icon: Volume2,   label: 'Áudio do computador', color: 'text-orange-500', ref: audRef },
                        ]).map(({ icon: Icon, label, color, ref }) => (
                          <button key={label} onClick={() => pickFile(ref)}
                            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200">
                            <Icon className={`w-5 h-5 ${color}`} /> {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isClosed ? 'Reabra a conversa para enviar mensagens' : 'Digite uma mensagem... (Enter para enviar)'}
                    disabled={isClosed || sending}
                    rows={1}
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ minHeight: '42px', maxHeight: '120px' }}
                  />

                  {text.trim() ? (
                    <button onClick={handleSend} disabled={sending || isClosed}
                      className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 flex-shrink-0">
                      {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  ) : (
                    <button onClick={startRec} disabled={isClosed}
                      className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 flex-shrink-0">
                      <Mic className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-10 h-10 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-600 dark:text-slate-300 text-lg">WhatsApp Inbox</p>
            <p className="text-sm mt-1 text-slate-400 dark:text-slate-500 text-center max-w-xs">Selecione uma conversa ou inicie uma nova.</p>
            <button onClick={() => setShowNewConv(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Nova Conversa
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
