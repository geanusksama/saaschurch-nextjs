import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import {
  resolveAudienceMembers,
  resolveVisibleChurches,
  ScopeError,
  type AudienceFilters,
} from '@/lib/secretariaCampaignScope'

/**
 * GET  /api/secretaria/campaigns/audience — opções dos filtros do modal
 *      "Anexar pessoas": regionais, igrejas, zonas, títulos e situações, já
 *      limitadas ao que o usuário pode ver.
 * POST /api/secretaria/campaigns/audience — prévia: quem seria anexado com os
 *      filtros escolhidos (sem gravar nada).
 */

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const churches = await resolveVisibleChurches(user)

      // As regionais e zonas saem das igrejas visíveis — não do cadastro
      // inteiro. Assim o filtro nunca oferece uma opção que devolveria zero.
      const regionais = new Map<string, string>()
      const zonas = new Set<string>()
      for (const c of churches) {
        if (c.regional) regionais.set(c.regional.id, c.regional.name)
        if (c.zone) zonas.add(c.zone)
      }

      const titles = await prisma.ecclesiasticalTitle.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      })

      const statuses = await prisma.member.groupBy({
        by: ['membershipStatus'],
        where: { deletedAt: null, churchId: { in: churches.map(c => c.id) } },
        _count: { _all: true },
      })

      return NextResponse.json({
        regionais: Array.from(regionais, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
        churches: churches.map(c => ({
          id: c.id,
          name: c.name,
          zone: c.zone,
          regionalId: c.regionalId,
          regionalName: c.regional?.name ?? null,
        })),
        zones: Array.from(zonas).sort((a, b) => a.localeCompare(b)),
        titles: titles.map(t => ({ id: t.id, name: t.name })),
        statuses: statuses
          .filter(s => s.membershipStatus)
          .map(s => ({ value: s.membershipStatus as string, count: s._count._all }))
          .sort((a, b) => b.count - a.count),
      })
    } catch (e) {
      if (e instanceof ScopeError) return NextResponse.json({ error: e.message }, { status: e.status })
      throw e
    }
  })
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = (await req.json().catch(() => ({}))) as { filters?: AudienceFilters }
    try {
      const { members, churchCount } = await resolveAudienceMembers(user, body.filters ?? {})
      return NextResponse.json({
        total: members.length,
        churchCount,
        semTelefone: members.filter(m => !m.phone).length,
        members,
      })
    } catch (e) {
      if (e instanceof ScopeError) return NextResponse.json({ error: e.message }, { status: e.status })
      throw e
    }
  })
}
