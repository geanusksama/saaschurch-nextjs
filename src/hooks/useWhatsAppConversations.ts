'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { WhatsAppConversation, ConversationFilters } from '@/types/whatsapp'

export function useWhatsAppConversations(initialFilters?: ConversationFilters) {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ConversationFilters>(initialFilters ?? {})
  const channelRef = useRef<ReturnType<typeof createSupabaseBrowserClient>['channel'] | null>(null)

  const getToken = () => localStorage.getItem('mrm_token') ?? ''

  const fetchConversations = useCallback(async (f?: ConversationFilters) => {
    setIsLoading(true)
    setError(null)
    const active = f ?? filters
    const sp = new URLSearchParams()
    if (active.status) sp.set('status', active.status)
    if (active.instanceId) sp.set('instanceId', active.instanceId)
    if (active.search) sp.set('search', active.search)

    try {
      const res = await fetch(`/api/whatsapp/conversations?${sp}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('Falha ao buscar conversas')
      setConversations(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  const updateFilters = useCallback((newFilters: ConversationFilters) => {
    setFilters(newFilters)
    fetchConversations(newFilters)
  }, [fetchConversations])

  // Realtime: escuta INSERT e UPDATE em whatsapp_conversations
  useEffect(() => {
    fetchConversations()
    const supabase = createSupabaseBrowserClient()

    const channel = supabase
      .channel('whatsapp_conversations_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations' }, (payload) => {
        setConversations(prev => {
          if (prev.some(c => c.id === (payload.new as WhatsAppConversation).id)) return prev
          return [payload.new as WhatsAppConversation, ...prev]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations' }, (payload) => {
        setConversations(prev =>
          prev.map(c => c.id === payload.new.id ? { ...c, ...(payload.new as WhatsAppConversation) } : c)
             .sort((a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime())
        )
      })
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const markAsRead = useCallback(async (id: string) => {
    const res = await fetch(`/api/whatsapp/conversations/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ unread_count: 0 }),
    })
    if (res.ok) {
      setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_count: 0 } : c))
    }
  }, [])

  const closeConversation = useCallback(async (id: string) => {
    await fetch(`/api/whatsapp/conversations/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    })
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'closed' } : c))
  }, [])

  const reopenConversation = useCallback(async (id: string) => {
    await fetch(`/api/whatsapp/conversations/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'open' }),
    })
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'open' } : c))
  }, [])

  const createConversation = useCallback(async (data: { instance_id: string; phone: string; contact_name?: string }) => {
    const res = await fetch('/api/whatsapp/conversations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Falha ao criar conversa')
    const conv = await res.json()
    setConversations(prev => prev.some(c => c.id === conv.id) ? prev : [conv, ...prev])
    return conv as WhatsAppConversation
  }, [])

  return { conversations, isLoading, error, filters, setFilters: updateFilters, refetch: fetchConversations, markAsRead, closeConversation, reopenConversation, createConversation }
}
