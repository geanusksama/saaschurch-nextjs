import crypto from 'crypto'

function getSecret(): string {
  return process.env.MEMBRO_JWT_SECRET || process.env.NEXTAUTH_SECRET || 'membro-dev-secret-change-in-prod'
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64url')
}

export function signToken(payload: Record<string, unknown>, expiresInSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
  const data = b64url(JSON.stringify({ ...payload, exp }))
  const sig = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  try {
    const dot = token.lastIndexOf('.')
    if (dot < 0) return null
    const data = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expected = crypto.createHmac('sha256', getSecret()).update(data).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'ascii'), Buffer.from(expected, 'ascii'))) return null
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as T & { exp?: number }
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function hashCode(code: string): string {
  return crypto.createHmac('sha256', getSecret()).update(`otp:${code}`).digest('hex')
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return '**-****-' + digits.slice(-4)
  return '(**) *****-' + digits.slice(-4)
}

export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function validateCpf(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i)
  let r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(digits[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i)
  r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(digits[10])
}
