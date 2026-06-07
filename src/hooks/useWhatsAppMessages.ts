'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { WhatsAppMessage } from '@/types/whatsapp'

const PAGE_SIZE = 50

export function useWhatsAppMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const channelRef = useRef<ReturnType<typeof createSupabaseBrowserClient>['channel'] | null>(null)

  const getToken = () => localStorage.getItem('mrm_token') ?? ''

  const fetchMessages = useCallback(async (convId: string, off = 0) => {
    setIsLoading(true)
    try {
      const sp = new URLSearchParams({ conversationId: convId, limit: String(PAGE_SIZE), offset: String(off) })
      const res = await fetch(`/api/whatsapp/messages?${sp}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setMessages(off === 0 ? data.messages : prev => [...data.messages, ...prev])
      setHasMore(data.hasMore)
      setOffset(off + PAGE_SIZE)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Reset e recarrega quando muda a conversa
  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      setHasMore(false)
      setOffset(0)
      return
    }

    setMessages([])
    setOffset(0)
    fetchMessages(conversationId, 0)

    const supabase = createSupabaseBrowserClient()

    // Realtime: novas mensagens chegando
    const channel = supabase
      .channel(`whatsapp_messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => {
          const exists = prev.some(m => m.id === payload.new.id)
          if (exists) return prev
          return [...prev, payload.new as WhatsAppMessage]
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...(payload.new as WhatsAppMessage) } : m))
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (conversationId && hasMore && !isLoading) {
      fetchMessages(conversationId, offset)
    }
  }, [conversationId, hasMore, isLoading, offset, fetchMessages])

  const sendMessage = useCallback(async (content: string, type = 'text', extras?: {
    mediaUrl?: string; caption?: string; fileName?: string
    replyToId?: string; replyToContent?: string; replyToSender?: string
  }) => {
    if (!conversationId) return

    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, content, type, ...extras }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Falha ao enviar mensagem')
    }
    return res.json()
  }, [conversationId])

  return { messages, isLoading, hasMore, loadMore, sendMessage }
}
