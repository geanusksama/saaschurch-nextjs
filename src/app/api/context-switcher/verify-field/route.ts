import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import bcryptjs from "bcryptjs";
import { serializeBigInts } from "@/lib/helpers";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    // Trocar de campo muda o escopo de TUDO que o usuario enxerga, entao so
    // master e admin podem. Perfil campo para baixo fica preso ao seu campo.
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json(
        { error: "Seu perfil não permite trocar de campo." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { campoId, fieldId, password } = body;
    const resolvedCampoId = campoId || fieldId;
    if (!resolvedCampoId || !password) {
      return NextResponse.json({ error: "campoId e password são obrigatórios." }, { status: 400 });
    }

    const campo = await prisma.campo.findFirst({
      where: { id: resolvedCampoId, deletedAt: null },
      select: { id: true, name: true, accessPasswordHash: true },
    });
    if (!campo) return NextResponse.json({ error: "Campo não encontrado." }, { status: 404 });
    if (!campo.accessPasswordHash) {
      return NextResponse.json({ error: "Este campo não possui senha de acesso configurada." }, { status: 400 });
    }

    const isValid = await bcryptjs.compare(password, campo.accessPasswordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }

    // Senha aceita = o usuario passa a PERTENCER a este campo.
    //
    // Sem isto a troca era so visual: o backend continuava lendo users.campo_id
    // (getAuthUser recarrega o perfil do banco a cada requisicao) e o usuario
    // seguia enxergando o campo antigo — ou, no caso do master, todos eles.
    if (user.id && user.campoId !== campo.id) {
      // Igreja/regional do campo anterior nao valem mais: se apontam para outro
      // campo, sao zeradas para nao vazar escopo nem gravar registro no lugar
      // errado. Se ja pertencem ao campo novo, ficam como estao.
      const currentChurch = user.churchId
        ? await prisma.church.findFirst({
            where: { id: user.churchId },
            select: { id: true, regional: { select: { campoId: true } } },
          })
        : null;
      const churchBelongs = currentChurch?.regional?.campoId === campo.id;

      const currentRegional = user.regionalId
        ? await prisma.regional.findFirst({ where: { id: user.regionalId }, select: { campoId: true } })
        : null;
      const regionalBelongs = currentRegional?.campoId === campo.id;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          campoId: campo.id,
          ...(user.churchId && !churchBelongs ? { churchId: null } : {}),
          ...(user.regionalId && !regionalBelongs ? { regionalId: null } : {}),
        },
      });
    }

    const safeCampo = { id: campo.id, name: campo.name };
    return NextResponse.json({ success: true, campo: serializeBigInts(safeCampo) });
  });
}
