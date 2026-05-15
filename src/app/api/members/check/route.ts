import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const cpf = searchParams.get('cpf')?.replace(/[^\d]/g, '');
    const name = searchParams.get('name')?.trim();

    if (!cpf && !name) {
      return NextResponse.json({ error: 'Forneça o CPF ou o Nome.' }, { status: 400 });
    }

    try {
      // Prioritize CPF check
      if (cpf) {
        const memberByCpf = await prisma.member.findFirst({
          where: { cpf: { contains: cpf }, deletedAt: null },
          select: { id: true, fullName: true, cpf: true, churchId: true, church: { select: { id: true, name: true, code: true } } }
        });

        if (memberByCpf) {
          return NextResponse.json({
            exists: true,
            type: 'cpf',
            member: memberByCpf
          });
        }
      }

      // Then check name if no CPF matched
      if (name) {
        // Simple case-insensitive exact match or close match
        const memberByName = await prisma.member.findFirst({
          where: { fullName: { equals: name, mode: 'insensitive' }, deletedAt: null },
          select: { id: true, fullName: true, cpf: true, churchId: true, church: { select: { id: true, name: true, code: true } } }
        });

        if (memberByName) {
          return NextResponse.json({
            exists: true,
            type: 'name',
            member: memberByName
          });
        }
      }

      return NextResponse.json({ exists: false });

    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
