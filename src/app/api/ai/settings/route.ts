import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

const DEFAULT_OPENAI_KEY = "";

const DEFAULT_SETTINGS = {
  aiEnabled: true,
  aiProvider: "openai",
  openaiApiKey: DEFAULT_OPENAI_KEY,
  anthropicApiKey: "",
  aiModel: "gpt-4o-mini",
  aiMaxTokens: 2000,
  aiTranscriptionEnabled: false,
  aiTranscriptionLang: "Português",
};

// Auxiliar para ofuscar chaves de API
function maskKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length <= 10) return "••••••••";
  return `${key.slice(0, 7)}••••••••${key.slice(-4)}`;
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const campoId = user.campoId || null;

      const row = await prisma.setting.findFirst({
        where: { settingKey: "ai_configuration", campoId },
      });

      if (!row || !row.settingValue) {
        // Retorna padrão
        const maskedDefault = {
          ...DEFAULT_SETTINGS,
          openaiApiKey: maskKey(DEFAULT_SETTINGS.openaiApiKey),
        };
        return NextResponse.json(maskedDefault);
      }

      const config = JSON.parse(row.settingValue);
      // Mascarar chaves
      const responseConfig = {
        ...config,
        openaiApiKey: maskKey(config.openaiApiKey),
        anthropicApiKey: maskKey(config.anthropicApiKey),
      };

      return NextResponse.json(responseConfig);
    } catch (e) {
      console.error("[GET /api/ai/settings]", e);
      return NextResponse.json({ error: "Erro ao obter configurações de IA." }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const campoId = user.campoId || null;
      const url = new URL(req.url);
      const isTest = url.searchParams.get("test") === "true";
      const body = await req.json().catch(() => ({}));

      if (isTest) {
        const provider = body.aiProvider || "openai";
        let key = provider === "openai" ? body.openaiApiKey : body.anthropicApiKey;
        
        // Se a chave for mascarada, carregar do banco
        if (key.includes("•••") || key.includes("***")) {
          const row = await prisma.setting.findFirst({
            where: { settingKey: "ai_configuration", campoId },
          });
          if (row && row.settingValue) {
            const config = JSON.parse(row.settingValue);
            key = provider === "openai" ? config.openaiApiKey : config.anthropicApiKey;
          }
        }
        
        // Chave padrão se for OpenAI e estiver vazia/mascarada e não houver no banco
        if (provider === "openai" && (!key || key.includes("•••") || key.includes("***"))) {
          key = DEFAULT_OPENAI_KEY;
        }

        if (!key) {
          return NextResponse.json({ error: "Chave de API não informada." }, { status: 400 });
        }

        if (provider === "openai") {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${key}`
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: "ping" }],
              max_tokens: 5
            })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return NextResponse.json({ error: err.error?.message || `Erro de conexão: ${res.statusText}` }, { status: 400 });
          }
          return NextResponse.json({ success: true, message: "Conexão com OpenAI estabelecida com sucesso!" });
        } else {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": key,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: "claude-3-haiku-20240307",
              max_tokens: 5,
              messages: [{ role: "user", content: "ping" }]
            })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return NextResponse.json({ error: err.error?.message || `Erro de conexão: ${res.statusText}` }, { status: 400 });
          }
          return NextResponse.json({ success: true, message: "Conexão com Anthropic estabelecida com sucesso!" });
        }
      }

      // Obter configuração existente para comparar chaves mascaradas
      const existingRow = await prisma.setting.findFirst({
        where: { settingKey: "ai_configuration", campoId },
      });
      let existingConfig = DEFAULT_SETTINGS;
      if (existingRow && existingRow.settingValue) {
        try {
          existingConfig = JSON.parse(existingRow.settingValue);
        } catch {}
      }

      // Se a chave no body for mascarada (contém bolinhas ou estrelas), mantém a anterior
      let finalOpenaiKey = body.openaiApiKey || "";
      if (finalOpenaiKey.includes("•••") || finalOpenaiKey.includes("***") || finalOpenaiKey === maskKey(existingConfig.openaiApiKey)) {
        finalOpenaiKey = existingConfig.openaiApiKey || DEFAULT_OPENAI_KEY;
      }

      let finalAnthropicKey = body.anthropicApiKey || "";
      if (finalAnthropicKey.includes("•••") || finalAnthropicKey.includes("***") || finalAnthropicKey === maskKey(existingConfig.anthropicApiKey)) {
        finalAnthropicKey = existingConfig.anthropicApiKey;
      }

      const newConfig = {
        aiEnabled: body.aiEnabled !== undefined ? body.aiEnabled : true,
        aiProvider: body.aiProvider || "openai",
        openaiApiKey: finalOpenaiKey,
        anthropicApiKey: finalAnthropicKey,
        aiModel: body.aiModel || "gpt-4o-mini",
        aiMaxTokens: body.aiMaxTokens || 2000,
        aiTranscriptionEnabled: body.aiTranscriptionEnabled || false,
        aiTranscriptionLang: body.aiTranscriptionLang || "Português",
      };

      const serialized = JSON.stringify(newConfig);

      // Usando findFirst + upsert
      const existingSetting = await prisma.setting.findFirst({
        where: { settingKey: "ai_configuration", campoId },
      });

      if (existingSetting) {
        await prisma.setting.update({
          where: { id: existingSetting.id },
          data: {
            settingValue: serialized,
            updatedBy: user.id || null,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.setting.create({
          data: {
            campoId,
            churchId: user.churchId || null,
            settingKey: "ai_configuration",
            settingValue: serialized,
            settingType: "json",
            description: "Configurações do provedor de IA e chaves de API",
            updatedBy: user.id || null,
          },
        });
      }

      return NextResponse.json({ success: true });
    } catch (e) {
      console.error("[POST /api/ai/settings]", e);
      return NextResponse.json({ error: "Erro ao salvar configurações de IA." }, { status: 500 });
    }
  });
}
