import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (user) => {
    try {
      const { id } = await params;
      const body = await req.json().catch(() => ({}));
      const { status } = body;

      if (!id || !status) {
        return NextResponse.json({ error: "ID e status são obrigatórios." }, { status: 400 });
      }

      if (!["approved", "rejected", "pending"].includes(status)) {
        return NextResponse.json({ error: "Status inválido." }, { status: 400 });
      }

      // Fetch request to get pipeline card ID
      const { data: request } = await supabaseAdmin
        .from("new_member_requests")
        .select("pipeline_card_id, church_id")
        .eq("id", id)
        .single();

      if (!request) {
        return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
      }

      // Update new_member_requests status
      const { error: updErr } = await supabaseAdmin
        .from("new_member_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (updErr) throw updErr;

      // If card ID is linked, update card status accordingly
      if (request.pipeline_card_id) {
        if (status === "approved" || status === "rejected") {
          const targetStatus = status === "approved" ? "done" : "cancelled";
          
          // Get columns to find column ID for 'done' or 'cancelled'
          const { data: cols } = await supabaseAdmin
            .from("pastoral_pipeline_columns")
            .select("id, column_key")
            .eq("church_id", request.church_id);

          const targetCol = cols?.find((c) => c.column_key === targetStatus);
          
          if (targetCol) {
            await supabaseAdmin
              .from("pastoral_attendances")
              .update({
                status: targetStatus,
                column_id: targetCol.id,
                completed_at: status === "approved" ? new Date().toISOString() : null,
                cancelled_at: status === "rejected" ? new Date().toISOString() : null,
              })
              .eq("id", request.pipeline_card_id);
          }
        }
      }

      return NextResponse.json({ success: true });
    } catch (e) {
      console.error("[PUT /api/membership-requests/[id]]", e);
      return NextResponse.json({ error: "Erro ao atualizar solicitação." }, { status: 500 });
    }
  });
}
