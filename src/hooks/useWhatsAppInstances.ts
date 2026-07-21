'use client'

import { useState, useEffect, useCallback } from 'react'
import type { WhatsAppInstance } from '@/types/whatsapp'

export function useWhatsAppInstances() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInstances = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('mrm_token') ?? ''
      const res = await fetch('/api/whatsapp/instances', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Falha ao buscar instâncias')
      setInstances(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchInstances() }, [fetchInstances])

  const createInstance = useCallback(async (data: {
    name: string; instance_id: string; token: string; client_token: string
  }) => {
    const token = localStorage.getItem('mrm_token') ?? ''
    const res = await fetch('/api/whatsapp/instances', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Falha ao criar instância')
    }
    const created = await res.json()
    setInstances(prev => [...prev, created])
    return created as WhatsAppInstance
  }, [])

  const deleteInstance = useCallback(async (id: string) => {
    const token = localStorage.getItem('mrm_token') ?? ''
    const res = await fetch(`/api/whatsapp/instances/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Falha ao deletar instância')
    setInstances(prev => prev.filter(i => i.id !== id))
  }, [])

  const getStatus = useCallback(async (id: string) => {
    const token = localStorage.getItem('mrm_token') ?? ''
    const res = await fetch(`/api/whatsapp/instances/${id}?action=status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    setInstances(prev => prev.map(i => i.id === id ? { ...i, status: data.status, phone_number: data.phoneNumber } : i))
    return data
  }, [])

  const getInstanceDetails = useCallback(async (id: string) => {
    const token = localStorage.getItem('mrm_token') ?? ''
    const res = await fetch(`/api/whatsapp/instances/${id}?action=details`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Falha ao buscar dados da instância')
    return res.json() as Promise<WhatsAppInstance>
  }, [])

  const getQrCode = useCallback(async (id: string): Promise<string | null> => {
    const token = localStorage.getItem('mrm_token') ?? ''
    const res = await fetch(`/api/whatsapp/instances/${id}?action=qr-code`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    return data.qrCode ?? null
  }, [])

  const disconnectInstance = useCallback(async (id: string) => {
    const token = localStorage.getItem('mrm_token') ?? ''
    await fetch(`/api/whatsapp/instances/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect' }),
    })
    setInstances(prev => prev.map(i => i.id === id ? { ...i, status: 'disconnected' } : i))
  }, [])

  const updateInstance = useCallback(async (id: string, data: {
    name?: string; instance_id?: string; token?: string; client_token?: string; is_active?: boolean
  }) => {
    const token = localStorage.getItem('mrm_token') ?? ''
    const res = await fetch(`/api/whatsapp/instances/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Falha ao atualizar instância')
    }
    const updated = await res.json()
    setInstances(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i))
    return updated as WhatsAppInstance
  }, [])

  return { instances, isLoading, error, refetch: fetchInstances, createInstance, deleteInstance, getStatus, getQrCode, disconnectInstance, updateInstance, getInstanceDetails }
}
