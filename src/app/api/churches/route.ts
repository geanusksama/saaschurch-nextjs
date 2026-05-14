import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

function isRestrictedToOwnChurch(user: { profileType: string; roleName?: string | null }) {
  if (user.profileType === "church") return true;
  const name = String(user.roleName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return name.includes("secret") || name.includes("tesour");
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const url = new URL(req.url);
    const fieldId = url.searchParams.get("fieldId");

    const scopedFieldId =
      user.profileType === "master" || user.profileType === "admin" ? (fieldId || null) : (user.campoId || null);

    if (isRestrictedToOwnChurch(user) && user.churchId) {
      return NextResponse.json(
        await prisma.church.findMany({
          where: { id: user.churchId, deletedAt: null },
          include: {
            regional: { select: { id: true, name: true, campoId: true, campo: { select: { id: true, name: true, code: true } } } },
            headquarters: { select: { id: true, churchName: true, regionalName: true, fieldId: true, fieldName: true } },
          },
        })
      );
    }

    return NextResponse.json(
      await prisma.church.findMany({
        where: {
          deletedAt: null,
          ...(scopedFieldId ? { regional: { campoId: scopedFieldId } } : {}),
        },
        include: {
          regional: {
            select: {
              id: true, name: true, campoId: true,
              campo: { select: { id: true, name: true, code: true } },
            },
          },
          headquarters: { select: { id: true, churchName: true, regionalName: true, fieldId: true, fieldName: true } },
        },
        orderBy: [{ regional: { campo: { name: "asc" } } }, { regional: { name: "asc" } }, { name: "asc" }],
      })
    );
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { regionalId, name, code } = body;
    if (!regionalId || !name || !code) {
      return NextResponse.json({ error: "regionalId, name and code are required" }, { status: 400 });
    }
    const church = await prisma.church.create({ data: { ...body } });
    return NextResponse.json(church, { status: 201 });
  });
}
