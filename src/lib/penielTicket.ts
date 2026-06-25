/**
 * penielTicket — utilitários do "ingresso" Peniel:
 * geração de código de check-in, QR code e montagem da mensagem de WhatsApp.
 */
import QRCode from "qrcode";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { prisma } from "@/lib/prisma";
import { quickSendWhatsApp } from "@/lib/whatsappSendService";

// Normaliza telefone para o formato esperado pela Z-API (com DDI 55).
export function normalizeBrazilPhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  // Já com DDI 55 (12-13 dígitos): mantém
  if (d.startsWith("55") && d.length >= 12) return d;
  // Sem DDI mas com DDD + número (10-11 dígitos): adiciona 55
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

// Código curto, legível (sem caracteres ambíguos), para entrada manual no check-in.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateCheckInCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/**
 * Gera o PNG do QR (contendo o código de check-in), faz upload no storage e
 * retorna a URL pública. O QR codifica apenas o código — o check-in valida no banco.
 */
export async function generateAndUploadQr(code: string): Promise<string | null> {
  try {
    const pngBuffer = await QRCode.toBuffer(code, {
      type: "png",
      width: 600,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0b2819", light: "#ffffff" }
    });

    const path = `peniel/qrcodes/${code}.png`;
    const { error } = await supabaseAdmin.storage
      .from("dados")
      .upload(path, pngBuffer, { upsert: true, contentType: "image/png" });

    if (error) {
      console.error("[penielTicket] upload QR falhou:", error.message);
      return null;
    }

    const { data } = supabaseAdmin.storage.from("dados").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error("[penielTicket] erro ao gerar QR:", e);
    return null;
  }
}

interface TicketMsgParams {
  nome: string;
  code: string;
  status: string; // inscrito | fila_espera
  eventTitle: string;
  eventDate: Date;
  eventTime: string;
  eventLocation: string;
  departureLocation?: string | null;
  value: number;
}

