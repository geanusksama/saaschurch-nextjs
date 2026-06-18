"use client";

import { useState, useEffect } from 'react';
import { useMembroSession } from './MembroProvider';

type Resource = 'feed' | 'lideranca' | 'testemunhos' | 'pao-diario' | 'pregacoes' | 'agenda';

export function useMembroContent<T>(resource: Resource, params?: Record<string, unknown>) {
  const { session } = useMembroSession();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (!session?.member_token) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch('/api/membro/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session.member_token, resource, params }),
    })
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.error) setError(json.error);
        else setData(json.data ?? []);
      })
      .catch(() => { if (!cancelled) setError('Falha na conexão.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.member_token, resource, paramsKey]);

  return { data, loading, error };
}
