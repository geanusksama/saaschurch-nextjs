import { NextRequest, NextResponse } from "next/server";
import { signToken, hashCode } from "@/lib/membroJwt";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendTextViaZApi } from "@/lib/whatsappSendService";

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { phone } = body as { phone?: string };

    if (!phone) {
      return NextResponse.json({ error: "Telefone é obrigatório." }, { status: 400 });
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.length < 10) {
      return NextResponse.json({ error: "Telefone inválido." }, { status: 422 });
    }

    // Get first active connected WhatsApp instance (instancia zero)
    const { data: instance } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("instance_id, token, client_token")
      .eq("is_active", true)
      .eq("status", "connected")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!instance) {
      return NextResponse.json(
        { error: "Serviço de mensagens temporariamente indisponível." },
        { status: 503 }
      );
    }

    const code = generateCode();
    const message = `🔐 AD Campinas\n\nSeu código de confirmação é:\n\n*${code}*\n\nVálido por 10 minutos.`;

    const result = await sendTextViaZApi(instance, normalizedPhone, message);
    if (result.status === "error") {
      console.error("[pastoral/send-otp] WhatsApp send failed:", result.error);
      return NextResponse.json(
        { error: "Não foi possível enviar o código por WhatsApp. Tente novamente." },
        { status: 502 }
      );
    }

    const otpToken = signToken(
      { phone: normalizedPhone, code_hash: hashCode(code) },
      10 * 60 // 10 minutes
    );

    return NextResponse.json({ otp_token: otpToken });
  } catch (e) {
    console.error("[POST /api/public/pastoral/send-otp]", e);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
