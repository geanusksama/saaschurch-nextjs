"use client";

/**
 * Busca de conteúdo do portal do membro.
 *
 * Todas as telas de conteúdo (pão diário, pregações, agenda, liderança,
 * igreja, feed) leem de GET /api/membro/conteudo?modulo=..., que resolve o
 * campo a partir do token assinado. O isolamento por campo é feito no
 * servidor — o cliente nunca escolhe de qual campo quer ver, e não existe
 * parâmetro para isso.
 *
 * `semCampo` é estado de primeira classe, não erro: membro sem campo
 * resolvido recebe lista vazia de propósito, porque devolver tudo seria
 * vazamento entre campos.
 */

import { useState, useEffect } from 'react';
import { useMembroSession } from '../MembroProvider';

export type ModuloConteudo =
  | 'pao' | 'pregacoes' | 'agenda' | 'lideranca' | 'igreja' | 'feed'
  | 'ministerios' | 'compras';

interface EstadoConteudo<T> {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
  semCampo: boolean;
}

export function useConteudo<T>(modulo: ModuloConteudo, chave: 'itens' | 'igreja' = 'itens'): EstadoConteudo<T> {
  const { session } = useMembroSession();
  const token = session?.member_token;

  const [estado, setEstado] = useState<EstadoConteudo<T>>({
    dados: null, carregando: true, erro: null, semCampo: false,
  });

  useEffect(() => {
    if (!token) return;
    let ativo = true;

    setEstado(e => ({ ...e, carregando: true, erro: null }));

    fetch(`/api/membro/conteudo?token=${encodeURIComponent(token)}&modulo=${modulo}`)
      .then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Não foi possível carregar.');
        return json;
      })
      .then(json => {
        if (!ativo) return;
        setEstado({
          dados: (json[chave] ?? null) as T,
          carregando: false,
          erro: null,
          semCampo: Boolean(json.semCampo),
        });
      })
      .catch((err: Error) => {
        if (!ativo) return;
        setEstado({ dados: null, carregando: false, erro: err.message, semCampo: false });
      });

    return () => { ativo = false; };
  }, [token, modulo, chave]);

  return estado;
}
