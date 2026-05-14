import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const member = await prisma.member.findFirst({
      where: { id, deletedAt: null },
      include: {
        church: { select: { id: true, name: true, code: true, regional: { select: { id: true, name: true, code: true, campo: { select: { id: true, name: true, code: true } } } } } },
        regional: { select: { id: true, name: true, code: true } },
        ecclesiasticalTitleRef: { select: { id: true, name: true, abbreviation: true, level: true } },
        ministryMemberships: { where: { isActive: true, leftAt: null }, include: { ministry: { select: { id: true, name: true } } } },
      },
    });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    // Clear stale titleRef
    const m = member as typeof member & { ecclesiasticalTitleRef: typeof member.ecclesiasticalTitleRef | null };
    if (m.ecclesiasticalTitleRef && m.ecclesiasticalTitle && m.ecclesiasticalTitleRef.name.toLowerCase() !== m.ecclesiasticalTitle.toLowerCase()) {
      m.ecclesiasticalTitleRef = null;
    }
    return NextResponse.json(serializeBigInts(m));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.member.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const data = { ...body };

    const normalizedMemberType = data.memberType !== undefined
      ? (["PF", "PJ"].includes(String(data.memberType || "").toUpperCase()) ? String(data.memberType).toUpperCase() : "MEMBRO")
      : (existing.memberType || "MEMBRO");

    if (data.cnpj) {
      const dup = await prisma.member.findFirst({ where: { cnpj: data.cnpj, deletedAt: null, id: { not: id } } });
      if (dup) return NextResponse.json({ error: "CNPJ já cadastrado para outro registro." }, { status: 409 });
    }

    if (data.ecclesiasticalTitleId !== undefined && normalizedMemberType === "MEMBRO") {
      const resolvedTitle = await prisma.ecclesiasticalTitle.findFirst({ where: { id: data.ecclesiasticalTitleId, deletedAt: null, isActive: true } });
      if (!resolvedTitle) return NextResponse.json({ error: "ecclesiastical title not found" }, { status: 404 });
      data.ecclesiasticalTitleId = resolvedTitle.id;
      data.ecclesiasticalTitle = resolvedTitle.name;
    }

    if (data.memberType !== undefined) {
      data.memberType = normalizedMemberType;
      if (normalizedMemberType !== "MEMBRO") {
        data.ecclesiasticalTitleId = null; data.ecclesiasticalTitle = null;
        data.baptismStatus = null; data.baptismDate = null;
      }
    }

    let regionalId: string | undefined;
    if (data.churchId && data.churchId !== existing.churchId) {
      const nextChurch = await prisma.church.findFirst({ where: { id: data.churchId, deletedAt: null }, select: { id: true, regionalId: true } });
      if (!nextChurch) return NextResponse.json({ error: "church not found" }, { status: 404 });
      regionalId = nextChurch.regionalId || undefined;
    }

    const updated = await prisma.member.update({
      where: { id },
      data: {
        ...data,
        regionalId: regionalId ?? data.regionalId ?? undefined,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        membershipDate: data.membershipDate ? new Date(data.membershipDate) : undefined,
        baptismDate: data.baptismDate ? new Date(data.baptismDate) : undefined,
        updatedBy: user.id || undefined,
      },
    });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.member.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") === "true";
    if (permanent) {
      await prisma.$transaction([
        prisma.kanCard.updateMany({ where: { memberId: id }, data: { memberId: null } }),
        prisma.memberEventHistory.deleteMany({ where: { memberId: id } }),
        prisma.member.delete({ where: { id } }),
      ]);
    } else {
      await prisma.member.update({ where: { id }, data: { deletedAt: new Date() } });
    }
    return new NextResponse(null, { status: 204 });
  });
}
