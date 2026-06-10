import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const cpf = searchParams.get('cpf')?.replace(/[^\d]/g, '');
    const name = searchParams.get('name')?.trim();
    const rol = searchParams.get('rol')?.trim();

    if (!cpf && !name && !rol) {
      return NextResponse.json({ error: 'Forneça o CPF, o Nome ou o ROL.' }, { status: 400 });
    }

    try {
      // 1. Prioritize CPF check
      if (cpf) {
        const memberByCpf = await prisma.member.findFirst({
          where: { cpf: { contains: cpf }, deletedAt: null },
          select: {
            id: true,
            fullName: true,
            cpf: true,
            churchId: true,
            campoId: true,
            church: {
              select: {
                id: true,
                name: true,
                code: true,
                regional: {
                  select: {
                    campoId: true
                  }
                }
              }
            }
          }
        });

        if (memberByCpf) {
          const memberCampoId = memberByCpf.campoId || memberByCpf.church?.regional?.campoId;
          const sameCampo = !!(memberCampoId && user.campoId && memberCampoId === user.campoId) ||
            user.profileType === 'master' ||
            user.profileType === 'admin';

          return NextResponse.json({
            exists: true,
            type: 'cpf',
            sameCampo,
            member: sameCampo ? memberByCpf : {
              id: memberByCpf.id,
              churchId: memberByCpf.churchId,
            }
          });
        }
      }

      // 2. Check ROL if no CPF matched
      if (rol) {
        const parsedRol = parseInt(rol, 10);
        if (!isNaN(parsedRol)) {
          const memberByRol = await prisma.member.findFirst({
            where: { rol: parsedRol, deletedAt: null },
            select: {
              id: true,
              fullName: true,
              rol: true,
              churchId: true,
              campoId: true,
              church: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  regional: {
                    select: {
                      campoId: true
                    }
                  }
                }
              }
            }
          });

          if (memberByRol) {
            const memberCampoId = memberByRol.campoId || memberByRol.church?.regional?.campoId;
            const sameCampo = !!(memberCampoId && user.campoId && memberCampoId === user.campoId) ||
              user.profileType === 'master' ||
              user.profileType === 'admin';

            if (sameCampo) {
              return NextResponse.json({
                exists: true,
                type: 'rol',
                sameCampo: true,
                member: memberByRol
              });
            }
          }
        }
      }

      // 3. Check name if no CPF and no ROL matched
      if (name) {
        const memberByName = await prisma.member.findFirst({
          where: { fullName: { equals: name, mode: 'insensitive' }, deletedAt: null },
          select: {
            id: true,
            fullName: true,
            cpf: true,
            churchId: true,
            campoId: true,
            church: {
              select: {
                id: true,
                name: true,
                code: true,
                regional: {
                  select: {
                    campoId: true
                  }
                }
              }
            }
          }
        });

        if (memberByName) {
          const memberCampoId = memberByName.campoId || memberByName.church?.regional?.campoId;
          const sameCampo = !!(memberCampoId && user.campoId && memberCampoId === user.campoId) ||
            user.profileType === 'master' ||
            user.profileType === 'admin';

          return NextResponse.json({
            exists: true,
            type: 'name',
            sameCampo,
            member: sameCampo ? memberByName : {
              id: memberByName.id,
              churchId: memberByName.churchId,
            }
          });
        }
      }

      return NextResponse.json({ exists: false });

    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}

