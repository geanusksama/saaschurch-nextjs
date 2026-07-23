import { NextRequest, NextResponse } from 'next/server'
import { signToken, hashCode, maskPhone } from '@/lib/membroJwt'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendTextViaZApi } from '@/lib/whatsappSendService'
import {
  MAX_TENTATIVAS,
  findAcessoByTelefone,
  onlyDigits,
  registrarTentativaErrada,
} from '@/lib/contabilidadeService'

function gerarCodigo(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { telefone, hash } = body as { telefone?: string; hash?: string }

  const fone = onlyDigits(telefone ?? '')
  const senha = (hash ?? '').trim()

  if (!fone || !senha) {
    return NextResponse.json({ error: 'Informe o telefone e o hash de acesso.' }, { status: 400 })
  }

  const acesso = await findAcessoByTelefone(fone)

  // Telefone inexistente: mensagem generica (nao revela se o numero existe).
  if (!acesso) {
    return NextResponse.json({ error: 'Telefone ou hash invalido.' }, { status: 401 })
  }

  if (!acesso.ativo) {
    return NextResponse.json(
      { error: 'Acesso bloqueado por tentativas invalidas. Procure a secretaria da igreja.', blocked: true },
      { status: 403 }
    )
  }

  if (acesso.hash !== senha) {
    const restantes = await registrarTentativaErrada(acesso)
    return NextResponse.json(
      {
        error:
          restantes > 0
            ? `Telefone ou hash invalido. Voce tem mais ${restantes} tentativa(s).`
            : 'Acesso bloqueado apos 3 tentativas invalidas. Procure a secretaria da igreja.',
        remaining: restantes,
        blocked: restantes === 0,
      },
      { status: restantes === 0 ? 403 : 401 }
    )
  }

  // Instancia WhatsApp ativa (mesma regra usada no login do membro)
  const { data: instance } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('instance_id, token, client_token')
    .eq('is_active', true)
    .eq('status', 'connected')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!instance) {
    return NextResponse.json({ error: 'Servico de mensagens temporariamente indisponivel.' }, { status: 503 })
  }

  const codigo = gerarCodigo()
  const message =
    `📊 Relatorio Contabil — AD Campinas\n\n` +
    `Seu codigo de acesso e:\n\n*${codigo}*\n\n` +
    `Valido por 10 minutos. Nao compartilhe este codigo.`

  const result = await sendTextViaZApi(instance, fone, message)
  if (result.status === 'error') {
    console.error('[contabilidade/auth] WhatsApp send failed:', result.error)
    return NextResponse.json({ error: 'Nao foi possivel enviar o codigo. Tente novamente.' }, { status: 502 })
  }

  const otpToken = signToken({ acesso_id: acesso.id, code_hash: hashCode(codigo) }, 10 * 60)

  return NextResponse.json({
    otp_token: otpToken,
    phone_mask: maskPhone(fone),
    remaining: MAX_TENTATIVAS - (acesso.tentativas ?? 0),
  })
}
