/**
 * Cliente da API oficial do Instagram (Instagram API com login do Instagram,
 * host graph.instagram.com) — só a conta profissional da própria igreja.
 *
 * O que a API entrega para a conta conectada: as publicações dela (legenda,
 * tipo, data, link, URL das imagens). O que ela NÃO entrega: quem aparece na
 * foto, a lista de quem curtiu, nem dados de perfis pessoais de terceiros. Por
 * isso quem está na foto vem do reconhecimento de rosto (engajamento_rostos) e
 * da marcação à mão (engajamento_marcacoes).
 *
 * Não testado contra uma conta real neste repositório: os campos seguem a
 * documentação da Meta. Ver docs/modules/engajamento/SPEC.md, seções 2 e 6.
 */

const HOST = 'https://graph.instagram.com';

export interface PerfilInstagram {
  id: string;
  username: string;
}

export interface MidiaInstagram {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
  children?: { data: Array<{ id: string; media_type: string; media_url?: string; thumbnail_url?: string }> };
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  const corpo = await res.json().catch(() => null);
  if (!res.ok || corpo?.error) {
    const msg = corpo?.error?.message || `Instagram respondeu ${res.status}.`;
    throw new Error(msg);
  }
  return corpo as T;
}

/**
 * App da Meta do sistema (cadastrado uma vez em developers.facebook.com, produto
 * Instagram → "API com login do Instagram"). Sem ele não existe o botão
 * "Entrar com Instagram".
 */
export function appInstagram(): { appId: string; segredo: string } | null {
  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  const segredo = process.env.INSTAGRAM_APP_SECRET?.trim();
  return appId && segredo ? { appId, segredo } : null;
}

/**
 * Depois do login no Instagram: troca o `code` pelo token de curta duração
 * (1 h) e este pelo de longa duração (60 dias).
 */
export async function trocarCodigo(code: string, redirectUri: string): Promise<{ token: string; expiraEm: Date }> {
  const app = appInstagram();
  if (!app) throw new Error('O app do Instagram não está configurado no servidor (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET).');
  const form = new URLSearchParams({
    client_id: app.appId,
    client_secret: app.segredo,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form, cache: 'no-store' });
  const curto = await res.json().catch(() => null);
  if (!res.ok || !curto?.access_token) {
    throw new Error(curto?.error_message || curto?.error?.message || `Instagram recusou o login (${res.status}).`);
  }
  const longo = await get<{ access_token: string; expires_in: number }>(
    `${HOST}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(app.segredo)}&access_token=${encodeURIComponent(curto.access_token)}`,
  );
  return { token: longo.access_token, expiraEm: new Date(Date.now() + longo.expires_in * 1000) };
}

export function perfil(token: string): Promise<PerfilInstagram> {
  return get<PerfilInstagram>(`${HOST}/me?fields=id,username&access_token=${encodeURIComponent(token)}`);
}

/** Troca o token de longa duração por outro de 60 dias (precisa ter mais de 24 h). */
export async function renovarToken(token: string): Promise<{ token: string; expiraEm: Date }> {
  const r = await get<{ access_token: string; expires_in: number }>(
    `${HOST}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
  );
  return { token: r.access_token, expiraEm: new Date(Date.now() + r.expires_in * 1000) };
}

const CAMPOS_MIDIA =
  'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}';

/** Publicações a partir de `desde`, da mais nova para a mais antiga, até `maximo`. */
export async function midiasDesde(token: string, desde: Date, maximo: number): Promise<MidiaInstagram[]> {
  const saida: MidiaInstagram[] = [];
  let url: string | null = `${HOST}/me/media?fields=${encodeURIComponent(CAMPOS_MIDIA)}&limit=50&access_token=${encodeURIComponent(token)}`;
  while (url && saida.length < maximo) {
    const pagina: { data: MidiaInstagram[]; paging?: { next?: string } } = await get(url);
    for (const m of pagina.data) {
      if (new Date(m.timestamp) < desde) return saida;
      saida.push(m);
      if (saida.length >= maximo) return saida;
    }
    url = pagina.paging?.next ?? null;
  }
  return saida;
}

/** URLs das imagens de uma publicação (álbum = cada foto; vídeo = a capa). */
export function imagensDaMidia(m: MidiaInstagram): string[] {
  const urlDe = (x: { media_type: string; media_url?: string; thumbnail_url?: string }) =>
    x.media_type === 'VIDEO' ? x.thumbnail_url : x.media_url;
  if (m.media_type === 'CAROUSEL_ALBUM' && m.children?.data?.length) {
    return m.children.data.map(urlDe).filter((u): u is string => Boolean(u));
  }
  const u = urlDe(m);
  return u ? [u] : [];
}
