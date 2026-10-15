/**
 * Configuração do Asaas por campo (asaas_configs).
 *
 * A chave de API e o token do webhook ficam criptografados (AES-256-GCM). A
 * chave de criptografia é ASAAS_ENCRYPTION_KEY (64 hex) ou, sem ela, derivada
 * da SUPABASE_SERVICE_ROLE_KEY — segredo que só o servidor de cada igreja tem,
 * então a mesma linha copiada para outro banco não abre.
 */
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { clienteAsaas, type AmbienteAsaas, type ClienteAsaas } from './api';

function chaveCripto(): Buffer {
  const hex = process.env.ASAAS_ENCRYPTION_KEY;
  if (hex && /^[0-9a-f]{64}$/i.test(hex)) return Buffer.from(hex, 'hex');
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error('Sem segredo para criptografar a chave do Asaas (ASAAS_ENCRYPTION_KEY ou SUPABASE_SERVICE_ROLE_KEY).');
  return crypto.createHash('sha256').update(`asaas:${base}`).digest();
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

export type ConfigAsaas = NonNullable<Awaited<ReturnType<typeof prisma.asaasConfig.findFirst>>>;

export class SemAsaas extends Error {
  constructor(msg = 'Pagamento online não está ativo neste campo.') {
    super(msg);
  }
}

export async function configDoCampo(campoId: string, exigirAtiva = true): Promise<{ config: ConfigAsaas; api: ClienteAsaas }> {
  const config = await prisma.asaasConfig.findFirst({ where: { campoId, deletedAt: null } });
  if (!config || (exigirAtiva && !config.ativo)) throw new SemAsaas();
  return { config, api: clienteAsaas(decifrar(config.apiKeyEnc), config.ambiente as AmbienteAsaas) };
}

export function apiDaConfig(config: ConfigAsaas): ClienteAsaas {
  return clienteAsaas(decifrar(config.apiKeyEnc), config.ambiente as AmbienteAsaas);
}

/** Configs cujo token de webhook confere com o recebido (comparação em tempo constante). */
export async function configsDoToken(recebido: string | null): Promise<ConfigAsaas[]> {
  if (!recebido) return [];
  const todas = await prisma.asaasConfig.findMany({ where: { deletedAt: null, webhookTokenEnc: { not: null } } });
  const a = Buffer.from(recebido);
  return todas.filter((c) => {
    try {
      const b = Buffer.from(decifrar(c.webhookTokenEnc!));
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

export function novoTokenWebhook(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * URL pública deste deploy, para o webhook: o domínio por onde o admin está
 * usando o painel (cada igreja tem o seu). NEXT_PUBLIC_APP_URL não serve —
 * em produção ela não é confiável (o Stripe cai em app.mrm.com.br).
 */
export function urlPublica(req: Request): string {
  const h = new Headers(req.headers);
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}
