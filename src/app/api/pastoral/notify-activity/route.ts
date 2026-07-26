import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendTextViaZApi } from "@/lib/whatsappSendService";
import { buildActivityMessage, resolveTimelineUrl } from "@/lib/pastoralActivityMessage";

/**
 * POST /api/pastoral/notify-activity — avisa a pessoa atendida, por WhatsApp,
 * que uma atividade foi registrada no atendimento dela.
 *
 * O corpo pode trazer `message` — o texto que o atendente editou na tela. Sem
 * ele, monta o rascunho padrão. Como o texto vem do cliente, a rota exige
 * sessão: sem isso seria um relay aberto de WhatsApp.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const body = await req.json().catch(() => ({}));
      const { attendanceId, churchId, activityType, title, description, scheduledDate, origin, message } = body;

      if (!attendanceId || !activityType || !title || !churchId) {
        return NextResponse.json({ error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
      }

      // 1. Fetch card details
      const { data: attendance, error: attErr } = await supabaseAdmin
        .from("pastoral_attendances")
        .select("phone, visitor_name, churches(name)")
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

      // 2. Texto: o que o atendente escreveu manda; senão, o rascunho padrão
      const churchName = (attendance as { churches?: { name?: string } | null }).churches?.name ?? null;
      const finalMessage = String(message ?? "").trim() || buildActivityMessage({
        name: visitor_name,
        activityType,
        title,
        description,
        scheduledDate,
        churchName,
        timelineUrl: resolveTimelineUrl(attendanceId, origin || req.headers.get("origin")),
      });

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
        await sendTextViaZApi(instance, normalizedPhone, finalMessage).catch((err) => {
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
  });
}
