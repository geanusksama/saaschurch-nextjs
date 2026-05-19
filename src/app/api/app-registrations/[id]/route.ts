import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    const { id } = await params;
    const body = await req.json() as { status?: string; observacoes?: string; member_id?: string | null };

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (body.status !== undefined) {
      setClauses.push(`status = $${i++}`);
      values.push(body.status);
    }
    if (body.observacoes !== undefined) {
      setClauses.push(`observacoes = $${i++}`);
      values.push(body.observacoes);
    }
    if (body.member_id !== undefined) {
      setClauses.push(`member_id = $${i++}`);
      values.push(body.member_id);
    }

    if (!setClauses.length) {
      return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
    }

    setClauses.push(`updated_at = now()`);
    values.push(id);

    await prisma.$executeRawUnsafe(
      `UPDATE app_cadastros SET ${setClauses.join(", ")} WHERE id = $${i}::uuid`,
      ...values
    );

    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo"].includes(user.profileType)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const { id } = await params;

    // Busca o registro para obter o user_id antes de deletar
    const rows = await prisma.$queryRaw<{ user_id: string | null }[]>`
      SELECT user_id FROM app_cadastros WHERE id = ${id}::uuid LIMIT 1
    `;

    if (!rows.length) {
      return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });
    }

    const userId = rows[0].user_id;

    // Deleta o cadastro
    await prisma.$executeRawUnsafe(
      `DELETE FROM app_cadastros WHERE id = $1::uuid`,
      id
    );

    // Se tiver user_id, deleta do auth.users via Supabase Admin
    if (userId) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        // Loga mas não falha — o cadastro já foi deletado
        console.error(`[app-registrations] Falha ao deletar auth.users ${userId}:`, error.message);
      }
    }

    return new NextResponse(null, { status: 204 });
  });
}
