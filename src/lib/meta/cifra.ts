/**
 * Cifra AES-256-GCM para tokens da Meta (WhatsApp Cloud API) guardados no banco.
 * Mesmo esquema de src/lib/stripeEncrypt.ts (formato iv:tag:dados em hex),
 * mas a chave é recebida por parâmetro para que o módulo rode sem o projeto.
 */
import crypto from 'node:crypto'

const ALGORITMO = 'aes-256-gcm'
const TAMANHO_IV = 16
const TAMANHO_TAG = 16

function chaveDeHex(chaveHex: string): Buffer {
  if (typeof chaveHex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(chaveHex)) {
    throw new Error('META_TOKEN_ENCRYPTION_KEY inválida')
  }
  return Buffer.from(chaveHex, 'hex')
}

export function cifrar(texto: string, chaveHex: string): string {
  const chave = chaveDeHex(chaveHex)
  const iv = crypto.randomBytes(TAMANHO_IV)
  const cifra = crypto.createCipheriv(ALGORITMO, chave, iv)
  const dados = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()])
  const tag = cifra.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${dados.toString('hex')}`
}

export function decifrar(cifrado: string, chaveHex: string): string {
  const chave = chaveDeHex(chaveHex)
  const partes = cifrado.split(':')
  if (partes.length !== 3) throw new Error('Formato de cifrado inválido')
  const [ivHex, tagHex, dadosHex] = partes
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  if (iv.length !== TAMANHO_IV || tag.length !== TAMANHO_TAG) {
    throw new Error('Formato de cifrado inválido')
  }
  const decifra = crypto.createDecipheriv(ALGORITMO, chave, iv)
  decifra.setAuthTag(tag)
  return Buffer.concat([decifra.update(Buffer.from(dadosHex, 'hex')), decifra.final()]).toString('utf8')
}
