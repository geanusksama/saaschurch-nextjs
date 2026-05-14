import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

function getManagedCampoId(user: import("@/lib/auth").AuthUser) {
  if (user.profileType === "admin" && user.campoId) return user.campoId;
  return null;
}

function buildManagedUsersWhere(user: import("@/lib/auth").AuthUser, query: Record<string, string> = {}) {
  const { search, profileType, churchId, campoId, regionalId, isActive } = query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { deletedAt: null };
  const managedCampoId = getManagedCampoId(user);
  const effectiveCampoId = managedCampoId || campoId || null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const andClauses: any[] = [];

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

  if (effectiveCampoId) {
    const fieldClauses = [
      { campoId: effectiveCampoId },
      { regional: { is: { campoId: effectiveCampoId } } },
      { church: { is: { regional: { is: { campoId: effectiveCampoId } } } } },
    ];
    if (user.profileType === "master" && user.sub) {
      fieldClauses.push({ id: user.sub });
    }
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
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    const where = buildManagedUsersWhere(user, query);
    const users = await prisma.user.findMany({
      where: where as Parameters<typeof prisma.user.findMany>[0]["where"],
      include: userInclude,
      orderBy: { fullName: "asc" },
    });
    return NextResponse.json(serializeBigInts(users));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { fullName, email, phone, profileType, churchId, regionalId, campoId, roleId, isAdmin } = body;
    if (!fullName || !email) return NextResponse.json({ error: "fullName e email são obrigatórios." }, { status: 400 });

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

    const newUser = await prisma.user.create({
      data: {
        fullName, email, phone, profileType: profileType || "church",
        churchId: nextChurchId || undefined,
        regionalId: nextRegionalId || undefined,
        campoId: nextCampoId || undefined,
        roleId: roleId || undefined,
        isAdmin: isAdmin ?? false,
      },
      include: userInclude,
    });
    return NextResponse.json(serializeBigInts(newUser), { status: 201 });
  });
}
