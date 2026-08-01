import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/cell-groups/[id]/contacts
 *
 * Contatos de listas importadas anexados ao GF + os tokens dos links públicos
 * já emitidos (por pessoa), para a tela conseguir abrir o mesmo resumo que o
 * líder recebeu no WhatsApp.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;

    const [{ data: contacts, error }, { data: links }] = await Promise.all([
      supabaseAdmin
        .from("whatsapp_import_rows")
        .select("id, name, phone, batch_id, cell_group_assigned_at")
        .eq("cell_group_id", id)
        .order("cell_group_assigned_at", { ascending: false }),
      supabaseAdmin
        .from("cell_group_share_links")
        .select("token, member_id, import_row_id, created_at")
        .eq("cell_group_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // O mais recente vence: se a pessoa foi removida e anexada de novo, o link
    // que vale é o do último encaminhamento.
    const shareTokens: Record<string, string> = {};
    for (const l of links ?? []) {
      const key = l.member_id ? `m:${l.member_id}` : l.import_row_id ? `i:${l.import_row_id}` : null;
      if (key && !shareTokens[key]) shareTokens[key] = l.token;
    }

    return NextResponse.json({ contacts: contacts ?? [], shareTokens });
  });
}
