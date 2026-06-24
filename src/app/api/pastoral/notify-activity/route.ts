import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendTextViaZApi } from "@/lib/whatsappSendService";

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  agendamento: "Agendamento",
  ligacao: "Ligação",
  videochamada: "Videochamada",
  reuniao: "Reunião",
  visita: "Visita",
  retorno: "Retorno",
  oracao: "Oração",
  followup: "Follow-up",
  task: "Tarefa",
  pendencia: "Pendência",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { attendanceId, churchId, activityType, title, origin } = body;

    if (!attendanceId || !activityType || !title || !churchId) {
      return NextResponse.json({ error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
    }

    // 1. Fetch card details
    const { data: attendance, error: attErr } = await supabaseAdmin
      .from("pastoral_attendances")
      .select("phone, visitor_name")
      .eq("id", attendanceId)
      .single();

    if (attErr || !attendance) {
      return NextResponse.json({ error: "Card de atendimento não encontrado." }, { status: 404 });
    }

    const { phone, visitor_name } = attendance;

    if (!phone) {
      return NextResponse.json({ success: true, message: "Card sem telefone cadastrado." });
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    if (!normalizedPhone) {
      return NextResponse.json({ success: true, message: "Telefone inválido." });
    }

    // 2. Draft activity creation message
    const name = visitor_name || "Prezado(a)";
    const baseOrigin = origin || "https://adcampinas.org";
    const timelineLink = `${baseOrigin}/pastoral/timeline/${attendanceId}`;
    const activityLabel = ACTIVITY_TYPE_LABELS[activityType.toLowerCase()] || activityType;
    
    const message = `A Paz do Senhor Jesus, *${name}*! ✨\n\nQue Deus abençoe a sua vida! Passando para informar que a sua solicitação de atendimento pastoral na AD Campinas está em andamento. Uma nova atividade foi registrada:\n\n*Tipo:* ${activityLabel}\n*Título:* ${title}\n\nEstamos acompanhando e cuidando com carinho do seu caso. Acompanhe a evolução do seu atendimento em tempo real pelo link abaixo:\n${timelineLink}`;

    // 3. Find connected WhatsApp instance (instance zero)
    const { data: instance } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("instance_id, token, client_token")
      .eq("is_active", true)
      .eq("status", "connected")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (instance) {
      await sendTextViaZApi(instance, normalizedPhone, message).catch((err) => {
        console.error("[notify-activity] Z-API send failed:", err);
      });
    } else {
      console.warn("[notify-activity] No active connected WhatsApp instance found.");
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[POST /api/pastoral/notify-activity]", e);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
