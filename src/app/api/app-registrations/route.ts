import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const isMaster = user.profileType === "master";

    let rows: unknown[];

    if (isMaster) {
      rows = await prisma.$queryRaw`
        SELECT
          ac.id, ac.user_id, ac.nome, ac.email,
          ac.campo_id, ac.campo_name,
          ac.headquarters_id, ac.is_member, ac.member_id,
          ac.status, ac.created_at, ac.observacoes,
          c.name AS _campos_name,
          hq.name AS _hq_name
        FROM app_cadastros ac
        LEFT JOIN campos c ON c.id = ac.campo_id
        LEFT JOIN headquarters hq
          ON hq.id = ac.headquarters_id
          OR hq.field_id = ac.headquarters_id
        ORDER BY ac.created_at DESC
      `;
    } else {
      const fieldId = user.campoId ?? null;

      if (!fieldId) {
        return NextResponse.json([]);
      }

      rows = await prisma.$queryRaw`
        SELECT
          ac.id, ac.user_id, ac.nome, ac.email,
          ac.campo_id, ac.campo_name,
          ac.headquarters_id, ac.is_member, ac.member_id,
          ac.status, ac.created_at, ac.observacoes,
          c.name AS _campos_name,
          hq.name AS _hq_name
        FROM app_cadastros ac
        LEFT JOIN campos c ON c.id = ac.campo_id
        LEFT JOIN headquarters hq
          ON hq.id = ac.headquarters_id
          OR hq.field_id = ac.headquarters_id
        WHERE ac.campo_id = ${fieldId}::uuid
           OR ac.campo_id IS NULL AND (
                ac.headquarters_id = ${fieldId}::uuid
             OR hq.field_id = ${fieldId}::uuid
           )
        ORDER BY ac.created_at DESC
      `;
    }

    // Resolve campo_name in JS to avoid any Prisma SQL alias issues
    const processed = (rows as Record<string, unknown>[]).map(row => {
      const resolved = (row.campo_name as string) || (row._campos_name as string) || (row._hq_name as string) || null;
      const { _campos_name, _hq_name, ...rest } = row;
      return { ...rest, campo_name_resolved: resolved };
    });

    return NextResponse.json(serializeBigInts(processed));
  });
}
