/**
 * Banco do envio em massa do WhatsApp Oficial. Só comandos únicos ou `$transaction([...])`
 * em array (o pooler não aceita transação interativa); toda lista com teto e ordem.
 *
 * Reserva da fila: `meta_whatsapp_envios.atualizado_em` no futuro (now() + 2 min) marca um
 * pendente já pego por uma rodada; outra execução simultânea só pega `atualizado_em <= now()`.
 * Se a rodada cair, a reserva vence sozinha em 2 minutos.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import type {
  DisparoLinha, FiltrosMembros, FiltrosInteressados, FiltrosPublico, LinhaInteressado, LinhaMembro,
  NovoDisparo, NovoEnvio, StatusDisparo, StatusEnvio,
} from './servicoEnvio'

const LOTE_INSERCAO = 1000
const RESERVA = Prisma.sql`interval '2 minutes'`

const SELECT_DISPARO = {
  id: true, campoId: true, modeloNome: true, idioma: true, status: true, motivo: true, agendadoPara: true, criadoEm: true,
} as const

// ---------- público ----------

function ondeMembros(campoId: string, f: FiltrosMembros): Prisma.Sql {
  const c: Prisma.Sql[] = [
    Prisma.sql`r.campo_id = ${campoId}::uuid`,
    Prisma.sql`m.deleted_at IS NULL`,
    Prisma.sql`ch.deleted_at IS NULL`,
    Prisma.sql`(m.mobile IS NOT NULL OR m.phone IS NOT NULL)`,
  ]
  if (f.igrejaIds.length) c.push(Prisma.sql`m.church_id = ANY(${f.igrejaIds}::uuid[])`)
  if (f.situacoes.length) c.push(Prisma.sql`m.membership_status = ANY(${f.situacoes}::text[])`)
  if (f.titulos.length) {
    // O cadastro tem a FK do título em uns e só o texto em outros: casa pelos dois.
    const t = f.titulos.map((x) => x.toLowerCase())
    c.push(Prisma.sql`(lower(m.ecclesiastical_title) = ANY(${t}::text[]) OR EXISTS (
      SELECT 1 FROM ecclesiastical_titles et WHERE et.id = m.ecclesiastical_title_id AND lower(et.name) = ANY(${t}::text[])))`)
  }
  if (f.mesAniversario) c.push(Prisma.sql`EXTRACT(MONTH FROM m.birth_date) = ${f.mesAniversario}`)
  return Prisma.join(c, ' AND ')
}

function ondeInteressados(campoId: string, f: FiltrosInteressados): Prisma.LeadWhereInput {
  const criado: { gte?: Date; lt?: Date } = {}
  if (f.cadastroDe) criado.gte = new Date(`${f.cadastroDe}T00:00:00-03:00`)
  if (f.cadastroAte) criado.lt = new Date(new Date(`${f.cadastroAte}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000)
  return {
    deletedAt: null,
    phone: { not: null },
    church: { regional: { campoId }, deletedAt: null },
    ...(f.igrejaIds.length ? { churchId: { in: f.igrejaIds } } : {}),
    ...(f.origens.length ? { source: { in: f.origens } } : {}),
    ...(f.cadastroDe || f.cadastroAte ? { createdAt: criado } : {}),
  }
}

/** Contagem com telefone preenchido (sem carregar ninguém). O número final sai no criar. */
export async function contarPublico(campoId: string, f: FiltrosPublico): Promise<{ membros: number; interessados: number }> {
  const [membros, interessados] = await Promise.all([
    f.membros
      ? prisma.$queryRaw<Array<{ n: bigint }>>`
          SELECT count(*) AS n FROM members m
          JOIN churches ch ON ch.id = m.church_id
          JOIN regionais r ON r.id = ch.regional_id
          WHERE ${ondeMembros(campoId, f.membros)}`.then((r) => Number(r[0]?.n ?? 0))
      : Promise.resolve(0),
    f.interessados ? prisma.lead.count({ where: ondeInteressados(campoId, f.interessados) }) : Promise.resolve(0),
  ])
  return { membros, interessados }
}

