'use client'
/** Tabela de preços da Meta (central) para as telas que mostram valor estimado. Sem leitura ⇒ lista vazia ("preço não configurado"). */
import { useEffect, useState } from 'react'
import { apiBase } from '../apiBase'
import { cabecalhos } from './clienteHttp'
import { moedaDosPrecos, type Preco } from './custoFormato'

export function usePrecosMeta(ativo: boolean): { precos: Preco[]; moeda: string } {
  const [precos, setPrecos] = useState<Preco[]>([])
  useEffect(() => {
    if (!ativo) return
    let vivo = true
    fetch(`${apiBase}/meta/app-config/precos`, { headers: cabecalhos(), cache: 'no-store' })
      .then(async (r) => (r.ok ? ((await r.json()) as { precos?: Preco[] }) : null))
      .then((j) => { if (vivo && j) setPrecos(Array.isArray(j.precos) ? j.precos : []) })
      .catch(() => { /* sem tabela: a tela diz "preço não configurado" */ })
    return () => { vivo = false }
  }, [ativo])
  return { precos, moeda: moedaDosPrecos(precos) }
}
