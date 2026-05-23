/**
 * Utilitário de criptografia para chaves Stripe armazenadas no banco.
 * Usa AES-256-GCM via Node.js crypto.
 * A STRIPE_ENCRYPTION_KEY deve ser definida no .env (32 bytes em hex = 64 chars).
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.STRIPE_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("STRIPE_ENCRYPTION_KEY não configurada ou inválida (deve ter 64 hex chars)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptKey(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Formato: iv(hex):authTag(hex):ciphertext(hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptKey(ciphertext: string): string {
  const key = getKey();
  const [ivHex, authTagHex, encHex] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !encHex) throw new Error("Formato de ciphertext inválido");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(enc).toString("utf8") + decipher.final("utf8");
}

/** Retorna instância do SDK Stripe usando a secret key do campo */
export async function getStripeForCampo(campoId: string) {
  const { prisma } = await import("./prisma");
  const config = await prisma.stripeConfig.findUnique({ where: { campoId, deletedAt: null, ativo: true } });
  if (!config) throw new Error("Configuração Stripe não encontrada ou inativa para este campo");
  const secretKey = decryptKey(config.secretKeyEnc);
  const Stripe = (await import("stripe")).default;
  return { stripe: new Stripe(secretKey, { apiVersion: "2025-04-30.basil" }), config };
}

export function maskKey(key: string): string {
  if (!key || key.length < 8) return "***";
  return key.slice(0, 7) + "..." + key.slice(-4);
}