export async function listarContatos(
  campoId: string, f: FiltrosPublico, limite: number,
): Promise<{ membros: LinhaMembro[]; interessados: LinhaInteressado[] }> {
  const [membros, leads] = await Promise.all([
    f.membros
      ? prisma.$queryRaw<LinhaMembro[]>`
          SELECT m.id::text AS "id", m.full_name AS "fullName", m.preferred_name AS "preferredName",
                 m.mobile AS "mobile", m.phone AS "phone", ch.name AS "igrejaNome"
          FROM members m
          JOIN churches ch ON ch.id = m.church_id
          JOIN regionais r ON r.id = ch.regional_id
          WHERE ${ondeMembros(campoId, f.membros)}
          ORDER BY m.full_name, m.id
          LIMIT ${limite}`
      : Promise.resolve([] as LinhaMembro[]),
    f.interessados
      ? prisma.lead.findMany({
          where: ondeInteressados(campoId, f.interessados),
          select: { id: true, fullName: true, phone: true, church: { select: { name: true } } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: limite,
        })
      : Promise.resolve([]),
  ])
  return {
    membros,
    interessados: leads.map((l) => ({ id: l.id, fullName: l.fullName, phone: l.phone, igrejaNome: l.church?.name ?? '' })),
  }
}

/** Um comando só (o pooler cobra ~700 ms por ida e volta). */
export async function telefonesExcluidos(campoId: string, telefones: string[]): Promise<Set<string>> {
  if (!telefones.length) return new Set()
  const l = await prisma.$queryRaw<Array<{ telefone: string }>>`
    SELECT telefone FROM meta_whatsapp_exclusoes
    WHERE campo_id = ${campoId}::uuid AND telefone = ANY(${telefones}::text[])`
  return new Set(l.map((x) => x.telefone))
}

// ---------- disparos ----------

/** Disparo + envios numa transação de array (createMany em lotes de 1000). */
export async function criarDisparoComEnvios(d: NovoDisparo, envios: NovoEnvio[]): Promise<void> {
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.metaWhatsappDisparo.create({
      data: {
        id: d.id, campoId: d.campoId, modeloId: d.modeloId, modeloNome: d.modeloNome, idioma: d.idioma,
        categoria: d.categoria, nome: d.nome, filtros: d.filtros as unknown as Prisma.InputJsonValue,
        valores: d.valores as Prisma.InputJsonValue, status: d.status, agendadoPara: d.agendadoPara,
        total: d.total, criadoPor: d.criadoPor,
      },
    }),
  ]
  for (let i = 0; i < envios.length; i += LOTE_INSERCAO) {
    ops.push(prisma.metaWhatsappEnvio.createMany({
      data: envios.slice(i, i + LOTE_INSERCAO).map((e) => ({ ...e, parametros: e.parametros as Prisma.InputJsonValue })),
    }))
  }
  await prisma.$transaction(ops)
}

export async function disparosAtivos(campoId: string, agora: Date): Promise<DisparoLinha[]> {
  return prisma.metaWhatsappDisparo.findMany({
    where: {
      campoId,
      OR: [
        { status: { in: ['enviando', 'aguardando_limite'] } },
        { status: 'agendado', agendadoPara: { lte: agora } },
      ],
    },
    orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
    take: 20,
    select: SELECT_DISPARO,
  })
}

/** Campos com disparo a processar agora (para o cron). */
export async function camposComDisparoAtivo(agora: Date): Promise<string[]> {
  const l = await prisma.metaWhatsappDisparo.findMany({
    where: {
      OR: [
        { status: { in: ['enviando', 'aguardando_limite'] } },
        { status: 'agendado', agendadoPara: { lte: agora } },
      ],
    },
    distinct: ['campoId'],
    select: { campoId: true },
    orderBy: { campoId: 'asc' },
    take: 200,
  })
  return l.map((x) => x.campoId)
}

export async function buscarDisparo(campoId: string, id: string): Promise<DisparoLinha | null> {
  return prisma.metaWhatsappDisparo.findFirst({ where: { id, campoId }, select: SELECT_DISPARO })
}

export async function mudarStatus(id: string, de: string[], para: StatusDisparo, motivo: string | null): Promise<boolean> {
  const r = await prisma.metaWhatsappDisparo.updateMany({ where: { id, status: { in: de } }, data: { status: para, motivo } })
  return r.count > 0
}

