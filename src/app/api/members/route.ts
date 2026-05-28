import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { isRestrictedToOwnChurch } from "@/lib/helpers";

function serializeBigInts(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const url = new URL(req.url);
    const { churchId, regionalId, campoId, churchIds, query, search, limit } = Object.fromEntries(url.searchParams);

    const churchWhere: Record<string, unknown> = { deletedAt: null };
    if (churchId) {
      churchWhere.id = churchId;
    } else if (churchIds) {
      const ids = churchIds.split(",").filter(Boolean);
      if (ids.length) churchWhere.id = { in: ids };
    } else if (regionalId) {
      churchWhere.regionalId = regionalId;
    } else if (campoId) {
      churchWhere.regional = { campoId };
    } else if (user.campoId) {
      churchWhere.regional = { campoId: user.campoId };
    }

    if (isRestrictedToOwnChurch(user)) {
      if (!user.churchId) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
      churchWhere.id = user.churchId;
    }

    const normalizedQuery = String(query || search || "").trim();
    const parsedLimit = Number(limit);

    let nameFilter: Record<string, unknown> = {};
    if (normalizedQuery) {
      const parsedRol = Number(normalizedQuery);
      const isRolQuery = normalizedQuery !== "" && Number.isInteger(parsedRol);
      if (isRolQuery) {
        nameFilter = { rol: parsedRol };
      } else {
        const tokens = normalizedQuery.trim().split(/\s+/).filter(Boolean);
        if (tokens.length === 1) {
          nameFilter = {
            OR: [
              { fullName: { startsWith: normalizedQuery, mode: "insensitive" } },
              { fullName: { contains: ` ${normalizedQuery}`, mode: "insensitive" } },
            ],
          };
        } else {
          nameFilter = {
            AND: tokens.map((token) => ({
              OR: [
                { fullName: { startsWith: token, mode: "insensitive" } },
                { fullName: { contains: ` ${token}`, mode: "insensitive" } },
              ],
            })),
          };
        }
      }
    }

    const effectiveLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 500)
      : 100;

    const members = await prisma.member.findMany({
      where: { deletedAt: null, church: churchWhere, ...nameFilter },
      include: {
        church: {
          select: {
            id: true, name: true, code: true,
            regional: { select: { id: true, name: true, code: true, campoId: true, campo: { select: { id: true, name: true } } } },
          },
        },
        regional: { select: { id: true, name: true, code: true } },
        ecclesiasticalTitleRef: { select: { id: true, name: true, abbreviation: true, level: true } },
      },
      orderBy: { fullName: "asc" },
      take: effectiveLimit,
    });

    for (const member of members) {
      if (
        member.ecclesiasticalTitleRef &&
        member.ecclesiasticalTitle &&
        (member.ecclesiasticalTitleRef as { name: string }).name.toLowerCase() !== member.ecclesiasticalTitle.toLowerCase()
      ) {
        (member as Record<string, unknown>).ecclesiasticalTitleRef = null;
      }
    }

    return NextResponse.json(serializeBigInts(members));
  });
}
