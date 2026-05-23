import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const params = req.nextUrl.searchParams;
    const campoId = resolveScopedFieldId(user, params.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const churchId = params.get("churchId") || undefined;
    const status = params.get("status") || undefined;
    const metodo = params.get("metodo") || undefined;
    const tipo = params.get("tipo") || undefined;
    const userId = params.get("userId") || undefined;
    const from = params.get("from") ? new Date(params.get("from")!) : undefined;
    const to = params.get("to") ? new Date(params.get("to")!) : undefined;
    const page = Math.max(1, Number(params.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 20)));
    const skip = (page - 1) * limit;

    const where = {
      campoId,
      ...(churchId && { churchId }),
      ...(status && { status }),
      ...(metodo && { metodo }),
      ...(tipo && { tipo }),
      ...(userId && { userId }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.stripePayment.count({ where }),
      prisma.stripePayment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  });
}
