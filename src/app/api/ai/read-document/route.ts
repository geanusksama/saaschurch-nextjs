import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { getAiConfig } from "@/lib/aiConfig";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const config = await getAiConfig(user.campoId);

      if (!config.aiEnabled) {
        return NextResponse.json({ error: "O recurso de IA está desabilitado nas configurações." }, { status: 400 });
      }

      const { image } = await req.json().catch(() => ({}));
      if (!image) {
        return NextResponse.json({ error: "Imagem (base64) é obrigatória." }, { status: 400 });
      }

      // Limpar o prefixo data:image/xxx;base64 se existir para validação, mas no payload da OpenAI passamos completo
      const base64Data = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;

      if (config.aiProvider === "openai") {
        if (!config.openaiApiKey) {
          return NextResponse.json({ error: "Chave de API da OpenAI não cadastrada nas configurações." }, { status: 400 });
        }

        const promptText = `Você é um assistente financeiro que analisa notas fiscais, recibos, comprovantes de Pix e outros documentos de despesa e receita para uma igreja. Analise a imagem fornecida e extraia as informações financeiras em formato JSON contendo as seguintes chaves:
- favorecido: nome da pessoa física ou jurídica que recebeu ou pagou o valor. Tente identificar o favorecido final.
- data_lancamento: data da transação/lançamento no formato 'YYYY-MM-DD'. Se não encontrar, use a data atual ou a data de emissão do comprovante.
- valor: o valor total da transação em formato numérico (float/number), ex: 246.00 ou 150.00.
- referencia: o mês/ano de competência no formato 'MM/YYYY' (ex: '06/2026') deduzido da data da transação ou emissão.
- num_doc: número do documento, número do Pix ou do recibo se identificável, caso contrário string vazia.
- observacao: descrição sucinta da despesa/compra identificada no documento (ex: 'Alimentação - Costelaria Carro de Boi' ou 'Combustível - Ipiranga').

Retorne APENAS o objeto JSON.`;

        const openAiPayload = {
          model: config.aiModel.includes("gpt") ? config.aiModel : "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                {
                  type: "image_url",
                  image_url: {
                    url: base64Data
                  }
                }
              ]
            }
          ],
          max_tokens: 1000,
          response_format: { type: "json_object" }
        };

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.openaiApiKey}`
          },
          body: JSON.stringify(openAiPayload)
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error("OpenAI Vision error response:", errText);
          return NextResponse.json({ error: `Erro na API da OpenAI: ${response.statusText}` }, { status: 500 });
        }

        const data = await response.json();
        const jsonResult = JSON.parse(data.choices[0].message.content);
        return NextResponse.json(jsonResult);

      } else {
        // Suporte para Anthropic (Claude)
        if (!config.anthropicApiKey) {
          return NextResponse.json({ error: "Chave de API da Anthropic não cadastrada." }, { status: 400 });
        }

        // Claude aceita imagens em base64 estruturadas no payload
        // Extrair o media_type e base64 limpo
        const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
        const mediaType = match ? match[1] : "image/jpeg";
        const rawBase64 = match ? match[2] : image;

        const claudePrompt = `Analise este comprovante fiscal e retorne APENAS um objeto JSON válido (sem tags markdown, sem blocos de código) com as chaves:
{
  "favorecido": "nome do favorecido/recebedor/pagador",
  "data_lancamento": "YYYY-MM-DD",
  "valor": 123.45,
  "referencia": "MM/YYYY",
  "num_doc": "número do doc ou pix",
  "observacao": "resumo do comprovante"
}`;

        const claudePayload = {
          model: config.aiModel.includes("claude") ? config.aiModel : "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: rawBase64
                  }
                },
                {
                  type: "text",
                  text: claudePrompt
                }
              ]
            }
          ]
        };

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.anthropicApiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify(claudePayload)
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error("Claude Vision error response:", errText);
          return NextResponse.json({ error: `Erro na API da Anthropic: ${response.statusText}` }, { status: 500 });
        }

        const data = await response.json();
        const textContent = data.content[0].text;
        // Limpar possíveis blocos de código markdown do Claude
        const cleanJson = textContent.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonResult = JSON.parse(cleanJson);
        return NextResponse.json(jsonResult);
      }
    } catch (e: any) {
      console.error("[POST /api/ai/read-document]", e);
      return NextResponse.json({ error: e.message || "Erro ao ler o documento com IA." }, { status: 500 });
    }
  });
}
