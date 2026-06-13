import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTicketWhatsApp } from "@/lib/penielTicket";

// GET /api/peniel/registrations/lookup?code=XXXX  (público)
// Consulta de inscrição pelo código recebido na confirmação.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Informe o código da inscrição." }, { status: 400 });

  const reg = await prisma.penielRegistration.findUnique({
    where: { checkInCode: code },
    include: {
      event: { select: { title: true, date: true, time: true, location: true, value: true, paymentLink: true } }
    }
  });

  if (!reg || reg.deletedAt) {
    return NextResponse.json({ error: "Inscrição não encontrada. Confira o código." }, { status: 404 });
  }

  return NextResponse.json({
    id: reg.id,
    nome: reg.nome,
    code: reg.checkInCode,
    checkInCode: reg.checkInCode,
    tipoParticipante: reg.tipoParticipante,
    celular: reg.celular,
    igrejaBase: reg.igrejaBase,
    additionalFields: reg.additionalFields,
    status: reg.status,
    checkedIn: reg.checkedIn,
    paymentStatus: reg.paymentStatus,
    paymentPromiseDate: reg.paymentPromiseDate,
    hasProof: !!reg.paymentProofUrl,
    paymentProofUrl: reg.paymentProofUrl,
    event: reg.event
  });
}

// POST /api/peniel/registrations/lookup  (público)
// Anexa o comprovante (proofUrl já enviado via /upload-proof) a uma inscrição pelo código.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = (body.code || "").toString().trim().toUpperCase();
  const action = (body.action || "").toString();
  const proofUrl = (body.proofUrl || "").toString();

  if (!code) {
    return NextResponse.json({ error: "Código é obrigatório." }, { status: 400 });
  }

  const reg = await prisma.penielRegistration.findUnique({ where: { checkInCode: code } });
  if (!reg || reg.deletedAt) {
    return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });
  }

  // Reenviar o QR/ingresso para o WhatsApp do próprio inscrito
  if (action === "resend") {
    const res = await sendTicketWhatsApp(reg.id);
    if (!res.ok) {
      return NextResponse.json({ error: "Não foi possível reenviar agora. Tente mais tarde." }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  }

  // Anexar comprovante
  if (!proofUrl) {
    return NextResponse.json({ error: "Comprovante é obrigatório." }, { status: 400 });
  }
  const updated = await prisma.penielRegistration.update({
    where: { id: reg.id },
    data: { paymentProofUrl: proofUrl, paymentStatus: "comprovante_enviado" }
  });

  return NextResponse.json({ success: true, paymentStatus: updated.paymentStatus });
}
