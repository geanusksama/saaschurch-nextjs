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
  const rows = await prisma.$queryRawUnsafe<{ id: string; access_password_hash: string | null }[]>(
    `SELECT id::text AS id, access_password_hash FROM campos WHERE deleted_at IS NULL AND id = ANY($1::uuid[])`,
    fieldIds
  );
  return new Map(rows.map((r) => [r.id, r.access_password_hash || null]));
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fieldWhere: any = { deletedAt: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regionalWhere: any = { deletedAt: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const churchWhere: any = { deletedAt: null };

    if (user.profileType === "master") {
      // sees everything
    } else if ((user.profileType === "admin" || user.profileType === "campo") && user.campoId) {
      fieldWhere.id = user.campoId;
      regionalWhere.campoId = user.campoId;
      churchWhere.regional = { campoId: user.campoId };
    } else if (isRestrictedToOwnChurch(user) && user.churchId) {
      const scopedChurch = await prisma.church.findFirst({
        where: { id: user.churchId, deletedAt: null },
        include: { regional: { select: { id: true, campoId: true } } },
      });
      if (scopedChurch && scopedChurch.regional) {
        fieldWhere.id = scopedChurch.regional.campoId;
        regionalWhere.id = scopedChurch.regional.id;
        churchWhere.id = user.churchId;
      }
    }

    const [fields, regionals, churches] = await Promise.all([
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
        orderBy: [{ regional: { campo: { name: "asc" } } }, { regional: { name: "asc" } }, { name: "asc" }],
      }),
    ]);

    const campoPasswordHashMap = await getCampoPasswordHashMap(fields.map((f) => f.id));

    return NextResponse.json({
      fields: fields.map((field) => ({
        id: field.id,
        name: field.name,
        code: field.code,
        level: "field",
        requiresPassword: Boolean(campoPasswordHashMap.get(field.id)),
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
