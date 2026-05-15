import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

/** Mirrors old server listConsecrationTitles() + findConsecrationServiceForTitle() */
function normalizeLookup(v: string) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const [titles, services] = await Promise.all([
      prisma.ecclesiasticalTitle.findMany({
        where: { isActive: true, deletedAt: null, name: { notIn: ["CONGREGADO", "MEMBRO"] } },
        orderBy: [{ displayOrder: "asc" }, { level: "asc" }, { name: "asc" }],
      }),
      prisma.kanService.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);

    const titleOptions = titles.map((title) => {
      // Match service by abbreviation or name (same logic as old findConsecrationServiceForTitle)
      const abbr = normalizeLookup(title.abbreviation || "");
      const name = normalizeLookup(title.name || "");
      const service = services.find((s) => {
        const sigla = normalizeLookup(s.sigla || "");
        if (abbr && (sigla === abbr || sigla.endsWith(abbr) || abbr.endsWith(sigla))) return true;
        if (normalizeLookup(s.description || "").includes(name)) return true;
        return false;
      }) || null;

      return {
        id: title.id,
        name: title.name,
        abbreviation: title.abbreviation,
        level: title.level,
        displayOrder: title.displayOrder,
        consecrationTypeKey: title.consecrationTypeKey,
        serviceId: service?.id || null,
        serviceSigla: service?.sigla || null,
        serviceDescription: service?.description || null,
      };
    });

    return NextResponse.json(serializeBigInts(titleOptions));
  });
}