/** Monta a legenda/mensagem do ingresso enviada junto ao QR. */
export function buildTicketMessage(p: TicketMsgParams): string {
  const dateStr = new Date(p.eventDate).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  const valueStr = Number(p.value) === 0
    ? "Gratuito"
    : Number(p.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (p.status === "fila_espera") {
    return `Olá, *${p.nome}*!\n\nSua inscrição no encontro *${p.eventTitle}* foi colocada na *Fila de Espera*, pois as vagas principais se esgotaram.\n\nCaso surja uma desistência, entraremos em contato imediatamente.\n\nSeu código: *${p.code}*\nQue Deus te abençoe! 🙏`;
  }

  let msg = `Olá, *${p.nome}*! 🎉\n\nSua inscrição para o *${p.eventTitle}* está *CONFIRMADA*!\n\n`;
  msg += `🎟️ *INGRESSO DIGITAL*\n`;
  msg += `Apresente o QR Code abaixo no check-in.\n\n`;
  msg += `📅 *Data:* ${dateStr}\n`;
  msg += `🕒 *Horário:* ${p.eventTime}\n`;
  msg += `📍 *Local:* ${p.eventLocation}\n`;
  if (p.departureLocation) msg += `🚌 *Saída:* ${p.departureLocation}\n`;
  msg += `💳 *Valor:* ${valueStr}\n\n`;
  msg += `🔑 *Código (caso o QR não leia):* ${p.code}\n\n`;
  msg += `Guarde esta mensagem. Nos vemos lá!\nQue Deus te abençoe! 🙏`;
  return msg;
}

/**
 * Envia (ou reenvia) o ingresso por WhatsApp para uma inscrição: garante código
 * e QR, persiste-os, e dispara a mensagem com o QR como imagem.
 * Idempotente — pode ser chamada de novo para reenviar.
 */
export async function sendTicketWhatsApp(
  registrationId: string
): Promise<{ ok: boolean; reason?: string }> {
  const reg = await prisma.penielRegistration.findUnique({
    where: { id: registrationId },
    include: { event: true }
  });
  if (!reg || reg.deletedAt) return { ok: false, reason: "not_found" };

  const event = reg.event;

  const config = await prisma.penielConfig.findUnique({
    where: { campoId: event.campoId },
    select: { whatsappInstanceId: true }
  });
  if (!config?.whatsappInstanceId) return { ok: false, reason: "no_instance" };

  const { data: instanceData } = await supabaseAdmin
    .from("whatsapp_instances")
    .select("owner_user_id")
    .eq("id", config.whatsappInstanceId)
    .single();
  const ownerUserId = instanceData?.owner_user_id || "";
  if (!ownerUserId) return { ok: false, reason: "no_owner" };

  // Garante código e QR persistidos
  let code = reg.checkInCode;
  if (!code) {
    code = generateCheckInCode();
    await prisma.penielRegistration.update({ where: { id: reg.id }, data: { checkInCode: code } });
  }
  let qrUrl = reg.qrCodeUrl;
  if (!qrUrl) {
    qrUrl = await generateAndUploadQr(code);
    if (qrUrl) await prisma.penielRegistration.update({ where: { id: reg.id }, data: { qrCodeUrl: qrUrl } });
  }

  const message = buildTicketMessage({
    nome: reg.nome,
    code,
    status: reg.status,
    eventTitle: event.title,
    eventDate: event.date,
    eventTime: event.time,
    eventLocation: event.location,
    departureLocation: event.departureLocation,
    value: Number(event.value)
  });

  // Confirmado com QR → envia imagem; fila de espera ou sem QR → texto
  const res = await quickSendWhatsApp({
    ownerUserId,
    phone: normalizeBrazilPhone(reg.celular),
    message,
    contactName: reg.nome,
    instanceId: config.whatsappInstanceId,
    imageUrl: reg.status === "inscrito" && qrUrl ? qrUrl : undefined
  });

  return { ok: res.status === "sent", reason: res.error };
}

/** Envia um lembrete de pagamento pendente por WhatsApp (com link e código). */
export async function sendPaymentReminder(
  registrationId: string
): Promise<{ ok: boolean; reason?: string }> {
  const reg = await prisma.penielRegistration.findUnique({
    where: { id: registrationId },
    include: { event: true }
  });
  if (!reg || reg.deletedAt) return { ok: false, reason: "not_found" };

  const event = reg.event;
  const config = await prisma.penielConfig.findUnique({
    where: { campoId: event.campoId },
    select: { whatsappInstanceId: true }
  });
  if (!config?.whatsappInstanceId) return { ok: false, reason: "no_instance" };

  const { data: instanceData } = await supabaseAdmin
    .from("whatsapp_instances")
    .select("owner_user_id")
    .eq("id", config.whatsappInstanceId)
    .single();
  const ownerUserId = instanceData?.owner_user_id || "";
  if (!ownerUserId) return { ok: false, reason: "no_owner" };

  const valueStr = Number(event.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  let msg = `Olá, *${reg.nome}*!\n\nNotamos que o pagamento da sua inscrição no *${event.title}* ainda está *pendente* (valor: ${valueStr}).\n\n`;
  if (event.paymentLink) msg += `💳 *Link de pagamento:* ${event.paymentLink}\n\n`;
  msg += `Após pagar, envie o comprovante na página de consulta usando seu código: *${reg.checkInCode}*.\n\nQue Deus te abençoe! 🙏`;

  const res = await quickSendWhatsApp({
    ownerUserId,
    phone: normalizeBrazilPhone(reg.celular),
    message: msg,
    contactName: reg.nome,
    instanceId: config.whatsappInstanceId
  });
  return { ok: res.status === "sent", reason: res.error };
}

/**
 * Envia a mensagem de "inscrição recebida, aguardando pagamento" por WhatsApp.
 * Usada quando a inscrição é criada sem comprovante (opção "pagar depois") em um
 * evento pago — informa que a inscrição foi feita e está pendente de pagamento,
 * com link e código para envio do comprovante.
 */
export async function sendRegistrationAwaitingPayment(
  registrationId: string
): Promise<{ ok: boolean; reason?: string }> {
  const reg = await prisma.penielRegistration.findUnique({
    where: { id: registrationId },
    include: { event: true }
  });
  if (!reg || reg.deletedAt) return { ok: false, reason: "not_found" };

  const event = reg.event;
  const config = await prisma.penielConfig.findUnique({
    where: { campoId: event.campoId },
    select: { whatsappInstanceId: true }
  });
  if (!config?.whatsappInstanceId) return { ok: false, reason: "no_instance" };

  const { data: instanceData } = await supabaseAdmin
    .from("whatsapp_instances")
    .select("owner_user_id")
    .eq("id", config.whatsappInstanceId)
    .single();
  const ownerUserId = instanceData?.owner_user_id || "";
  if (!ownerUserId) return { ok: false, reason: "no_owner" };

  const valueStr = Number(event.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  let msg = `Olá, *${reg.nome}*!\n\nSua inscrição no *${event.title}* foi *realizada com sucesso* e está *aguardando pagamento* (valor: ${valueStr}).\n\n`;
  if (event.paymentLink) msg += `💳 *Link de pagamento:* ${event.paymentLink}\n\n`;
  msg += `Após pagar, envie o comprovante na página de consulta usando seu código: *${reg.checkInCode}*.\n\nAssim que confirmarmos o pagamento, sua vaga estará garantida.\nQue Deus te abençoe! 🙏`;

  const res = await quickSendWhatsApp({
    ownerUserId,
    phone: normalizeBrazilPhone(reg.celular),
    message: msg,
    contactName: reg.nome,
    instanceId: config.whatsappInstanceId
  });
  return { ok: res.status === "sent", reason: res.error };
}
