import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, isRestrictedToOwnChurch } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const members = await prisma.member.findMany({
      where: { churchId, deletedAt: null },
      include: {
        regional: { select: { id: true, name: true, code: true } },
        ecclesiasticalTitleRef: { select: { id: true, name: true, abbreviation: true, level: true } },
        ministryMemberships: { where: { isActive: true, leftAt: null }, include: { ministry: { select: { id: true, name: true } } } },
      },
      orderBy: { fullName: "asc" },
    });
    return NextResponse.json(serializeBigInts(members));
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    let churchId = (await params).id;
    if (user.profileType !== "master" && user.profileType !== "admin") {
      if (!user.churchId) return NextResponse.json({ error: "Sem acesso: usuário sem igreja vinculada." }, { status: 403 });
      churchId = user.churchId;
    }
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const {
      memberType, rol: rolInput, fullName, preferredName, photoUrl, cpf, rg, birthDate, gender, maritalStatus, cnpj,
      email, phone, mobile, addressStreet, addressNumber, addressComplement, addressNeighborhood, addressCity, addressState, addressZipcode,
      membershipStatus, membershipDate, ecclesiasticalTitle, ecclesiasticalTitleId, baptismStatus, baptismDate,
      fatherName, motherName, spouseId, spouseName, naturalityCity, naturalityState, nationality, voterRegistration, voterZone, voterSection,
      occupation, company, notes, ministryId, ministryRole, emergencyContactName, emergencyContactPhone,
    } = body;

    const manualRol = rolInput !== undefined && rolInput !== null && rolInput !== '' ? parseInt(String(rolInput), 10) : null;
    if (manualRol !== null && (isNaN(manualRol) || manualRol <= 0)) {
      return NextResponse.json({ error: "ROL inválido. Deve ser um número inteiro positivo." }, { status: 400 });
    }
    if (!fullName) return NextResponse.json({ error: "fullName is required" }, { status: 400 });

    const normalizedMemberType = ["PF", "PJ"].includes(String(memberType || "").toUpperCase())
      ? String(memberType).toUpperCase() : "MEMBRO";

    if (normalizedMemberType === "PJ" && !cnpj) {
      return NextResponse.json({ error: "CNPJ é obrigatório para cadastro PJ." }, { status: 400 });
    }

    const [church, resolvedTitle] = await Promise.all([
      prisma.church.findFirst({ where: { id: churchId, deletedAt: null } }),
      normalizedMemberType === "MEMBRO" && ecclesiasticalTitleId
        ? prisma.ecclesiasticalTitle.findFirst({ where: { id: ecclesiasticalTitleId, deletedAt: null, isActive: true } })
        : Promise.resolve(null),
    ]);

    if (!church) return NextResponse.json({ error: "church not found" }, { status: 404 });

    if (cpf) {
      const existing = await prisma.member.findFirst({ where: { cpf, deletedAt: null } });
      if (existing) return NextResponse.json({ error: "CPF já cadastrado para outro membro." }, { status: 409 });
    }
    if (cnpj) {
      const existingCompany = await prisma.member.findFirst({ where: { cnpj, deletedAt: null } });
      if (existingCompany) return NextResponse.json({ error: "CNPJ já cadastrado para outro registro." }, { status: 409 });
    }

    const effectiveMembershipDate = membershipDate ? new Date(membershipDate) : new Date();
    const effectiveStatus = membershipStatus || (normalizedMemberType === "MEMBRO" ? "ATIVO" : "ATIVO");

    let member;
    try {
      member = await prisma.$transaction(async (tx) => {
        const created = await tx.member.create({
          data: {
            churchId, regionalId: church.regionalId, memberType: normalizedMemberType,
            ...(manualRol !== null ? { rol: manualRol } : {}),
            fullName, preferredName, photoUrl, cpf, cnpj, rg,
            birthDate: birthDate ? new Date(birthDate) : undefined,
            gender, maritalStatus, email, phone, mobile, addressStreet, addressNumber, addressComplement,
            addressNeighborhood, addressCity, addressState, addressZipcode,
            membershipStatus: effectiveStatus,
            ecclesiasticalTitle: normalizedMemberType === "MEMBRO" ? (resolvedTitle?.name || ecclesiasticalTitle || null) : null,
            ecclesiasticalTitleId: normalizedMemberType === "MEMBRO" ? resolvedTitle?.id || null : null,
            membershipDate: effectiveMembershipDate,
            baptismStatus: normalizedMemberType === "MEMBRO" ? baptismStatus : null,
            baptismDate: normalizedMemberType === "MEMBRO" && baptismDate ? new Date(baptismDate) : undefined,
            fatherName, motherName, spouseId, spouseName, naturalityCity, naturalityState, nationality,
            voterRegistration, voterZone, voterSection, occupation, company, notes, emergencyContactName, emergencyContactPhone,
            createdBy: user.id || null, updatedBy: user.id || null,
          },
          include: { ecclesiasticalTitleRef: { select: { id: true, name: true, abbreviation: true, level: true } } },
        });
        if (ministryId) {
          const ministry = await tx.ministry.findFirst({ where: { id: ministryId, churchId, deletedAt: null } });
          if (ministry) {
            await tx.ministryMember.create({
              data: { ministryId: ministry.id, memberId: created.id, role: ministryRole || "Participante", joinedAt: effectiveMembershipDate, isActive: true },
            });
          }
        }
        return created;
      });
    } catch (err: unknown) {
      const prismaErr = err as { code?: string; meta?: { target?: string[] } };
      if (prismaErr?.code === "P2002") {
        const field = prismaErr?.meta?.target?.[0] || "campo";
        const label = field === "cpf" ? "CPF" : field === "email" ? "e-mail" : field;
        return NextResponse.json({ error: `${label} já cadastrado para outro membro.` }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json(serializeBigInts(member), { status: 201 });
  });
}
