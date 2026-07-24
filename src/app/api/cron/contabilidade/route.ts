import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  calcularProximoEnvio,
  processarAgendamento,
  type ContabilidadeAgendamento,
  type ContabilidadeAcessoLite,
} from '@/lib/contabilidadeAgendamentoService'

/**
 * GET /api/cron/contabilidade
 *
 * Chamado por um cron EXTERNO (Vercel Cron Jobs, cron-job.org, etc.) a cada
 * minuto — não é polling do frontend nem um loop dentro do processo. A rota
 * só age quando `proximo_envio` de algum agendamento já passou. Ver
 * docs/modules/contabilidade-agendamento/SPEC.md (RF007).
 *
 * Protegida por CRON_SECRET. Aceita dois formatos:
 * - `Authorization: Bearer <secret>` — é o que o Vercel Cron Jobs manda automaticamente
 *   quando existe uma env var chamada CRON_SECRET (não dá pra configurar headers
 *   custom em vercel.json, o Vercel injeta esse sozinho).
 * - `x-cron-secret: <secret>` — pra chamada manual (curl) ou cron externo tipo cron-job.org.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.CONTABILIDADE_CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-cron-secret')
  const autorizado = !!secret && (authHeader === `Bearer ${secret}` || cronHeader === secret)
  if (!autorizado) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const agora = new Date()

  const { data: agendamentos, error } = await supabaseAdmin
    .from('contabilidade_agendamentos')
    .select('*')
    .eq('ativo', true)
    .lte('proximo_envio', agora.toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const resultados: Array<{ acesso_id: string; status: string }> = []

  for (const agRaw of agendamentos ?? []) {
    const ag = agRaw as ContabilidadeAgendamento

    const { data: acesso } = await supabaseAdmin
      .from('contabilidade_acessos')
      .select('id, nome, campo, telefone, ativo')
      .eq('id', ag.acesso_id)
      .maybeSingle()

    if (!acesso || !acesso.ativo) {
      // Contador desativado/bloqueado: não envia, mas ainda assim reagenda para não travar no mesmo minuto.
      const proximo = calcularProximoEnvio(ag, agora)
      await supabaseAdmin.from('contabilidade_agendamentos').update({ proximo_envio: proximo?.toISOString() ?? null }).eq('id', ag.id)
      resultados.push({ acesso_id: ag.acesso_id, status: 'pulado_inativo' })
      continue
    }

    const resultado = await processarAgendamento(ag, acesso as ContabilidadeAcessoLite, 'automatico')

    // Recalcula o proximo envio SEMPRE (sucesso ou erro) para nao reprocessar o mesmo minuto pra sempre.
    const proximo = calcularProximoEnvio(ag, agora)
    await supabaseAdmin
      .from('contabilidade_agendamentos')
      .update({
        ultimo_envio: resultado.status === 'sucesso' ? agora.toISOString() : ag.ultimo_envio,
        proximo_envio: proximo?.toISOString() ?? null,
      })
      .eq('id', ag.id)

    resultados.push({ acesso_id: ag.acesso_id, status: resultado.status })
  }

  return NextResponse.json({ processados: resultados.length, resultados })
}
