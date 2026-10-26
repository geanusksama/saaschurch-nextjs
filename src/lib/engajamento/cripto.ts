/**
 * Token do Instagram criptografado (AES-256-GCM) em engajamento_instagram.
 * Mesmo esquema de src/lib/asaas/config.ts: chave de ENGAJAMENTO_ENCRYPTION_KEY
 * (64 hex) ou, sem ela, derivada da SUPABASE_SERVICE_ROLE_KEY — segredo que só
 * o servidor de cada igreja tem.
 */
import crypto from 'crypto';

function chaveCripto(): Buffer {
  const hex = process.env.ENGAJAMENTO_ENCRYPTION_KEY;
  if (hex && /^[0-9a-f]{64}$/i.test(hex)) return Buffer.from(hex, 'hex');
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error('Sem segredo para criptografar o token do Instagram (ENGAJAMENTO_ENCRYPTION_KEY ou SUPABASE_SERVICE_ROLE_KEY).');
  return crypto.createHash('sha256').update(`instagram:${base}`).digest();
}

export function cifrar(texto: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chaveCripto(), iv);
  const enc = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return `${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${enc.toString('hex')}`;
}

export function decifrar(cifrado: string): string {
  const [iv, tag, enc] = cifrado.split(':');
  if (!iv || !tag || !enc) throw new Error('Valor criptografado inválido.');
  const d = crypto.createDecipheriv('aes-256-gcm', chaveCripto(), Buffer.from(iv, 'hex'));
  d.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(enc, 'hex')), d.final()]).toString('utf8');
}
