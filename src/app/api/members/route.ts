import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { isRestrictedToOwnChurch } from "@/lib/helpers";

function serializeBigInts(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}

const memberInclude = {
  church: {
    select: {
      id: true, name: true, code: true,
      regional: { select: { id: true, name: true, code: true, campoId: true, campo: { select: { id: true, name: true } } } },
    },
  },
  regional: { select: { id: true, name: true, code: true } },
  ecclesiasticalTitleRef: { select: { id: true, name: true, abbreviation: true, level: true } },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fixTitleMismatch(members: any[]) {
  for (const member of members) {
    if (
      member.ecclesiasticalTitleRef &&
      member.ecclesiasticalTitle &&
      member.ecclesiasticalTitleRef.name.toLowerCase() !== member.ecclesiasticalTitle.toLowerCase()
    ) {
      member.ecclesiasticalTitleRef = null;
    }
  }
}

const activeFilter = {
  NOT: {
    OR: [
      { membershipStatus: null as null },
      { membershipStatus: "" },
      { membershipStatus: { contains: "aguard", mode: "insensitive" as const } },
      { membershipStatus: { contains: "inativ", mode: "insensitive" as const } },
      { membershipStatus: { contains: "deslig", mode: "insensitive" as const } },
      { membershipStatus: { contains: "visit", mode: "insensitive" as const } },
    ],
  },
};

const inactiveFilter = {
  OR: [
    { membershipStatus: { contains: "inativ", mode: "insensitive" as const } },
    { membershipStatus: { contains: "deslig", mode: "insensitive" as const } },
  ],
};

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams;

    const churchId = sp.get("churchId") ?? undefined;
    const regionalId = sp.get("regionalId") ?? undefined;
    const campoId = sp.get("campoId") ?? undefined;
    const churchIds = sp.get("churchIds") ?? undefined;
    const limitParam = sp.get("limit");

    // Accept `q`, `query`, or `search` as name search param
    const q = (sp.get("q") ?? sp.get("query") ?? sp.get("search") ?? "").trim();

    const page = Math.max(1, Number(sp.get("page")) || 1);
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize")) || 20), 500);
    const memberTypeParam = sp.get("memberType") ?? "ALL";
    const statusParam = sp.get("status") ?? "ALL";
    const maritalStatusParam = sp.get("maritalStatus") ?? "ALL";
    const titleId = sp.get("titleId") ?? "ALL";

    // Church scope filter
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

    // Build filter conditions array (combined with AND at the end)
    const filterConditions: object[] = [];

    // Name / ROL search
    if (q) {
      const parsedRol = Number(q);
      if (Number.isInteger(parsedRol) && q !== "") {
        filterConditions.push({ rol: parsedRol });
      } else {
        const tokens = q.split(/\s+/).filter(Boolean);
        if (tokens.length === 1) {
          filterConditions.push({
            OR: [
              { fullName: { startsWith: q, mode: "insensitive" } },
              { fullName: { contains: ` ${q}`, mode: "insensitive" } },
            ],
          });
        } else {
          filterConditions.push({
            AND: tokens.map((token) => ({
              OR: [
                { fullName: { startsWith: token, mode: "insensitive" } },
                { fullName: { contains: ` ${token}`, mode: "insensitive" } },
              ],
            })),
          });
        }
      }
    }

    // Member type filter
    if (memberTypeParam && memberTypeParam !== "ALL") {
      if (memberTypeParam === "PF") {
        filterConditions.push({ memberType: { equals: "PF", mode: "insensitive" } });
      } else if (memberTypeParam === "PJ") {
        filterConditions.push({ memberType: { equals: "PJ", mode: "insensitive" } });
      } else {
        filterConditions.push({ NOT: { memberType: { in: ["PF", "pf", "PJ", "pj"] } } });
      }
    }

    // Membership status filter
    if (statusParam && statusParam !== "ALL") {
      if (statusParam === "aguardando") {
        filterConditions.push({ membershipStatus: { contains: "aguard", mode: "insensitive" } });
      } else if (statusParam === "inativo") {
        filterConditions.push(inactiveFilter);
      } else if (statusParam === "visitante") {
        filterConditions.push({
          OR: [
            { membershipStatus: null },
            { membershipStatus: "" },
            { membershipStatus: { contains: "visit", mode: "insensitive" } },
          ],
        });
      } else if (statusParam === "ativo") {
        filterConditions.push(activeFilter);
      }
    }

    // Marital status filter
    if (maritalStatusParam && maritalStatusParam !== "ALL") {
      if (maritalStatusParam === "__NONE__") {
        filterConditions.push({ OR: [{ maritalStatus: null }, { maritalStatus: "" }] });
      } else {
        const kwMap: Record<string, string> = { casado: "cas", solteiro: "solt", viuvo: "viuv", divorciado: "divorc" };
        const kw = kwMap[maritalStatusParam];
        if (kw) filterConditions.push({ maritalStatus: { contains: kw, mode: "insensitive" } });
      }
    }

    // Title filter
    if (titleId && titleId !== "ALL") {
      filterConditions.push(titleId === "__NONE__"
        ? { ecclesiasticalTitleId: null }
        : { ecclesiasticalTitleId: titleId }
      );
    }

    // Combine all filters
    const where: Record<string, unknown> = { deletedAt: null, church: churchWhere };
    if (filterConditions.length > 0) where.AND = filterConditions;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = where as any;

    // Legacy path: when `limit` param is present (e.g. GlobalSearchModal), return flat array
    if (limitParam) {
      const parsedLimit = Number(limitParam);
      const effectiveLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 500) : 100;
      const members = await prisma.member.findMany({
        where: w,
        include: memberInclude,
        orderBy: { fullName: "asc" },
        take: effectiveLimit,
      });
      fixTitleMismatch(members);
      return NextResponse.json(serializeBigInts(members));
    }

    // Paginated path: returns { data, total, activeCount, inactiveCount, churchCount }
    const skip = (page - 1) * pageSize;

    const [members, total, activeCount, inactiveCount, churchGroups] = await Promise.all([
      prisma.member.findMany({ where: w, include: memberInclude, orderBy: { fullName: "asc" }, skip, take: pageSize }),
      prisma.member.count({ where: w }),
      prisma.member.count({ where: { AND: [w, activeFilter] } as never }),
      prisma.member.count({ where: { AND: [w, inactiveFilter] } as never }),
      prisma.member.groupBy({ by: ["churchId"], where: w }),
    ]);

    fixTitleMismatch(members);

    return NextResponse.json(serializeBigInts({
      data: members,
      total,
      activeCount,
      inactiveCount,
      churchCount: churchGroups.length,
    }));
  });
}
