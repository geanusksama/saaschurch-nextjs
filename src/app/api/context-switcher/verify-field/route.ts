import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { esquecerSessao, withAuth } from "@/lib/auth";
import bcryptjs from "bcryptjs";
import { serializeBigInts } from "@/lib/helpers";
import { CampoNavegavelError, campoLiberadoParaUsuario, trocarDeCampo } from "@/lib/camposNavegaveis";

/**
 * Troca de campo.
 *
 * - master: qualquer campo, com a senha do campo;
 * - demais perfis: só os campos que o master liberou para eles (user_campos),
 *   sem senha. Sem liberação, 403 — inclusive para admin.
 *
 * A troca grava o novo campo e a lotação dele no usuário (ver
 * lib/camposNavegaveis.ts). getAuthUser relê o usuário do banco a cada
 * requisição, então dali em diante tudo — rotas e RLS — enxerga só o campo novo.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { campoId, fieldId, password } = body;
    const resolvedCampoId = campoId || fieldId;
    if (!resolvedCampoId) {
      return NextResponse.json({ error: "campoId é obrigatório." }, { status: 400 });
    }

    const campo = await prisma.campo.findFirst({
      where: { id: resolvedCampoId, deletedAt: null },
      select: { id: true, name: true, accessPasswordHash: true },
    });
    if (!campo) return NextResponse.json({ error: "Campo não encontrado." }, { status: 404 });

    if (user.profileType === "master") {
      if (!password) return NextResponse.json({ error: "Informe a senha do campo." }, { status: 400 });
      if (!campo.accessPasswordHash) {
        return NextResponse.json({ error: "Este campo não possui senha de acesso configurada." }, { status: 400 });
      }
      const isValid = await bcryptjs.compare(password, campo.accessPasswordHash);
      if (!isValid) return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    } else if (!(await campoLiberadoParaUsuario(user.id, campo.id))) {
      return NextResponse.json({ error: "Seu usuário não tem acesso a este campo." }, { status: 403 });
    }

    try {
      const resultado = await trocarDeCampo(user, campo.id);
      esquecerSessao(req);
      return NextResponse.json(serializeBigInts({ success: true, ...resultado }));
    } catch (err) {
      if (err instanceof CampoNavegavelError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  });
}
