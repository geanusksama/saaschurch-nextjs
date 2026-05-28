import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

const MAX_RECORDS = 500;

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { records } = body;
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Nenhum registro fornecido." }, { status: 400 });
    }
    if (records.length > MAX_RECORDS) {
      return NextResponse.json(
        { error: `Máximo de ${MAX_RECORDS} registros por importação.` },
        { status: 400 }
      );
    }

    const authUser = await prisma.user.findUnique({
      where: { id: user.id! },
      select: { churchId: true, regionalId: true, campoId: true },
    });
    if (!authUser?.churchId) {
      return NextResponse.json({ error: "Usuário não vinculado a uma igreja." }, { status: 403 });
    }

    const validRows: Prisma.MemberCreateManyInput[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 1;

      if (!row.fullName || !String(row.fullName).trim()) {
        errors.push({ row: rowNum, message: "Campo 'fullName' obrigatório." });
        continue;
      }

      let birthDate: Date | null = null;
      let membershipDate: Date | null = null;
      let baptismDate: Date | null = null;

      if (row.birthDate) {
        const d = new Date(row.birthDate);
        if (isNaN(d.getTime())) { errors.push({ row: rowNum, message: "birthDate inválido." }); continue; }
        birthDate = d;
      }
      if (row.membershipDate) {
        const d = new Date(row.membershipDate);
        if (isNaN(d.getTime())) { errors.push({ row: rowNum, message: "membershipDate inválido." }); continue; }
        membershipDate = d;
      }
      if (row.baptismDate) {
        const d = new Date(row.baptismDate);
        if (isNaN(d.getTime())) { errors.push({ row: rowNum, message: "baptismDate inválido." }); continue; }
        baptismDate = d;
      }

      validRows.push({
        churchId: authUser.churchId,
        regionalId: authUser.regionalId || undefined,
        fullName: String(row.fullName).trim(),
        cpf: row.cpf ? String(row.cpf).trim() : null,
        rg: row.rg ? String(row.rg).trim() : null,
        birthDate,
        gender: row.gender ? String(row.gender).trim() : null,
        maritalStatus: row.maritalStatus ? String(row.maritalStatus).trim() : null,
        email: row.email ? String(row.email).trim() : null,
        phone: row.phone ? String(row.phone).trim() : null,
        mobile: row.mobile ? String(row.mobile).trim() : null,
        addressStreet: row.addressStreet ? String(row.addressStreet).trim() : null,
        addressNumber: row.addressNumber ? String(row.addressNumber).trim() : null,
        addressNeighborhood: row.addressNeighborhood ? String(row.addressNeighborhood).trim() : null,
        addressCity: row.addressCity ? String(row.addressCity).trim() : null,
        addressState: row.addressState ? String(row.addressState).trim() : null,
        addressZipcode: row.addressZipcode ? String(row.addressZipcode).trim() : null,
        membershipStatus: row.membershipStatus ? String(row.membershipStatus).trim() : "AGUARDANDO ATIVACAO",
        membershipDate,
        ecclesiasticalTitle: row.ecclesiasticalTitle ? String(row.ecclesiasticalTitle).trim() : "CONGREGADO",
        baptismStatus: row.baptismStatus ? String(row.baptismStatus).trim() : null,
        baptismDate,
        fatherName: row.fatherName ? String(row.fatherName).trim() : null,
        motherName: row.motherName ? String(row.motherName).trim() : null,
        spouseName: row.spouseName ? String(row.spouseName).trim() : null,
        occupation: row.occupation ? String(row.occupation).trim() : null,
        notes: row.notes ? String(row.notes).trim() : null,
        createdBy: user.id,
      });
    }

    let success = 0;
    if (validRows.length > 0) {
      try {
        const result = await prisma.member.createMany({ data: validRows, skipDuplicates: true });
        success = result.count;
        const skipped = validRows.length - result.count;
        if (skipped > 0) {
          errors.push({ row: 0, message: `${skipped} registro(s) ignorado(s) por CPF/RG duplicado.` });
        }
      } catch (err) {
        const msg = (err as Error)?.message || "Erro desconhecido";
        console.error("[POST /api/members/import-csv/execute] createMany failed");
        errors.push({ row: 0, message: msg.includes("Unique constraint") ? "Alguns registros foram ignorados por dados duplicados." : "Erro ao importar registros." });
      }
    }

    return NextResponse.json({ success, errors });
  });
}
