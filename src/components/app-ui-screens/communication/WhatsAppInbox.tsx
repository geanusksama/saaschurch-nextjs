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

function StatusIcon({ status }: { status: string }) {
  if (status === 'read')      return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
  if (status === 'sent')      return <Check className="w-3.5 h-3.5 text-slate-400" />
  if (status === 'failed')    return <X className="w-3.5 h-3.5 text-red-500" />
  return <Clock className="w-3.5 h-3.5 text-slate-300 animate-pulse" />
}

function getInitials(name?: string | null, phone?: string) {
  const src = (name ?? phone ?? '??').trim()
  const isPhone = /^\d+$/.test(src.replace(/\D/g, '')) && src.replace(/\D/g, '').length > 6
  return isPhone
    ? src.replace(/\D/g, '').slice(-2)
    : src.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg, onDelete }: { msg: WhatsAppMessage; onDelete: (id: string) => void }) {
  const [hover, setHover] = useState(false)
  const isOut     = msg.direction === 'outbound'
  const isDeleted = msg.status === 'deleted'
  const base      = isOut
    ? 'bg-[#dcf8c6] text-slate-900 rounded-br-none'
    : 'bg-white text-slate-900 rounded-bl-none border border-slate-100'

  return (
    <div
      className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-1 px-2 group`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-end gap-1">
        {isOut && hover && !isDeleted && (
          <button onClick={() => onDelete(msg.id)} title="Excluir"
            className="p-1 rounded-full bg-white shadow text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 mb-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        <div className={`max-w-[72%] px-3 py-2 rounded-2xl shadow-sm ${base}`}>
          {isDeleted ? (
            <p className="text-sm italic text-slate-400">Mensagem excluída</p>
          ) : (
            <>
              {msg.type === 'image' && msg.media_url && (
                <a href={msg.media_url} target="_blank" rel="noreferrer">
                  <img src={msg.media_url} alt="imagem" className="max-w-full rounded-xl mb-1 max-h-56 object-cover cursor-zoom-in" />
                </a>
              )}
              {msg.type === 'video' && msg.media_url && (
                <video controls src={msg.media_url} className="max-w-full rounded-xl mb-1 max-h-56" />
              )}
              {msg.type === 'audio' && msg.media_url && (
                <div className="flex items-center gap-2 py-1">
                  <Volume2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <audio controls src={msg.media_url} className="h-8 max-w-full" />
                </div>
              )}
              {msg.type === 'document' && (
                <a href={msg.media_url ?? '#'} target="_blank" rel="noreferrer" download
                  className="flex items-center gap-2 py-1 text-sm text-blue-600 hover:underline">
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate max-w-[180px]">{msg.content ?? 'documento'}</span>
                  <Download className="w-3.5 h-3.5 flex-shrink-0" />
                </a>
              )}
              {msg.type === 'sticker' && msg.media_url && (
                <img src={msg.media_url} alt="sticker" className="w-28 h-28 object-contain" />
              )}
              {(!msg.type || msg.type === 'text' || msg.type === 'link') && msg.content && (
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              )}
            </>
          )}
          <div className={`flex items-center justify-end gap-1 mt-0.5 ${isOut ? 'text-slate-500' : 'text-slate-400'}`}>
            <span className="text-[10px]">{formatTime(msg.created_at)}</span>
            {isOut && !isDeleted && <StatusIcon status={msg.status} />}
          </div>
        </div>

        {!isOut && hover && !isDeleted && (
          <button onClick={() => onDelete(msg.id)} title="Excluir"
            className="p-1 rounded-full bg-white shadow text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 mb-1">
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
  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 flex items-center gap-3 transition-colors border-b border-slate-100 text-left ${active ? 'bg-green-50 border-l-4 border-l-green-500' : 'hover:bg-slate-50'}`}
    >
      <div className="w-11 h-11 bg-gradient-to-br from-green-400 to-teal-500 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
        {getInitials(conv.contact_name, conv.phone)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="font-semibold text-slate-900 text-sm truncate">{conv.contact_name ?? conv.phone}</p>
          <span className="text-[11px] text-slate-400 flex-shrink-0 ml-2">{formatTime(conv.last_message_at)}</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-slate-500 truncate">{conv.last_message ?? '...'}</p>
          {(conv.unread_count ?? 0) > 0 && (
            <span className="bg-green-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
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

  const [text, setText]                       = useState('')
  const [sending, setSending]                 = useState(false)
  const [search, setSearch]                   = useState('')
  const [statusFilter, setStatusFilter]       = useState<StatusFilter>('open')
  const [showNewConv, setShowNewConv]         = useState(false)
  const [newPhone, setNewPhone]               = useState('')
  const [newName, setNewName]                 = useState('')
  const [newInstanceId, setNewInstanceId]     = useState('')
  const [creatingConv, setCreatingConv]       = useState(false)
  const [showAttach, setShowAttach]           = useState(false)
  const [uploading, setUploading]             = useState(false)

  // File input refs — ficam no pai para não serem desmontados ao fechar o menu
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

  // Abre o file picker correto e fecha o menu
  const pickFile = (ref: React.RefObject<HTMLInputElement | null>) => {
    setShowAttach(false)
    // pequeno delay para garantir que o menu não bloqueie o picker
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

  // Instância da conversa selecionada (do join ou da lista de instâncias)
  const convInstance = selectedConv
    ? (selectedConv.instance ?? instances.find(i => i.id === selectedConv.instance_id))
    : null

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)', padding: '1rem' }}>

      {/* Hidden file inputs — FORA do menu para não serem desmontados */}
      <input ref={imgRef} type="file" accept="image/*"                                        className="hidden" onChange={e => handleFileChange(e, 'image')} />
      <input ref={vidRef} type="file" accept="video/*"                                        className="hidden" onChange={e => handleFileChange(e, 'video')} />
      <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" className="hidden" onChange={e => handleFileChange(e, 'document')} />
      <input ref={audRef} type="file" accept="audio/*"                                        className="hidden" onChange={e => handleFileChange(e, 'audio')} />

      {/* Modal nova conversa */}
      {showNewConv && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewConv(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-500" /> Nova Conversa
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Número (DDI+DDD+número)</label>
                <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="5511999990001"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome (opcional)</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="João Silva"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Número WhatsApp (instância)</label>
                <select value={newInstanceId} onChange={e => setNewInstanceId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                  <option value="">Selecionar número...</option>
                  {instances.map(i => (
                    <option key={i.id} value={i.id}>{i.name}{i.phone_number ? ` — ${i.phone_number}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowNewConv(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
              <button onClick={handleNewConversation} disabled={!newPhone || !newInstanceId || creatingConv}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-1">
                {creatingConv && <Loader2 className="w-4 h-4 animate-spin" />}
                {creatingConv ? 'Criando...' : 'Iniciar conversa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat container */}
      <div className="flex flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden min-h-0" onClick={() => setShowAttach(false)}>

        {/* ── Sidebar ── */}
        <div className="w-[300px] border-r border-slate-200 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">WhatsApp</p>
                {unread > 0 && <p className="text-[11px] text-green-600 font-medium">{unread} não lida{unread > 1 ? 's' : ''}</p>}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={e => { e.stopPropagation(); refetch() }} title="Atualizar" className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={e => { e.stopPropagation(); setShowNewConv(true) }} title="Nova conversa" className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversas..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>

          <div className="flex border-b border-slate-100">
            {([
              { key: 'open',   label: 'Abertas',    count: counts.open },
              { key: 'closed', label: 'Encerradas', count: counts.closed },
              { key: 'all',    label: 'Todas',      count: counts.all },
            ] as { key: StatusFilter; label: string; count: number }[]).map(({ key, label, count }) => (
              <button key={key} onClick={() => setStatusFilter(key)}
                className={`flex-1 py-2 text-xs font-medium relative transition-colors ${statusFilter === key ? 'text-green-600' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
                {count > 0 && (
                  <span className={`ml-1 text-[10px] px-1 rounded-full ${statusFilter === key ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                )}
                {statusFilter === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500" />}
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
                <button onClick={() => setShowNewConv(true)} className="mt-3 text-xs text-green-600 hover:underline">+ Nova conversa</button>
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

            {/* Header com info da instância */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-[#f0f2f5] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-teal-500 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {getInitials(selectedConv.contact_name, selectedConv.phone)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{selectedConv.contact_name ?? selectedConv.phone}</p>
                  <p className="text-[11px] text-slate-500">{selectedConv.phone}</p>
                </div>
              </div>

              {/* Instância ativa */}
              <div className="flex items-center gap-2">
                {convInstance && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-lg">
                    <Smartphone className="w-3.5 h-3.5 text-green-600" />
                    <div className="text-right">
                      <p className="text-xs font-medium text-green-700 leading-none">{convInstance.name}</p>
                      {convInstance.phone_number && (
                        <p className="text-[10px] text-green-500 leading-none mt-0.5">{convInstance.phone_number}</p>
                      )}
                    </div>
                  </div>
                )}
                {isClosed ? (
                  <button onClick={() => reopenConversation(selectedConv.id)}
                    className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium">
                    Reabrir
                  </button>
                ) : (
                  <button onClick={() => closeConversation(selectedConv.id)}
                    className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg font-medium">
                    Encerrar
                  </button>
                )}
                <button className="p-1.5 hover:bg-slate-200 rounded-lg">
                  <MoreVertical className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="text-center py-1.5 bg-[#e5ddd5]/50 flex-shrink-0">
                <button onClick={loadMore} disabled={msgLoading} className="text-xs text-blue-500 hover:underline flex items-center gap-1 mx-auto">
                  {msgLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
                  Carregar anteriores
                </button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-4 bg-[#e5ddd5] min-h-0" style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9bfb5' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
            }}>
              {msgLoading && messages.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8">Nenhuma mensagem ainda. Diga olá! 👋</div>
              ) : (
                messages.map(msg => <MessageBubble key={msg.id} msg={msg} onDelete={handleDeleteMessage} />)
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-[#f0f2f5] border-t border-slate-200 relative flex-shrink-0">
              {uploading && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center gap-2 text-sm text-slate-600 z-10">
                  <Loader2 className="w-5 h-5 animate-spin text-green-500" /> Enviando arquivo...
                </div>
              )}

              {isClosed && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-2 text-sm text-amber-700">
                  <span>Conversa encerrada</span>
                  <button onClick={() => reopenConversation(selectedConv.id)}
                    className="ml-3 px-3 py-1 bg-green-500 text-white rounded-lg text-xs hover:bg-green-600 font-medium">
                    Reabrir para responder
                  </button>
                </div>
              )}

              {recording ? (
                <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-xl border border-red-200">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-red-600 font-mono font-medium">{duration}</span>
                  <span className="text-xs text-slate-500 flex-1">Gravando áudio...</span>
                  <button onClick={cancelRec} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
                  <button onClick={handleStopRecording} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 flex items-center gap-1">
                    <StopCircle className="w-3.5 h-3.5" /> Enviar
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  {/* Attach button + menu */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setShowAttach(v => !v) }}
                      disabled={isClosed}
                      title="Anexar arquivo"
                      className="p-2 text-slate-500 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-40"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>

                    {showAttach && (
                      <div
                        className="absolute bottom-full mb-2 left-0 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-30 min-w-[210px]"
                        onClick={e => e.stopPropagation()}
                      >
                        {([
                          { icon: ImageIcon, label: 'Imagem',              color: 'text-purple-500', ref: imgRef, type: 'image' as AttachType },
                          { icon: Video,     label: 'Vídeo',               color: 'text-red-500',    ref: vidRef, type: 'video' as AttachType },
                          { icon: FileText,  label: 'Documento',           color: 'text-blue-500',   ref: docRef, type: 'document' as AttachType },
                          { icon: Volume2,   label: 'Áudio do computador', color: 'text-orange-500', ref: audRef, type: 'audio' as AttachType },
                        ]).map(({ icon: Icon, label, color, ref }) => (
                          <button key={label} onClick={() => pickFile(ref)}
                            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-sm text-slate-700">
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
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none overflow-y-auto disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    style={{ minHeight: '42px', maxHeight: '120px' }}
                  />

                  {text.trim() ? (
                    <button onClick={handleSend} disabled={sending || isClosed}
                      className="p-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 flex-shrink-0">
                      {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  ) : (
                    <button onClick={startRec} disabled={isClosed}
                      className="p-2.5 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 disabled:opacity-40 flex-shrink-0">
                      <Mic className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5]">
            <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-10 h-10 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-600 text-lg">WhatsApp Inbox</p>
            <p className="text-sm mt-1 text-slate-400 text-center max-w-xs">Selecione uma conversa ou inicie uma nova.</p>
            <button onClick={() => setShowNewConv(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium">
              <Plus className="w-4 h-4" /> Nova Conversa
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
