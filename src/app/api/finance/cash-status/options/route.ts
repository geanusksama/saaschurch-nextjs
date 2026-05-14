import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { AuthUser } from "@/lib/auth";
import { isRestrictedToOwnChurch } from "@/lib/helpers";

async function listScopedChurchRows({ user, churchIds = [] as string[], regionalIds = [] as string[], search = "" }) {
  const conditions: string[] = ["c.deleted_at IS NULL"];
  const params: unknown[] = [];
  let nextParam = 1;

  if (isRestrictedToOwnChurch(user) && user?.churchId) {
    conditions.push(`c.id = $${nextParam}::uuid`);
    params.push(user.churchId);
    nextParam++;
  } else {
    if (churchIds.length) {
      conditions.push(`c.id = ANY($${nextParam}::uuid[])`);
      params.push(churchIds);
      nextParam++;
    }
    if (regionalIds.length) {
      conditions.push(`c.regional_id = ANY($${nextParam}::uuid[])`);
      params.push(regionalIds);
      nextParam++;
    }
    if (user?.campoId) {
      conditions.push(`r.campo_id = $${nextParam}::uuid`);
      params.push(user.campoId);
      nextParam++;
    }
  }
  if (search?.trim()) {
    conditions.push(`(c.name ILIKE $${nextParam} OR COALESCE(r.name, '') ILIKE $${nextParam})`);
    params.push(`%${search.trim()}%`);
  }

  return prisma.$queryRawUnsafe<Array<{ churchId: string; churchName: string; regionalId: string | null; regionalName: string | null }>>(
    `SELECT c.id::text AS "churchId", c.name AS "churchName", r.id::text AS "regionalId", r.name AS "regionalName"
     FROM churches c JOIN regionais r ON r.id = c.regional_id
     WHERE ${conditions.join(" AND ")} ORDER BY r.name ASC, c.name ASC`,
    ...params
  );
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const churches = await listScopedChurchRows({ user });
    const regionalsMap = new Map<string, { id: string; name: string }>();
    churches.forEach((row) => {
      if (row.regionalId && !regionalsMap.has(row.regionalId)) {
        regionalsMap.set(row.regionalId, { id: row.regionalId, name: row.regionalName || "Sem Regional" });
      }
    });
    return NextResponse.json({
      regionals: [...regionalsMap.values()],
      churches: churches.map((row) => ({ id: row.churchId, name: row.churchName || "Sem Igreja", regionalId: row.regionalId || null, regionalName: row.regionalName || "Sem Regional" })),
    });
  });
}
