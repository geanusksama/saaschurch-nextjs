import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { records } = body;
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Nenhum registro fornecido." }, { status: 400 });
    }
    const authUser = await prisma.user.findUnique({ where: { id: user.id }, select: { regionalId: true } });
    if (!authUser?.regionalId) {
      return NextResponse.json({ error: "Usuário não vinculado a uma regional." }, { status: 403 });
    }
    const results: { success: number; errors: Array<{ row: number; message: string }> } = { success: 0, errors: [] };
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 1;
      try {
        if (!row.name || !String(row.name).trim()) { results.errors.push({ row: rowNum, message: "Campo 'name' obrigatório." }); continue; }
        if (!row.code || !String(row.code).trim()) { results.errors.push({ row: rowNum, message: "Campo 'code' obrigatório." }); continue; }
        await prisma.church.create({
          data: {
            regionalId: authUser.regionalId,
            name: String(row.name).trim(),
            code: String(row.code).trim(),
            legalName: row.legalName ? String(row.legalName).trim() : null,
            cnpj: row.cnpj ? String(row.cnpj).trim() : null,
            email: row.email ? String(row.email).trim() : null,
            phone: row.phone ? String(row.phone).trim() : null,
            whatsapp: row.whatsapp ? String(row.whatsapp).trim() : null,
            addressStreet: row.addressStreet ? String(row.addressStreet).trim() : null,
            addressNumber: row.addressNumber ? String(row.addressNumber).trim() : null,
            addressCity: row.addressCity ? String(row.addressCity).trim() : null,
            addressState: row.addressState ? String(row.addressState).trim() : null,
            addressZipcode: row.addressZipcode ? String(row.addressZipcode).trim() : null,
            hasOwnTemple: row.hasOwnTemple === "true" || row.hasOwnTemple === true,
            notes: row.notes ? String(row.notes).trim() : null,
          },
        });
        results.success++;
      } catch (err) {
        const msg = (err as Error)?.message || "Erro desconhecido";
        results.errors.push({ row: rowNum, message: msg.includes("Unique constraint") ? `Código duplicado: ${row.code}` : msg });
      }
    }
    return NextResponse.json(results);
  });
}
