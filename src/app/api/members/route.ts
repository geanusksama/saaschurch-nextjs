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
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize")) || 20), 5000);
    const memberTypeParam = sp.get("memberType") ?? "ALL";
    const statusParam = sp.get("status") ?? "";
    const maritalStatusParam = sp.get("maritalStatus") ?? "";
    const titleIdParam = sp.get("titleId") ?? "";

    const createdFrom = sp.get("createdFrom") ?? undefined;
    const createdTo = sp.get("createdTo") ?? undefined;

    const statusParams = statusParam ? statusParam.split(",").filter(Boolean) : [];
    const maritalStatusParams = maritalStatusParam ? maritalStatusParam.split(",").filter(Boolean) : [];
    const titleIds = titleIdParam ? titleIdParam.split(",").filter(Boolean) : [];

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

    // Force user's campoId scope if they are not master
    if (user.profileType !== "master") {
      if (!user.campoId) {
        return NextResponse.json({ error: "Sem acesso. Campo não definido." }, { status: 403 });
      }
      // Ensure the regional relation is defined and filters by user's campoId
      churchWhere.regional = {
        ...(churchWhere.regional as Record<string, unknown> || {}),
        campoId: user.campoId,
      };
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
        // "MEMBRO" (ou qualquer valor != PF/PJ): membros reais, excluindo PF/PJ.
        // Inclui registros com memberType nulo (legado) para não perdê-los.
        filterConditions.push({
          OR: [
            { memberType: null },
            { NOT: { memberType: { in: ["PF", "pf", "PJ", "pj"] } } },
          ],
        });
      }
    }

    // Membership status filter (supports comma-separated multiple values)
    if (statusParams.length > 0) {
      const buildStatusCond = (s: string): object => {
        if (s === "aguardando") return { membershipStatus: { contains: "aguard", mode: "insensitive" } };
        if (s === "inativo") return inactiveFilter;
        if (s === "visitante") return { OR: [{ membershipStatus: null }, { membershipStatus: "" }, { membershipStatus: { contains: "visit", mode: "insensitive" } }] };
        return activeFilter;
      };
      filterConditions.push(statusParams.length === 1
        ? buildStatusCond(statusParams[0])
        : { OR: statusParams.map(buildStatusCond) }
      );
    }

    // Marital status filter (supports comma-separated multiple values)
    if (maritalStatusParams.length > 0) {
      const kwMap: Record<string, string> = { casado: "cas", solteiro: "solt", viuvo: "viuv", divorciado: "divorc" };
      const maritalConds = maritalStatusParams.map((s): object => {
        if (s === "__NONE__") return { OR: [{ maritalStatus: null }, { maritalStatus: "" }] };
        const kw = kwMap[s];
        return kw ? { maritalStatus: { contains: kw, mode: "insensitive" } } : { id: { not: "" } };
      });
      filterConditions.push(maritalConds.length === 1 ? maritalConds[0] : { OR: maritalConds });
    }

    // Title filter (supports comma-separated multiple IDs)
    // Matches by FK (ecclesiasticalTitleId) OR by string field (ecclesiasticalTitle)
    // because many members only have the string field populated without the FK.
    if (titleIds.length > 0) {
      const hasNone = titleIds.includes("__NONE__");
      const realIds = titleIds.filter((id) => id !== "__NONE__");
      const orConds: object[] = [];

      if (hasNone) {
        orConds.push({
          OR: [
            { ecclesiasticalTitleId: null, ecclesiasticalTitle: null },
            { ecclesiasticalTitleId: null, ecclesiasticalTitle: "" },
          ],
        });
      }

      if (realIds.length > 0) {
        // Fetch names so we can also match the plain-text field
        const titleRecords = await prisma.ecclesiasticalTitle.findMany({
          where: { id: { in: realIds } },
          select: { name: true },
        });
        const names = titleRecords.map((t) => t.name);

        orConds.push({ ecclesiasticalTitleId: { in: realIds } });
        for (const name of names) {
          orConds.push({ ecclesiasticalTitle: { equals: name, mode: "insensitive" } });
        }
      }

      if (orConds.length > 0) {
        filterConditions.push(orConds.length === 1 ? orConds[0] : { OR: orConds });
      }
    }

    // Creation date filter (for "new members" widget)
    if (createdFrom || createdTo) {
      const dateFilter: Record<string, Date> = {};
      if (createdFrom) dateFilter.gte = new Date(createdFrom);
      if (createdTo) dateFilter.lte = new Date(createdTo);
      filterConditions.push({ createdAt: dateFilter });
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

    const memberOrderBy = createdFrom || createdTo
      ? [{ createdAt: "desc" as const }, { fullName: "asc" as const }]
      : [{ fullName: "asc" as const }];

    const [members, total, activeCount, inactiveCount, churchGroups] = await Promise.all([
      prisma.member.findMany({ where: w, include: memberInclude, orderBy: memberOrderBy, skip, take: pageSize }),
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
