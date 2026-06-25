import { prisma } from "./prisma";

const DEFAULT_OPENAI_KEY = "";

export interface AiConfig {
  aiEnabled: boolean;
  aiProvider: "openai" | "anthropic";
  openaiApiKey: string;
  anthropicApiKey: string;
  aiModel: string;
  aiMaxTokens: number;
  aiTranscriptionEnabled: boolean;
  aiTranscriptionLang: string;
}

export async function getAiConfig(campoId: string | null): Promise<AiConfig> {
  try {
    const row = await prisma.setting.findFirst({
      where: { settingKey: "ai_configuration", campoId },
    });

    // Se não tiver para o campo, tenta buscar global (campoId: null)
    let finalRow = row;
    if (!finalRow && campoId) {
      finalRow = await prisma.setting.findFirst({
        where: { settingKey: "ai_configuration", campoId: null },
      });
    }

    if (!finalRow || !finalRow.settingValue) {
      return {
        aiEnabled: true,
        aiProvider: "openai",
        openaiApiKey: DEFAULT_OPENAI_KEY,
        anthropicApiKey: "",
        aiModel: "gpt-4o-mini",
        aiMaxTokens: 2000,
        aiTranscriptionEnabled: false,
        aiTranscriptionLang: "Português",
      };
    }

    const config = JSON.parse(finalRow.settingValue);
    return {
      aiEnabled: config.aiEnabled !== undefined ? config.aiEnabled : true,
      aiProvider: config.aiProvider || "openai",
      openaiApiKey: config.openaiApiKey || DEFAULT_OPENAI_KEY,
      anthropicApiKey: config.anthropicApiKey || "",
      aiModel: config.aiModel || "gpt-4o-mini",
      aiMaxTokens: config.aiMaxTokens || 2000,
      aiTranscriptionEnabled: config.aiTranscriptionEnabled || false,
      aiTranscriptionLang: config.aiTranscriptionLang || "Português",
    };
  } catch (e) {
    console.error("[getAiConfig] Erro ao carregar configurações de IA:", e);
    return {
      aiEnabled: true,
      aiProvider: "openai",
      openaiApiKey: DEFAULT_OPENAI_KEY,
      anthropicApiKey: "",
      aiModel: "gpt-4o-mini",
      aiMaxTokens: 2000,
      aiTranscriptionEnabled: false,
      aiTranscriptionLang: "Português",
    };
  }
}
