import { NextRequest, NextResponse } from "next/server";
import { verifyToken, hashCode } from "@/lib/membroJwt";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendTextViaZApi } from "@/lib/whatsappSendService";
import { findLiveAttendance, duplicateMessage } from "@/lib/pastoralDuplicateCheck";
import { randomUUID } from "crypto";
import { resolveSedeChurchOfCampo } from "@/lib/sedeResolver";
import { publicBaseUrl } from "@/lib/publicUrl";

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
      campoId,
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

    // Quando a pessoa escolhe o CAMPO, o pedido vai para a igreja SEDE daquele
    // campo. Se a resolução ficar ambígua (cadastro sujo), cai na sede padrão em
    // vez de mandar para a igreja errada — e o motivo fica no log.
    let targetChurchId = churchId || DEFAULT_SEDE_ID;
    let roteamentoNota = "";
    if (!churchId && campoId) {
      const sede = await resolveSedeChurchOfCampo(String(campoId));
      if (sede.churchId) {
        targetChurchId = sede.churchId;
      } else {
        // vários campos ainda não têm igreja sede cadastrada — isso não pode
        // derrubar o pedido; ele entra na sede padrão com o motivo registrado,
        // para a secretaria redirecionar quando o campo for configurado
        roteamentoNota =
          `Campo ${campoId} ainda sem igreja sede cadastrada — pedido roteado para a sede padrão.`;
        console.warn(`[create-membership-request] ${roteamentoNota}`);
      }
    }

    // 0. Já existe pedido de membresia vivo para este número? Reenviar o
    //    formulário (ou clicar duas vezes) não pode gerar um segundo card.
    const existing = await findLiveAttendance({
      churchId: targetChurchId,
      phone: normalizedPhone,
      attendanceType: "quero_ser_membro",
    });

    if (existing) {
      return NextResponse.json(
        {
          duplicate: true,
          error: duplicateMessage(existing, "Quero ser Membro"),
          stage: existing.stage,
          stageKey: existing.stageKey,
          attendanceId: existing.attendanceId,
          createdAt: existing.createdAt,
        },
        { status: 409 }
      );
    }

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
    // O token é a credencial do formulário de adesão: quem tem o link preenche.
    const formToken = randomUUID().replace(/-/g, "");
    // A adesão entra pela igreja que recebeu o pedido — no portal público isso
    // já é a SEDE (DEFAULT_SEDE_ID). NÃO usar churches.headquarters_id aqui:
    // aquela coluna é FK para a tabela `headquarters` (contatos/redes da sede),
    // não para uma igreja, e quebraria a FK de `members` na aprovação.
    const targetSedeId = targetChurchId;

    const { data: request, error: reqErr } = await supabaseAdmin
      .from("new_member_requests")
      .insert({
        form_token: formToken,
        form_sent_at: new Date().toISOString(),
        target_church_id: targetSedeId,
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
    // nunca usar body.origin cru: em dev isso viraria um link localhost no WhatsApp
    const baseOrigin = publicBaseUrl();
    const formUrl = `${String(baseOrigin).replace(/\/$/, "")}/membro/formulario/${formToken}`;

    await supabaseAdmin.from("pastoral_attendance_timeline").insert([
      {
        attendance_id: attendance.id,
        church_id: targetChurchId,
        event_type: "created",
        description:
          "Agendamento de Novo Membro criado via portal público" +
          (roteamentoNota ? ` · ${roteamentoNota}` : ""),
      },
      {
        // a pessoa consegue reabrir o formulário pela timeline pública do card,
        // sem depender de achar a mensagem no WhatsApp
        attendance_id: attendance.id,
        church_id: targetChurchId,
        event_type: "form",
        description: "Formulário de adesão enviado — aguardando preenchimento",
        metadata: { form_url: formUrl, form_token: formToken },
      },
    ]);

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

    return NextResponse.json({
      success: true,
      position,
      attendanceId: attendance.id,
      formUrl,
    });
  } catch (e) {
    console.error("[POST /api/public/pastoral/create-membership-request]", e);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
