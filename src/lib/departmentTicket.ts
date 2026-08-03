/**
 * Ingresso das inscrições de departamento.
 *
 * Espelha o fluxo do Peniel (`penielTicket.ts`) — código de check-in, QR e
 * mensagem no WhatsApp — só que sobre `department_event_registrations`.
 * As peças de baixo nível (QR, normalização de telefone, envio) são as mesmas;
 * o que muda é de onde vêm os dados.
 */
import { supabaseAdmin } from "@/lib/supabase-admin";
import { quickSendWhatsApp } from "@/lib/whatsappSendService";
import {
  generateAndUploadQr,
  generateCheckInCode,
  normalizeBrazilPhone,
} from "@/lib/penielTicket";

/** Instância de WhatsApp do campo — reaproveita a configuração do Peniel. */
async function instanciaDoCampo(campoId: string) {
  const { data: config } = await supabaseAdmin
    .from("peniel_configs")
    .select("whatsapp_instance_id")
    .eq("campo_id", campoId)
    .maybeSingle();

  const instanceId = config?.whatsapp_instance_id;
  if (!instanceId) return null;

  const { data: instancia } = await supabaseAdmin
    .from("whatsapp_instances")
    .select("owner_user_id")
    .eq("id", instanceId)
    .maybeSingle();

  const ownerUserId = instancia?.owner_user_id;
  if (!ownerUserId) return null;

  return { instanceId, ownerUserId };
}

function moeda(v: number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataLegivel(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface DadosMensagem {
  nome: string;
  codigo: string;
  evento: string;
  data: string | null;
  local: string | null;
  quantidade: number;
  valorTotal: number;
  pagamentoPendente: boolean;
  paymentLink?: string | null;
  instrucoes?: string | null;
}

export function montarMensagemIngresso(d: DadosMensagem): string {
  const linhas = [`Olá, *${d.nome}*!`, ""];

  if (d.pagamentoPendente) {
    linhas.push(
      `Sua inscrição em *${d.evento}* foi registrada e está *aguardando pagamento*.`,
      "",
      `💰 *Valor:* ${moeda(d.valorTotal)}`,
    );
    if (d.paymentLink) linhas.push(`💳 *Link de pagamento:* ${d.paymentLink}`);
    linhas.push("", `Depois de pagar, envie o comprovante usando seu código: *${d.codigo}*.`);
    if (d.instrucoes) linhas.push("", d.instrucoes);
  } else {
    linhas.push(`Sua inscrição em *${d.evento}* está *confirmada*! 🎉`, "");
    if (d.data) linhas.push(`📅 *Quando:* ${dataLegivel(d.data)}`);
    if (d.local) linhas.push(`📍 *Onde:* ${d.local}`);
    if (d.quantidade > 1) linhas.push(`🎟️ *Ingressos:* ${d.quantidade}`);
    linhas.push("", `🔑 *Código de check-in:* ${d.codigo}`, "",
                "Apresente o QR desta mensagem na entrada.");
  }

  linhas.push("", "Que Deus te abençoe! 🙏");
  return linhas.join("\n");
}

/**
 * Envia (ou reenvia) o ingresso de uma inscrição de departamento.
 * Idempotente: garante código e QR persistidos antes de mandar.
 *
 * Nunca lança — o chamador não deve perder a inscrição por falha de mensageria.
 */
export async function enviarIngressoDepartamento(
  registrationId: string,
): Promise<{ ok: boolean; motivo?: string }> {
  try {
    const { data: reg } = await supabaseAdmin
      .from("department_event_registrations")
      .select("*")
      .eq("id", registrationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!reg) return { ok: false, motivo: "inscricao_nao_encontrada" };
    if (!reg.campo_id) return { ok: false, motivo: "sem_campo" };

    const instancia = await instanciaDoCampo(reg.campo_id);
    if (!instancia) return { ok: false, motivo: "sem_instancia_whatsapp" };

    const { data: evento } = await supabaseAdmin
      .from("app_events")
      .select("nome, title, data_inicio, local, local_endereco")
      .eq("id", reg.event_id)
      .maybeSingle();

    const { data: form } = await supabaseAdmin
      .from("department_event_forms")
      .select("payment_link, instrucoes_pagamento")
      .eq("event_id", reg.event_id)
      .maybeSingle();

    // Garante código e QR
    let codigo: string = reg.check_in_code;
    if (!codigo) {
      codigo = generateCheckInCode();
      await supabaseAdmin.from("department_event_registrations")
        .update({ check_in_code: codigo }).eq("id", reg.id);
    }

    let qrUrl: string | null = reg.qr_code_url;
    if (!qrUrl) {
      qrUrl = await generateAndUploadQr(codigo);
      if (qrUrl) {
        await supabaseAdmin.from("department_event_registrations")
          .update({ qr_code_url: qrUrl }).eq("id", reg.id);
      }
    }

    const pagamentoPendente = reg.payment_status === "PENDENTE";

    const mensagem = montarMensagemIngresso({
      nome: reg.nome,
      codigo,
      evento: evento?.nome ?? evento?.title ?? "evento",
      data: evento?.data_inicio ?? null,
      local: evento?.local ?? evento?.local_endereco ?? null,
      quantidade: reg.quantidade ?? 1,
      valorTotal: Number(reg.valor_total ?? 0),
      pagamentoPendente,
      paymentLink: form?.payment_link,
      instrucoes: form?.instrucoes_pagamento,
    });

    const res = await quickSendWhatsApp({
      ownerUserId: instancia.ownerUserId,
      phone: normalizeBrazilPhone(reg.telefone),
      message: mensagem,
      contactName: reg.nome,
      instanceId: instancia.instanceId,
      // Só manda o QR quando a vaga já está garantida — QR de inscrição
      // pendente confunde na portaria.
      imageUrl: !pagamentoPendente && qrUrl ? qrUrl : undefined,
    });

    return { ok: res.status === "sent", motivo: res.error };
  } catch (e) {
    console.error("[departmentTicket] falhou:", e);
    return { ok: false, motivo: (e as Error).message };
  }
}
