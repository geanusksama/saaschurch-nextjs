/** Auxiliares HTTP compartilhadas pelas telas da Meta (cabeçalhos e leitura de erro). */
export function cabecalhos(json = false): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') : null;
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token ?? ''}`,
  };
}

export async function lerErro(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { error?: string };
    if (j?.error) return j.error;
  } catch {
    /* corpo vazio */
  }
  if (r.status === 401) return 'Sessão expirada. Entre novamente.';
  if (r.status === 403) return 'Você não tem permissão para esta ação.';
  return `Erro ${r.status} ao falar com o servidor.`;
}