/** Cancela e marca pendentes como ignorados num comando só (o UPDATE dos envios depende do disparo ter mudado). */
export async function cancelar(id: string, de: string[]): Promise<boolean> {
  const r = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH d AS (
      UPDATE meta_whatsapp_disparos SET status = 'cancelado', motivo = NULL, atualizado_em = now()
      WHERE id = ${id}::uuid AND status = ANY(${de}::text[])
      RETURNING id
    ), e AS (
      UPDATE meta_whatsapp_envios SET status = 'ignorado', atualizado_em = now()
      WHERE disparo_id IN (SELECT id FROM d) AND status = 'pendente'
      RETURNING 1
    )
    SELECT id::text AS id FROM d`
  return r.length > 0
}

/** Recalcula os contadores pela agregação dos envios; `enviando` sem pendentes vira `concluido`. */
export async function recalcular(disparoId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE meta_whatsapp_disparos d SET
      enviados = a.enviados, entregues = a.entregues, lidos = a.lidos, falhos = a.falhos,
      status = CASE WHEN d.status = 'enviando' AND a.pendentes = 0 THEN 'concluido' ELSE d.status END,
      atualizado_em = now()
    FROM (
      SELECT
        count(*) FILTER (WHERE status IN ('enviado', 'entregue', 'lido'))::int AS enviados,
        count(*) FILTER (WHERE status IN ('entregue', 'lido'))::int AS entregues,
        count(*) FILTER (WHERE status = 'lido')::int AS lidos,
        count(*) FILTER (WHERE status = 'falhou')::int AS falhos,
        count(*) FILTER (WHERE status = 'pendente')::int AS pendentes
      FROM meta_whatsapp_envios WHERE disparo_id = ${disparoId}::uuid
    ) a
    WHERE d.id = ${disparoId}::uuid`
}

// ---------- envios ----------

export async function enviadosDesde(campoId: string, desde: Date): Promise<number> {
  return prisma.metaWhatsappEnvio.count({ where: { campoId, enviadoEm: { gte: desde } } })
}

export async function reservarPendentes(disparoId: string, n: number): Promise<Array<{ id: string; telefone: string; parametros: unknown }>> {
  if (n <= 0) return []
  return prisma.$queryRaw<Array<{ id: string; telefone: string; parametros: unknown }>>`
    UPDATE meta_whatsapp_envios e SET atualizado_em = now() + ${RESERVA}
    WHERE e.id IN (
      SELECT id FROM meta_whatsapp_envios
      WHERE disparo_id = ${disparoId}::uuid AND status = 'pendente' AND atualizado_em <= now()
      ORDER BY id
      LIMIT ${n}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING e.id::text AS id, e.telefone, e.parametros`
}

export async function liberarReserva(ids: string[]): Promise<void> {
  if (!ids.length) return
  // now() do banco (o mesmo relógio da reserva).
  await prisma.$executeRaw`UPDATE meta_whatsapp_envios SET atualizado_em = now() WHERE id = ANY(${ids}::uuid[]) AND status = 'pendente'`
}

export async function marcarEnviado(id: string, wamid: string, quando: Date): Promise<void> {
  await prisma.metaWhatsappEnvio.updateMany({
    where: { id, status: 'pendente' },
    data: { status: 'enviado', wamid, enviadoEm: quando, atualizadoEm: new Date() },
  })
}

export async function marcarFalha(id: string, codigo: number | null, erro: string): Promise<void> {
  await prisma.metaWhatsappEnvio.updateMany({
    where: { id, status: 'pendente' },
    data: { status: 'falhou', erroCodigo: codigo, erro, atualizadoEm: new Date() },
  })
}

export async function buscarEnvioPorWamid(campoId: string, wamid: string): Promise<{ id: string; status: string; disparoId: string } | null> {
  return prisma.metaWhatsappEnvio.findFirst({ where: { wamid, campoId }, select: { id: true, status: true, disparoId: true } })
}

/** Troca condicionada ao status lido antes (dois webhooks ao mesmo tempo não regridem). */
export async function trocarStatusEnvio(
  id: string, de: string, para: StatusEnvio, erro: { codigo: number | null; mensagem: string } | null,
): Promise<boolean> {
  const r = await prisma.metaWhatsappEnvio.updateMany({
    where: { id, status: de },
    data: { status: para, atualizadoEm: new Date(), ...(erro ? { erroCodigo: erro.codigo, erro: erro.mensagem } : {}) },
  })
  return r.count > 0
}

// ---------- exclusões ----------

export async function inserirExclusao(campoId: string, telefone: string, motivo: string): Promise<void> {
  await prisma.metaWhatsappExclusao.createMany({ data: [{ campoId, telefone, motivo }], skipDuplicates: true })
}

export async function ignorarPendentesDoTelefone(campoId: string, telefone: string): Promise<void> {
  await prisma.metaWhatsappEnvio.updateMany({
    where: { campoId, telefone, status: 'pendente' },
    data: { status: 'ignorado', atualizadoEm: new Date() },
  })
}
