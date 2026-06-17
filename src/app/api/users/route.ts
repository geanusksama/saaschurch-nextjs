import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

const CreateUserSchema = z.object({
  fullName: z.string().min(1, "fullName é obrigatório").max(255),
  email: z.string().email("Email inválido"),
  phone: z.string().max(50).optional().nullable(),
  profileType: z.string().optional(),
  churchId: z.string().uuid("churchId deve ser UUID").optional().nullable(),
  regionalId: z.string().uuid("regionalId deve ser UUID").optional().nullable(),
  campoId: z.string().uuid("campoId deve ser UUID").optional().nullable(),
  roleId: z.string().uuid("roleId deve ser UUID").optional().nullable(),
  isAdmin: z.boolean().optional(),
});

function getManagedCampoId(user: import("@/lib/auth").AuthUser) {
  if ((user.profileType === "admin" || user.profileType === "campo") && user.campoId) return user.campoId;
  return null;
}

function buildManagedUsersWhere(user: import("@/lib/auth").AuthUser, query: Record<string, string> = {}) {
  const { search, profileType, churchId, campoId, regionalId, isActive } = query;
  const where: Record<string, unknown> = { deletedAt: null };
  const managedCampoId = getManagedCampoId(user);
  const effectiveCampoId = managedCampoId || campoId || null;
  const andClauses: unknown[] = [];

  if (search) {
    andClauses.push({ OR: [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ] });
  }

  if (profileType) where.profileType = profileType;
  if (churchId) where.churchId = churchId;
  if (regionalId) where.regionalId = regionalId;
  if (isActive !== undefined) where.isActive = isActive === "true";

  // Master users searching by name/email bypass the campo filter so they can
  // find and fix orphaned accounts (no campoId/regionalId/churchId set).
  const masterSearchingByText = user.profileType === "master" && !!search;

  if (effectiveCampoId && !masterSearchingByText) {
    const fieldClauses: unknown[] = [
      { campoId: effectiveCampoId },
      { regional: { is: { campoId: effectiveCampoId } } },
      { church: { is: { regional: { is: { campoId: effectiveCampoId } } } } },
    ];
    andClauses.push({ OR: fieldClauses });
  }

  if (andClauses.length > 0) where.AND = andClauses;
  return where;
}

const userInclude = {
  role: { select: { id: true, name: true } },
  campo: { select: { id: true, name: true, code: true } },
  regional: { select: { id: true, name: true, code: true, campoId: true } },
  church: { select: { id: true, name: true } },
};

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    const where = buildManagedUsersWhere(user, query);

    // Legacy flat-array path (e.g. GlobalSearchModal passes explicit limit)
    const limitParam = searchParams.get("limit");
    if (limitParam) {
      const limit = Math.min(500, Math.max(1, parseInt(limitParam) || 200));
      const users = await prisma.user.findMany({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: where as any,
        include: userInclude,
        orderBy: { fullName: "asc" },
        take: limit,
      });
      return NextResponse.json(serializeBigInts(users));
    }

    // Paginated path
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") || "25")));
    const skip = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = where as any;
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where: w, include: userInclude, orderBy: { fullName: "asc" }, skip, take: pageSize }),
      prisma.user.count({ where: w }),
    ]);

    return NextResponse.json(serializeBigInts({ data: users, total, page, pageSize }));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { fullName, email, phone, profileType, churchId, regionalId, campoId, roleId, isAdmin } = parsed.data;

    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) return NextResponse.json({ error: "Email já cadastrado." }, { status: 409 });

    const managedCampoId = getManagedCampoId(user);
    let nextCampoId = managedCampoId || campoId || null;
    let nextRegionalId = regionalId || null;
    let nextChurchId = churchId || null;

    if (nextChurchId) {
      const church = await prisma.church.findFirst({
        where: { id: nextChurchId, deletedAt: null },
        select: { id: true, regionalId: true, regional: { select: { campoId: true } } },
      });
      if (!church) return NextResponse.json({ error: "Igreja não encontrada." }, { status: 404 });
      nextRegionalId = church.regionalId;
      nextCampoId = church.regional?.campoId || nextCampoId;
    } else if (nextRegionalId) {
      const regional = await prisma.regional.findFirst({
        where: { id: nextRegionalId, deletedAt: null },
        select: { id: true, campoId: true },
      });
      if (!regional) return NextResponse.json({ error: "Regional não encontrada." }, { status: 404 });
      nextCampoId = regional.campoId;
    }

    if (managedCampoId && nextCampoId && nextCampoId !== managedCampoId) {
      return NextResponse.json({ error: "Não é permitido criar usuários em outro campo." }, { status: 403 });
    }

    let newUser;
    try {
      newUser = await prisma.user.create({
        data: {
          fullName, email, phone,
          profileType: profileType || "church",
          churchId: nextChurchId || undefined,
          regionalId: nextRegionalId || undefined,
          campoId: nextCampoId || undefined,
          roleId: roleId || undefined,
          isAdmin: isAdmin ?? false,
        },
        include: userInclude,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("P2002") || msg.includes("Unique constraint") || msg.includes("unique constraint")) {
        return NextResponse.json({ error: "Email já cadastrado." }, { status: 409 });
      }
      console.error("[POST /api/users] user.create failed");
      return NextResponse.json({ error: "Erro ao criar usuário." }, { status: 500 });
    }
    return NextResponse.json(serializeBigInts(newUser), { status: 201 });
  });
}
