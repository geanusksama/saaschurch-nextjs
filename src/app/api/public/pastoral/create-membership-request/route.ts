import { NextRequest, NextResponse } from "next/server";
import { verifyToken, hashCode } from "@/lib/membroJwt";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendTextViaZApi } from "@/lib/whatsappSendService";

const DEFAULT_SEDE_ID = "6d2688df-5249-4bd2-89cc-0cd8c324b3d8";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      name,
      whatsapp,
      isMarried,
      pastChurches,
      afroBackground,
      scheduledDate,
      otp_token,
      code,
      churchId,
    } = body;

    if (!name || !whatsapp || !scheduledDate || !otp_token || !code) {
      return NextResponse.json({ error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
    }

    const payload = verifyToken<{ phone: string; code_hash: string }>(otp_token);
    if (!payload) {
      return NextResponse.json({ error: "Código expirado. Solicite um novo código." }, { status: 401 });
    }

    const normalizedPhone = whatsapp.replace(/\D/g, "");
    if (payload.phone !== normalizedPhone || hashCode(code.trim()) !== payload.code_hash) {
      return NextResponse.json({ error: "Código inválido ou incorreto." }, { status: 401 });
    }

    const targetChurchId = churchId || DEFAULT_SEDE_ID;

    // 1. Get or create pipeline
    let { data: pipeline } = await supabaseAdmin
      .from("pastoral_pipelines")
      .select("id")
      .eq("church_id", targetChurchId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (!pipeline) {
      const { data: createdPipeline, error: cpErr } = await supabaseAdmin
        .from("pastoral_pipelines")
        .insert({ church_id: targetChurchId, name: "Atendimento Pastoral", active: true })
        .select("id")
        .single();
      if (cpErr) throw cpErr;
      pipeline = createdPipeline;
    }

    // 2. Get or create columns
    let { data: col } = await supabaseAdmin
      .from("pastoral_pipeline_columns")
      .select("id")
      .eq("pipeline_id", pipeline.id)
      .eq("column_key", "todo")
      .limit(1)
      .maybeSingle();

    if (!col) {
      const DEFAULT_COLUMNS = [
        { name: "POR FAZER", position: 0, color: "#94a3b8", column_key: "todo", icon: "circle" },
        { name: "FAZENDO", position: 1, color: "#3b82f6", column_key: "doing", icon: "loader" },
        { name: "CONCLUÍDO", position: 2, color: "#22c55e", column_key: "done", icon: "check-circle" },
        { name: "CANCELADO", position: 3, color: "#ef4444", column_key: "cancelled", icon: "x-circle" },
      ];
      const { data: insertedCols, error: icErr } = await supabaseAdmin
        .from("pastoral_pipeline_columns")
        .insert(
          DEFAULT_COLUMNS.map((c) => ({
            ...c,
            pipeline_id: pipeline.id,
            church_id: targetChurchId,
            fixed_column: true,
          }))
        )
        .select("id, column_key");

      if (icErr) throw icErr;
      col = insertedCols?.find((c) => c.column_key === "todo") || insertedCols?.[0];
    }

    // 3. Create pastoral attendance card
    const notesStr = `Solicitação de Novo Membro. Marido/Esposa: ${
      isMarried ? "Casado(a)" : "Solteiro(a)"
    }. Igrejas Anteriores: ${pastChurches || "Nenhuma"}. Antecedente Afro: ${
      afroBackground ? "Sim" : "Não"
    }. Data de agendamento: ${scheduledDate}`;

    const { data: attendance, error: atErr } = await supabaseAdmin
      .from("pastoral_attendances")
      .insert({
        church_id: targetChurchId,
        pipeline_id: pipeline.id,
        column_id: col.id,
        visitor_name: name,
        phone: normalizedPhone,
        attendance_type: "quero_ser_membro",
        notes: notesStr,
        status: "open",
        priority: "normal",
        started_at: new Date().toISOString(),
        tags: [],
      })
      .select("id")
      .single();

    if (atErr) throw atErr;

    // 4. Create record in new_member_requests
    const { data: request, error: reqErr } = await supabaseAdmin
      .from("new_member_requests")
      .insert({
        name,
        whatsapp: normalizedPhone,
        is_married: !!isMarried,
        past_churches: pastChurches || "",
        afro_background: !!afroBackground,
        scheduled_date: scheduledDate,
        pipeline_card_id: attendance.id,
        status: "pending",
        church_id: targetChurchId,
      })
      .select("id")
      .single();

    if (reqErr) throw reqErr;

    // 5. Create timeline entry
    await supabaseAdmin.from("pastoral_attendance_timeline").insert({
      attendance_id: attendance.id,
      church_id: targetChurchId,
      event_type: "created",
      description: "Agendamento de Novo Membro criado via portal público",
    });

    // 6. Compute queue position (number of open cards of same type in POR FAZER column)
    const { count } = await supabaseAdmin
      .from("pastoral_attendances")
      .select("id", { count: "exact", head: true })
      .eq("church_id", targetChurchId)
      .eq("column_id", col.id)
      .eq("status", "open")
      .is("deleted_at", null);

    const position = count || 1;

    // 7. Get first active connected WhatsApp instance (instancia zero) and send confirmation
    const { data: instance } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("instance_id, token, client_token")
      .eq("is_active", true)
      .eq("status", "connected")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (instance) {
      const formattedDate = new Date(scheduledDate + "T12:00:00").toLocaleDateString("pt-BR");
      const message = `Olá, *${name}*! 🎉\n\nRecebemos seu pedido para se tornar membro da AD Campinas.\n\nSua entrevista foi agendada para: *${formattedDate}*.\n\nVocê está atualmente na posição *#${position}* na fila de atendimento.\n\nEm breve entraremos em contato. Deus te abençoe!`;
      await sendTextViaZApi(instance, normalizedPhone, message).catch((err) => {
        console.error("[create-membership-request] Z-API send failed:", err);
      });
    }

    return NextResponse.json({ success: true, position, attendanceId: attendance.id });
  } catch (e) {
    console.error("[POST /api/public/pastoral/create-membership-request]", e);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
