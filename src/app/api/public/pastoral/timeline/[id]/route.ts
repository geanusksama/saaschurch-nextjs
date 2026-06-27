import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });
    }

    const { data: attendance, error: atErr } = await supabaseAdmin
      .from("pastoral_attendances")
      .select("id, visitor_name, attendance_type, status, created_at, church_id, churches(name)")
      .eq("id", id)
      .maybeSingle();

    if (atErr || !attendance) {
      return NextResponse.json({ error: "Atendimento não encontrado." }, { status: 404 });
    }

    const { data: timeline, error: tlErr } = await supabaseAdmin
      .from("pastoral_attendance_timeline")
      .select("id, event_type, description, created_at, metadata")
      .eq("attendance_id", id)
      .order("created_at", { ascending: true });

    if (tlErr) throw tlErr;

    // Filter out private timeline entries
    const publicTimeline = (timeline || [])
      .filter((t: any) => !t.metadata?.is_private)
      .map((t: any) => ({
        id: t.id,
        event_type: t.event_type,
        description: t.description,
        created_at: t.created_at,
      }));

    // Get current position in column
    let position = 1;
    if (attendance.status === "open") {
      const { count } = await supabaseAdmin
        .from("pastoral_attendances")
        .select("id", { count: "exact", head: true })
        .eq("church_id", attendance.church_id)
        .eq("status", "open")
        .is("deleted_at", null);
      position = count || 1;
    }

    return NextResponse.json({
      attendance: {
        id: attendance.id,
        name: attendance.visitor_name || "Visitante",
        type: attendance.attendance_type,
        status: attendance.status,
        createdAt: attendance.created_at,
        churchName: (attendance.churches as any)?.name || "AD Campinas",
      },
      timeline: publicTimeline,
      position,
    });
  } catch (e) {
    console.error("[GET /api/public/pastoral/timeline/[id]]", e);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
