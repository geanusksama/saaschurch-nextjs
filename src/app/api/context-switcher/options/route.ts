import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

function isRestrictedToOwnChurch(user: { profileType: string; roleName?: string | null }) {
  if (user.profileType === "church") return true;
  const name = String(user.roleName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return name.includes("secret") || name.includes("tesour");
}

async function getCampoPasswordHashMap(fieldIds: string[]) {
  if (!fieldIds.length) return new Map<string, string | null>();
  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string; access_password_hash: string | null }[]>(
      `SELECT id::text AS id, access_password_hash FROM campos WHERE deleted_at IS NULL AND id = ANY($1::uuid[])`,
      fieldIds
    );
    return new Map(rows.map((r) => [r.id, r.access_password_hash || null]));
  } catch {
    // Column may not exist yet (migration pending) — return empty map so route doesn't crash
    return new Map<string, string | null>();
  }
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fieldWhere: any = { deletedAt: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regionalWhere: any = { deletedAt: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const churchWhere: any = { deletedAt: null };

    // Quem troca de campo: o master (qualquer campo, com senha) e quem o
    // master liberou em user_campos (só aqueles campos, sem senha). Regionais
    // e igrejas ficam sempre no campo ATIVO, para todo perfil — inclusive o
    // master (ver lib/campoAtivo.ts).
    const camposLiberados = user.profileType === "master" || !user.id
      ? []
      : (await prisma.userCampo.findMany({ where: { userId: user.id }, select: { campoId: true } })).map((l) => l.campoId);

    if (user.campoId) {
      regionalWhere.campoId = user.campoId;
      churchWhere.regional = { campoId: user.campoId };
    } else if (user.profileType !== "master") {
      regionalWhere.campoId = "00000000-0000-0000-0000-000000000000";
      churchWhere.id = "00000000-0000-0000-0000-000000000000";
    }

    if (user.profileType !== "master") {
      const permitidos = Array.from(new Set([user.campoId, ...camposLiberados].filter(Boolean))) as string[];
      fieldWhere.id = { in: permitidos.length ? permitidos : ["00000000-0000-0000-0000-000000000000"] };

      // Perfil preso à própria igreja: só a igreja e a regional dela.
      if (isRestrictedToOwnChurch(user)) {
        if (user.churchId) {
          const scopedChurch = await prisma.church.findFirst({
            where: { id: user.churchId, deletedAt: null },
            include: { regional: { select: { id: true, campoId: true } } },
          });
          if (scopedChurch && scopedChurch.regional) {
            regionalWhere.id = scopedChurch.regional.id;
            churchWhere.id = user.churchId;
          } else {
            regionalWhere.id = "00000000-0000-0000-0000-000000000000";
            churchWhere.id = "00000000-0000-0000-0000-000000000000";
          }
        } else {
          regionalWhere.id = "00000000-0000-0000-0000-000000000000";
          churchWhere.id = "00000000-0000-0000-0000-000000000000";
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fields: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let regionals: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let churches: any[] = [];

    try {
      [fields, regionals, churches] = await Promise.all([
        prisma.campo.findMany({ where: fieldWhere, orderBy: { name: "asc" } }),
        prisma.regional.findMany({
          where: regionalWhere,
          include: { campo: { select: { id: true, name: true, code: true } } },
          orderBy: [{ campo: { name: "asc" } }, { name: "asc" }],
        }),
        prisma.church.findMany({
          where: churchWhere,
          include: {
            regional: { include: { campo: { select: { id: true, name: true, code: true } } } },
          },
          orderBy: [{ name: "asc" }],
        }),
      ]);
    } catch (queryError) {
      console.error("[context-switcher/options] Prisma query error:", queryError);
      return NextResponse.json({ error: "Erro ao consultar dados de contexto." }, { status: 500 });
    }

    const campoPasswordHashMap = await getCampoPasswordHashMap(fields.map((f) => f.id));

    return NextResponse.json({
      // Seletor de campo visível para quem foi liberado em mais de um campo.
      // O master segue a regra antiga (só depois de destravar em Configurações).
      canSwitchField: user.profileType !== "master" && fields.length > 1,
      // Campo ativo de verdade (users.campo_id). A tela usa este, não o que
      // ficou guardado no navegador.
      activeFieldId: user.campoId,
      // Lotação de verdade no campo ativo. O navegador guarda uma cópia em
      // mrm_user; se ela ficou para trás (troca de campo feita em outro
      // aparelho, ou antes desta versão), as telas abrem com igreja de outro
      // campo pré-selecionada e o servidor recusa o filtro.
      activeChurchId: user.churchId,
      activeChurchName: user.churchName,
      activeRegionalId: user.regionalId,
      activeRegionalName: user.regionalName,
      fields: fields.map((field) => ({
        id: field.id,
        name: field.name,
        code: field.code,
        level: "field",
        // Só o master digita senha; para quem foi liberado em user_campos a
        // liberação já é a autorização.
        requiresPassword: user.profileType === "master" && Boolean(campoPasswordHashMap.get(field.id)),
      })),
      regionals: regionals.map((regional) => ({
        id: regional.id,
        name: regional.name,
        code: regional.code,
        level: "regional",
        fieldId: regional.campoId,
        fieldName: regional.campo?.name || null,
      })),
      churches: churches.map((church) => ({
        id: church.id,
        name: church.name,
        code: church.code,
        level: "church",
        regionalId: church.regionalId,
        regionalName: church.regional?.name || null,
        fieldId: church.regional?.campo?.id || null,
        fieldName: church.regional?.campo?.name || null,
      })),
    });
  });
}
