import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { records } = body;
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Nenhum registro fornecido." }, { status: 400 });
    }
    const authUser = await prisma.user.findUnique({ where: { id: user.id }, select: { churchId: true, regionalId: true } });
    if (!authUser?.churchId) {
      return NextResponse.json({ error: "Usuário não vinculado a uma igreja. Selecione a igreja antes de importar." }, { status: 403 });
    }
    const results: { success: number; errors: Array<{ row: number; message: string }> } = { success: 0, errors: [] };
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 1;
      try {
        if (!row.fullName || !String(row.fullName).trim()) { results.errors.push({ row: rowNum, message: "Campo 'fullName' obrigatório." }); continue; }
        await prisma.member.create({
          data: {
            churchId: authUser.churchId,
            regionalId: authUser.regionalId || undefined,
            fullName: String(row.fullName).trim(),
            preferredName: row.preferredName ? String(row.preferredName).trim() : null,
            cpf: row.cpf ? String(row.cpf).trim() : null,
            rg: row.rg ? String(row.rg).trim() : null,
            birthDate: row.birthDate ? new Date(row.birthDate) : null,
            gender: row.gender ? String(row.gender).trim() : null,
            maritalStatus: row.maritalStatus ? String(row.maritalStatus).trim() : null,
            email: row.email ? String(row.email).trim() : null,
            phone: row.phone ? String(row.phone).trim() : null,
            mobile: row.mobile ? String(row.mobile).trim() : null,
            addressStreet: row.addressStreet ? String(row.addressStreet).trim() : null,
            addressNumber: row.addressNumber ? String(row.addressNumber).trim() : null,
            addressComplement: row.addressComplement ? String(row.addressComplement).trim() : null,
            addressNeighborhood: row.addressNeighborhood ? String(row.addressNeighborhood).trim() : null,
            addressCity: row.addressCity ? String(row.addressCity).trim() : null,
            addressState: row.addressState ? String(row.addressState).trim() : null,
            addressZipcode: row.addressZipcode ? String(row.addressZipcode).trim() : null,
            membershipStatus: row.membershipStatus ? String(row.membershipStatus).trim() : "AGUARDANDO ATIVACAO",
            membershipDate: row.membershipDate ? new Date(row.membershipDate) : null,
            ecclesiasticalTitle: row.ecclesiasticalTitle ? String(row.ecclesiasticalTitle).trim() : "CONGREGADO",
            baptismStatus: row.baptismStatus ? String(row.baptismStatus).trim() : null,
            baptismDate: row.baptismDate ? new Date(row.baptismDate) : null,
            fatherName: row.fatherName ? String(row.fatherName).trim() : null,
            motherName: row.motherName ? String(row.motherName).trim() : null,
            spouseName: row.spouseName ? String(row.spouseName).trim() : null,
            occupation: row.occupation ? String(row.occupation).trim() : null,
            naturalityCity: row.naturalityCity ? String(row.naturalityCity).trim() : null,
            notes: row.notes ? String(row.notes).trim() : null,
            emergencyContactName: row.emergencyContactName ? String(row.emergencyContactName).trim() : null,
            emergencyContactPhone: row.emergencyContactPhone ? String(row.emergencyContactPhone).trim() : null,
            createdBy: user.id,
          },
        });
        results.success++;
      } catch (err) {
        const msg = (err as Error)?.message || "Erro desconhecido";
        results.errors.push({ row: rowNum, message: msg.includes("Unique constraint") ? `Registro duplicado (CPF já existe): ${row.cpf}` : msg });
      }
    }
    return NextResponse.json(results);
  });
}
