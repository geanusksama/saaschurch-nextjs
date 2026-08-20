/**
 * Transcrição do áudio gravado na tela Assistentes.
 *
 * O usuário grava a pergunta falando, este endpoint devolve o texto e a tela
 * coloca esse texto no campo de mensagem — quem pergunta ainda revisa antes de
 * enviar, porque transcrição erra nome próprio e valor.
 *
 * A transcrição usa a Whisper da OpenAI mesmo quando o chat está configurado
 * para a Anthropic: a API da Anthropic não transcreve áudio. Por isso a chave
 * consultada aqui é SEMPRE a da OpenAI, independente do provedor ativo.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { getAiConfig } from "@/lib/aiConfig";

/** Limite do arquivo. Uma pergunta falada não passa disso nem de longe. */
const MAX_BYTES = 20 * 1024 * 1024;

/** Idioma configurado em Configurações de IA → código que a Whisper entende. */
const LANG_CODES: Record<string, string> = {
  "Português": "pt",
  "Inglês": "en",
  "Espanhol": "es",
};

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const config = await getAiConfig(user.campoId);
      if (!config.aiEnabled) {
        return NextResponse.json({ error: "IA está desabilitada." }, { status: 400 });
      }
      if (!config.openaiApiKey) {
        return NextResponse.json({
          error: "Transcrição de áudio precisa de uma chave da OpenAI cadastrada em Configurações de IA (a Anthropic não transcreve áudio).",
        }, { status: 400 });
      }

      const form = await req.formData();
      const file = form.get("audio");
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: "Nenhum áudio recebido." }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Áudio muito longo. Grave uma pergunta mais curta." }, { status: 400 });
      }

      const upstream = new FormData();
      // A Whisper decide o formato pela extensão do nome; o MediaRecorder
      // costuma entregar webm, então o nome precisa refletir isso.
      const nome = file.name && file.name.includes(".") ? file.name : "pergunta.webm";
      upstream.append("file", file, nome);
      upstream.append("model", "whisper-1");
      const lang = LANG_CODES[config.aiTranscriptionLang] || "pt";
      upstream.append("language", lang);

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.openaiApiKey}` },
        body: upstream,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        console.error("[POST /api/ai/transcribe] Whisper falhou:", err);
        return NextResponse.json(
          { error: err?.error?.message || `Erro ao transcrever o áudio: ${res.statusText}` },
          { status: 400 }
        );
      }

      const data = await res.json();
      const texto = String(data?.text || "").trim();
      if (!texto) {
        return NextResponse.json({ error: "Não consegui entender o áudio. Tente gravar de novo." }, { status: 400 });
      }

      return NextResponse.json({ texto });
    } catch (e) {
      console.error("[POST /api/ai/transcribe]", e);
      return NextResponse.json({ error: "Erro ao transcrever o áudio." }, { status: 500 });
    }
  });
}
