import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MUNDIAL_CAMPOS, type CampoDef } from '@/lib/mobile/definicoes';
import { ErroMobile, mundialDoCampo } from '@/lib/mobile/recursosServidor';
import { jsonSemCache, rotaMobile } from '@/lib/mobile/rota';

/**
 * Painel Mobile › Configurações.
 *
 * Sede: cada campo tem sua sede (tabela headquarters); o app mostra a
 * escolhida aqui (appv3_campo_config → appv3_minha_igreja).
 *
 * Igreja Mundial: edita a que vale para o campo — a própria do campo, se
 * existir (chave = campo_id), senão a padrão do banco (chave 'padrao'). A
 * padrão é compartilhada por todos os campos do banco, por isso só master e
 * admin mexem nela.
 */
const PODE_PADRAO = ['master', 'admin'];

async function estado(campoId: string, perfil: string) {
  const [campo, sedes, cfg, mundial] = await Promise.all([
    prisma.campo.findUnique({ where: { id: campoId }, select: { id: true, name: true } }),
    prisma.legacyChurchHeadquarters.findMany({
      where: { fieldId: campoId }, orderBy: { churchName: 'asc' },
      select: { id: true, churchName: true, city: true, state: true },
    }),
    prisma.appV3CampoConfig.findUnique({ where: { campoId } }),
    mundialDoCampo(campoId),
  ]);
  return {
    campo,
    sedes: sedes.map((s) => ({ id: s.id, nome: s.churchName, cidade: [s.city, s.state].filter(Boolean).join(' / ') })),
    sedeId: cfg?.headquartersId ?? null,
    mundial,
    mundialDoCampo: mundial?.chave === campoId,
    podeEditarMundial: !mundial || mundial.chave === campoId || PODE_PADRAO.includes(perfil),
  };
}

function valor(c: CampoDef, v: unknown) {
  if (c.tipo === 'bool') return v === true || v === 'true';
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
  if (!s) {
    if (c.obrigatorio) throw new ErroMobile(`Preencha "${c.rotulo}".`);
    return c.padrao ?? null;
  }
  return s;
}

export async function GET(req: NextRequest) {
  return rotaMobile(req, 'mobile_config', 'view', async (ctx, user) => jsonSemCache(await estado(ctx.campoId, user.profileType)));
}

export async function PUT(req: NextRequest) {
  return rotaMobile(req, 'mobile_config', 'edit', async (ctx, user) => {
    const corpo = (await req.json().catch(() => ({}))) as { sedeId?: string | null; mundial?: Record<string, unknown> };

    if ('sedeId' in corpo) {
      const sedeId = corpo.sedeId || null;
      if (sedeId) {
        const ok = await prisma.legacyChurchHeadquarters.findFirst({ where: { id: sedeId, fieldId: ctx.campoId }, select: { id: true } });
        if (!ok) return NextResponse.json({ error: 'Sede não pertence ao campo.' }, { status: 400 });
      }
      await prisma.appV3CampoConfig.upsert({
        where: { campoId: ctx.campoId },
        update: { headquartersId: sedeId, atualizadoEm: new Date() },
        create: { campoId: ctx.campoId, headquartersId: sedeId },
      });
    }

    if (corpo.mundial) {
      const dados: Record<string, unknown> = {};
      for (const c of MUNDIAL_CAMPOS) if (c.col in corpo.mundial) dados[c.col] = valor(c, corpo.mundial[c.col]);
      const atual = await mundialDoCampo(ctx.campoId);
      if (!atual || atual.chave === 'padrao') {
        if (!PODE_PADRAO.includes(user.profileType)) {
          return NextResponse.json({ error: 'A Igreja Mundial padrão vale para todos os campos; só master ou admin altera.' }, { status: 403 });
        }
      }
      if (atual) {
        await prisma.appV3IgrejaMundial.update({ where: { id: atual.id }, data: { ...dados, atualizadoEm: new Date() } });
      } else {
        if (!dados.nome) throw new ErroMobile('Preencha "Nome completo".');
        await prisma.appV3IgrejaMundial.create({ data: { ...(dados as { nome: string }), chave: 'padrao' } });
      }
    }
    return jsonSemCache(await estado(ctx.campoId, user.profileType));
  });
}
