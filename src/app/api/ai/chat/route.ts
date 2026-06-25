import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { getAiConfig } from "@/lib/aiConfig";
import { generateReportPdf } from "@/lib/pdfGenerator";
import { generateReportExcel } from "@/lib/excelGenerator";

// Auxiliar para converter decimais e BigInts para JSON serializável
function serializeDbData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(serializeDbData);
  if (typeof obj === 'object') {
    if (obj.constructor && obj.constructor.name === 'Decimal') {
      return Number(obj.toString());
    }
    const newObj: any = {};
    for (const key in obj) {
      const val = obj[key];
      if (typeof val === 'bigint') {
        newObj[key] = val.toString();
      } else if (val instanceof Date) {
        newObj[key] = val.toISOString().split('T')[0]; // Apenas a data YYYY-MM-DD
      } else {
        newObj[key] = serializeDbData(val);
      }
    }
    return newObj;
  }
  return obj;
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      if (!["master", "campo", "admin"].includes(user.profileType)) {
        return NextResponse.json({ error: "Acesso negado. Apenas perfis Master, Admin ou Campo têm acesso ao assistente." }, { status: 403 });
      }
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("sessionId");

      if (sessionId) {
        // Obter mensagens de uma sessão específica
        const session = await prisma.aiChatSession.findUnique({
          where: { id: sessionId },
          include: { agent: true }
        });

        if (!session || (session.userId !== user.id && user.profileType !== "master")) {
          return NextResponse.json({ error: "Sessão não encontrada ou acesso negado." }, { status: 404 });
        }

        const messages = await prisma.aiChatMessage.findMany({
          where: { sessionId },
          orderBy: { createdAt: "asc" }
        });

        return NextResponse.json({ session, messages });
      }

      // Listar todas as sessões de chat do usuário
      const sessions = await prisma.aiChatSession.findMany({
        where: { userId: user.id || undefined },
        include: { agent: true },
        orderBy: { updatedAt: "desc" }
      });

      return NextResponse.json(sessions);
    } catch (e) {
      console.error("[GET /api/ai/chat]", e);
      return NextResponse.json({ error: "Erro ao carregar chat." }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      if (!["master", "campo", "admin"].includes(user.profileType)) {
        return NextResponse.json({ error: "Acesso negado. Apenas perfis Master, Admin ou Campo têm acesso ao assistente." }, { status: 403 });
      }
      const { agentId, message, sessionId: inputSessionId } = await req.json().catch(() => ({}));

      if (!agentId || !message) {
        return NextResponse.json({ error: "agentId e message são obrigatórios." }, { status: 400 });
      }

      // 1. Carregar agente
      const agent = await prisma.aiAgent.findUnique({
        where: { id: agentId }
      });

      if (!agent || !agent.isActive) {
        return NextResponse.json({ error: "Agente inativo ou não encontrado." }, { status: 404 });
      }

      // 2. Obter ou criar sessão
      let sessionId = inputSessionId;
      let session;
      if (sessionId) {
        session = await prisma.aiChatSession.findUnique({
          where: { id: sessionId }
        });
      }

      if (!session) {
        session = await prisma.aiChatSession.create({
          data: {
            agentId,
            userId: user.id || "",
            churchId: user.churchId || null,
            title: message.slice(0, 50) || "Nova conversa"
          }
        });
        sessionId = session.id;
      } else {
        // Atualizar título e updatedAt da sessão
        await prisma.aiChatSession.update({
          where: { id: sessionId },
          data: { updatedAt: new Date() }
        });
      }

      // 3. Salvar mensagem do usuário
      await prisma.aiChatMessage.create({
        data: {
          sessionId,
          role: "user",
          content: message
        }
      });

      // 4. Carregar histórico (últimas 15 mensagens da sessão)
      const messageHistory = await prisma.aiChatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
        take: 15
      });

      // 5. Carregar Configurações de IA
      const config = await getAiConfig(user.campoId);
      if (!config.aiEnabled) {
        return NextResponse.json({ error: "IA está desabilitada." }, { status: 400 });
      }

      // 6. Preparar histórico para OpenAI/Claude
      const now = new Date();
      let day = String(now.getDate()).padStart(2, '0');
      let month = String(now.getMonth() + 1).padStart(2, '0');
      let year = String(now.getFullYear());
      let hour = String(now.getHours()).padStart(2, '0');
      let minute = String(now.getMinutes()).padStart(2, '0');
      let weekday = "";

      try {
        const formatter = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          weekday: 'long'
        });
        const formatParts = formatter.formatToParts(now);
        day = formatParts.find(p => p.type === 'day')?.value || day;
        month = formatParts.find(p => p.type === 'month')?.value || month;
        year = formatParts.find(p => p.type === 'year')?.value || year;
        hour = formatParts.find(p => p.type === 'hour')?.value || hour;
        minute = formatParts.find(p => p.type === 'minute')?.value || minute;
        weekday = formatParts.find(p => p.type === 'weekday')?.value || '';
      } catch (timezoneError) {
        console.warn("[POST /api/ai/chat] America/Sao_Paulo timezone formatting failed, using local server time:", timezoneError);
        const weekdaysPt = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
        weekday = weekdaysPt[now.getDay()] || "";
      }
      
      const currentDateStr = `${year}-${month}-${day}`;
      const currentDateTimeStr = `${day}/${month}/${year} ${hour}:${minute}`;

      // Obter ids de igreja do campo para isolamento de tenant
      let fieldChurchIds: string[] | null = null;
      if (user.profileType !== "master" || user.campoId) {
        const fieldChurches = await prisma.church.findMany({
          where: {
            regional: {
              campoId: user.campoId || ""
            }
          },
          select: { id: true }
        });
        fieldChurchIds = fieldChurches.map(c => c.id);
      }


      const systemPrompt = `Você é um agente de IA assistente especialista chamado "${agent.name}" integrado ao SAAS Church.
Sua especialidade/cargo é: "${agent.role}".
Sua descrição/função: "${agent.description || 'Nenhuma'}".

Instruções de comportamento/prompt de sistema:
${agent.systemPrompt}

Contexto do usuário logado:
- Nome do Usuário: ${user.fullName || "Usuário"}
- Email do Usuário: ${user.email || "Não informado"}
- Perfil: ${user.profileType}
- Igreja Vinculada: ${user.churchName || "Nenhuma"}
- ID da Igreja: ${user.churchId || "Nenhum"}
- Data/Hora de Referência (Hoje): ${currentDateTimeStr} (Brasília, ${weekday})
- Data de Hoje (AAAA-MM-DD): ${currentDateStr}

Ao falar com o usuário, trate-o pelo nome e use uma linguagem profissional, prestativa e amigável.
      Se o usuário fizer perguntas financeiras sobre lançamentos, valores, totalizadores ou livro caixa, você PODE usar as ferramentas fornecidas para buscar os dados reais no banco de dados.
      ATENÇÃO: Você tem acesso aos dados de todas as igrejas pertencentes ao seu campo/região. Por padrão, filtre ou informe os dados da igreja do usuário logado (${user.churchName || "Nenhuma"}, ID: ${user.churchId}) a menos que ele solicite explicitamente sobre outra filial ou sobre o campo todo.`;

      // Formatar mensagens para OpenAI
      const openAiMessages = [
        { role: "system", content: systemPrompt },
        ...messageHistory.map(msg => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content
        }))
      ];

      // Definir ferramentas (Functions)
      const tools = [
        {
          type: "function",
          function: {
            name: "consultar_livro_caixa",
            description: "Consulta os lançamentos financeiros da tabela Livro Caixa baseando-se em filtros de data, tipo, favorecido/membro, igreja/filial, plano de conta, categoria, centro de custo e cargo do membro.",
            parameters: {
              type: "object",
              properties: {
                data_inicio: {
                  type: "string",
                  description: "Data de início da busca no formato YYYY-MM-DD (ex: '2026-06-01')"
                },
                data_fim: {
                  type: "string",
                  description: "Data de fim da busca no formato YYYY-MM-DD (ex: '2026-06-30')"
                },
                tipo: {
                  type: "string",
                  enum: ["RECEITA", "DESPESA", "TRANSFERENCIA"],
                  description: "Filtra por tipo de lançamento (RECEITA, DESPESA ou TRANSFERENCIA)"
                },
                favorecido: {
                  type: "string",
                  description: "Nome ou parte do nome do favorecido/pagador/membro para busca textual"
                },
                igreja: {
                  type: "string",
                  description: "Nome ou parte do nome da igreja/filial (ex: 'SEDE', 'JD SAO FERNANDO') para filtrar"
                },
                plano_de_conta: {
                  type: "string",
                  description: "Nome ou código do plano de conta (ex: 'DIZIMOS', 'OFERTAS', '01.200')"
                },
                categoria: {
                  type: "string",
                  description: "Categoria do lançamento para busca textual"
                },
                centro_de_custo: {
                  type: "string",
                  description: "Centro de custo do lançamento para busca textual"
                },
                cargo: {
                  type: "string",
                  description: "Filtra por cargo/título eclesiástico do membro associado (ex: 'EVANGELISTA', 'PASTOR')"
                }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "consultar_membros",
            description: "Consulta a lista de membros cadastrados nas igrejas autorizadas do campo, permitindo filtrar por nome, cargo e igreja.",
            parameters: {
              type: "object",
              properties: {
                nome: {
                  type: "string",
                  description: "Nome ou parte do nome do membro"
                },
                cargo: {
                  type: "string",
                  description: "Cargo ou título eclesiástico (ex: 'EVANGELISTA', 'PASTOR')"
                },
                igreja: {
                  type: "string",
                  description: "Nome ou parte do nome da igreja do membro (ex: 'SEDE')"
                },
                status: {
                  type: "string",
                  description: "Status de membro (ex: 'ATIVO')"
                }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "gerar_pdf",
            description: "Gera um arquivo PDF com um título, subtítulo, tabela de dados e uma lista de totais ou notas, e retorna o link para o usuário baixar.",
            parameters: {
              type: "object",
              properties: {
                titulo: {
                  type: "string",
                  description: "Título principal do relatório PDF (ex: 'Relatório Financeiro do Livro Caixa')"
                },
                subtitulo: {
                  type: "string",
                  description: "Subtítulo com filtros ou período (ex: 'Período: 01/06/2026 a 30/06/2026 | Igreja: SEDE')"
                },
                colunas: {
                  type: "array",
                  items: { type: "string" },
                  description: "Nomes das colunas da tabela (ex: ['Data', 'Favorecido', 'Plano', 'Valor (R$)'])"
                },
                linhas: {
                  type: "array",
                  items: {
                    type: "array",
                    items: { type: "string" }
                  },
                  description: "Linhas de dados da tabela (cada linha deve conter valores textuais correspondentes às colunas em ordem)"
                },
                totais: {
                  type: "array",
                  items: { type: "string" },
                  description: "Lista de linhas de totais, resumos ou notas a serem exibidas no final (ex: ['Total de Receitas: R$ 797,00', 'Saldo: R$ 797,00 (Positivo)'])"
                }
              },
              required: ["titulo", "colunas", "linhas"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "gerar_excel",
            description: "Gera um arquivo de planilha Excel (.xlsx) com um título, colunas, linhas de dados e uma lista de totais ou notas, e retorna o link para o usuário baixar.",
            parameters: {
              type: "object",
              properties: {
                titulo: {
                  type: "string",
                  description: "Título principal do relatório (ex: 'Relatório Financeiro do Livro Caixa')"
                },
                colunas: {
                  type: "array",
                  items: { type: "string" },
                  description: "Nomes das colunas da tabela (ex: ['Data', 'Favorecido', 'Plano', 'Valor'])"
                },
                linhas: {
                  type: "array",
                  items: {
                    type: "array",
                    items: { type: "string" }
                  },
                  description: "Linhas de dados da tabela (cada linha deve conter valores correspondentes às colunas em ordem)"
                },
                totais: {
                  type: "array",
                  items: { type: "string" },
                  description: "Lista de linhas de totais, resumos ou notas a serem exibidas no final (ex: ['Total de Receitas: R$ 797,00', 'Saldo: R$ 797,00'])"
                }
              },
              required: ["titulo", "colunas", "linhas"]
            }
          }
        }
      ];

      let assistantResponse = "";

      if (config.aiProvider === "openai") {
        if (!config.openaiApiKey) {
          return NextResponse.json({ error: "Chave OpenAI não cadastrada." }, { status: 400 });
        }

        // Fazer chamada para OpenAI
        const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.openaiApiKey}`
          },
          body: JSON.stringify({
            model: config.aiModel.includes("gpt") ? config.aiModel : "gpt-4o-mini",
            messages: openAiMessages,
            max_tokens: config.aiMaxTokens,
            tools: tools,
            tool_choice: "auto"
          })
        });

        if (!openAiRes.ok) {
          const errText = await openAiRes.text();
          console.error("OpenAI Chat error:", errText);
          throw new Error(`Erro na API da OpenAI: ${openAiRes.statusText}`);
        }

        const data = await openAiRes.json();
        const choice = data.choices[0];
        let messageObj = choice.message;

        if (messageObj.tool_calls && messageObj.tool_calls.length > 0) {
          // Processar chamadas de ferramenta em paralelo
          const toolMessages: any[] = [];

          for (const toolCall of messageObj.tool_calls) {
            if (toolCall.function.name === "consultar_livro_caixa") {
              const args = JSON.parse(toolCall.function.arguments);
              console.log("[POST /api/ai/chat] Tool 'consultar_livro_caixa' called with args:", args);
              
              // Executar a busca no LivroCaixa do Prisma filtrando pelas igrejas pertencentes ao Campo do usuário logado (Isolamento por Campo)
              const queryWhere: any = {};
              if (fieldChurchIds !== null) {
                queryWhere.churchId = { in: fieldChurchIds };
              }

              if (args.data_inicio || args.data_fim) {
                queryWhere.dataLancamento = {};
                if (args.data_inicio) {
                  queryWhere.dataLancamento.gte = new Date(args.data_inicio + "T00:00:00Z");
                }
                if (args.data_fim) {
                  queryWhere.dataLancamento.lte = new Date(args.data_fim + "T23:59:59Z");
                }
              }

              if (args.tipo) {
                queryWhere.tipo = args.tipo;
              }

              if (args.favorecido) {
                queryWhere.OR = [
                  {
                    favorecido: {
                      contains: args.favorecido,
                      mode: "insensitive"
                    }
                  },
                  {
                    member: {
                      fullName: {
                        contains: args.favorecido,
                        mode: "insensitive"
                      }
                    }
                  }
                ];
              }

              if (args.igreja) {
                queryWhere.church = {
                  name: {
                    contains: args.igreja,
                    mode: "insensitive"
                  }
                };
              }

              if (args.plano_de_conta) {
                queryWhere.planoDeConta = {
                  contains: args.plano_de_conta,
                  mode: "insensitive"
                };
              }

              if (args.categoria) {
                queryWhere.categoria = {
                  contains: args.categoria,
                  mode: "insensitive"
                };
              }

              if (args.centro_de_custo) {
                queryWhere.centroDeCusto = {
                  contains: args.centro_de_custo,
                  mode: "insensitive"
                };
              }

              if (args.cargo) {
                queryWhere.member = {
                  ecclesiasticalTitle: {
                    contains: args.cargo,
                    mode: "insensitive"
                  }
                };
              }

              const dbResults = await prisma.livroCaixa.findMany({
                where: queryWhere,
                include: {
                  church: {
                    select: { name: true }
                  },
                  member: {
                    select: {
                      fullName: true,
                      ecclesiasticalTitle: true,
                      memberType: true
                    }
                  }
                },
                orderBy: { dataLancamento: "desc" },
                take: 100
              });

              console.log(`[POST /api/ai/chat] Tool 'consultar_livro_caixa' retrieved ${dbResults.length} records.`);
              const serializedResults = serializeDbData(dbResults);
              toolMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: JSON.stringify(serializedResults)
              });
            } else if (toolCall.function.name === "consultar_membros") {
              const args = JSON.parse(toolCall.function.arguments);
              console.log("[POST /api/ai/chat] Tool 'consultar_membros' called with args:", args);

              const queryWhereMembers: any = {};
              if (fieldChurchIds !== null) {
                queryWhereMembers.churchId = { in: fieldChurchIds };
              }

              if (args.nome) {
                queryWhereMembers.fullName = {
                  contains: args.nome,
                  mode: "insensitive"
                };
              }

              if (args.cargo) {
                queryWhereMembers.ecclesiasticalTitle = {
                  contains: args.cargo,
                  mode: "insensitive"
                };
              }

              if (args.igreja) {
                queryWhereMembers.church = {
                  name: {
                    contains: args.igreja,
                    mode: "insensitive"
                  }
                };
              }

              if (args.status) {
                queryWhereMembers.membershipStatus = args.status;
              }

              const dbResultsMembers = await prisma.member.findMany({
                where: queryWhereMembers,
                include: {
                  church: {
                    select: { name: true }
                  }
                },
                take: 100
              });

              console.log(`[POST /api/ai/chat] Tool 'consultar_membros' retrieved ${dbResultsMembers.length} records.`);
              const serializedResultsMembers = serializeDbData(dbResultsMembers);
              toolMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: JSON.stringify(serializedResultsMembers)
              });
            } else if (toolCall.function.name === "gerar_pdf") {
              const args = JSON.parse(toolCall.function.arguments);
              console.log("[POST /api/ai/chat] Tool 'gerar_pdf' called with args:", {
                titulo: args.titulo,
                subtitulo: args.subtitulo,
                colunasCount: args.colunas?.length,
                linhasCount: args.linhas?.length
              });

              try {
                const downloadUrl = generateReportPdf({
                  titulo: args.titulo,
                  subtitulo: args.subtitulo,
                  colunas: args.colunas || [],
                  linhas: args.linhas || [],
                  totais: args.totais || []
                });

                toolMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  content: JSON.stringify({ success: true, downloadUrl })
                });
              } catch (pdfErr: any) {
                console.error("[POST /api/ai/chat] Error generating PDF:", pdfErr);
                toolMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  content: JSON.stringify({ success: false, error: pdfErr.message || "Erro desconhecido ao gerar PDF." })
                });
              }
            } else if (toolCall.function.name === "gerar_excel") {
              const args = JSON.parse(toolCall.function.arguments);
              console.log("[POST /api/ai/chat] Tool 'gerar_excel' called with args:", {
                titulo: args.titulo,
                colunasCount: args.colunas?.length,
                linhasCount: args.linhas?.length
              });

              try {
                const downloadUrl = generateReportExcel({
                  titulo: args.titulo,
                  colunas: args.colunas || [],
                  linhas: args.linhas || [],
                  totais: args.totais || []
                });

                toolMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  content: JSON.stringify({ success: true, downloadUrl })
                });
              } catch (xlsErr: any) {
                console.error("[POST /api/ai/chat] Error generating Excel:", xlsErr);
                toolMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  content: JSON.stringify({ success: false, error: xlsErr.message || "Erro desconhecido ao gerar Excel." })
                });
              }
            }
          }

          // Enviar os dados da ferramenta de volta para a OpenAI para que ela dê a resposta final
          const secondResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${config.openaiApiKey}`
            },
            body: JSON.stringify({
              model: config.aiModel.includes("gpt") ? config.aiModel : "gpt-4o-mini",
              messages: [
                ...openAiMessages,
                messageObj,
                ...toolMessages
              ],
              max_tokens: config.aiMaxTokens
            })
          });

          if (!secondResponse.ok) {
            const errText = await secondResponse.text();
            console.error("OpenAI second response error details:", errText);
            throw new Error(`Erro na API OpenAI pós-tool: ${secondResponse.statusText}`);
          }

          const secondData = await secondResponse.json();
          assistantResponse = secondData.choices[0].message.content;
        } else {
          assistantResponse = messageObj.content || "";
        }

      } else {
        // Anthropic (Claude)
        if (!config.anthropicApiKey) {
          return NextResponse.json({ error: "Chave Anthropic não cadastrada." }, { status: 400 });
        }

        // Claude format
        const claudeMessages = messageHistory.map(msg => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content
        }));

        // NOTA: Para simplificar, no Claude faremos uma execução sem tool use direta, ou incluiremos os dados diretamente no prompt
        // caso o usuário peça relatórios ou dados do livro caixa. Como o Claude tem limite e sintaxe diferente de tools, 
        // e o foco principal do usuário é a chave fornecida de OpenAI (onde as tools rodam perfeitamente), faremos uma busca básica
        // de livro caixa direto no prompt para o Claude se ele detectar palavras-chaves de finanças ou consulta.
        // Ou, alternativamente, buscamos os lançamentos recentes do livro caixa do mês atual e enviamos direto como contexto no system prompt do Claude!
        // Isso é super robusto e garante que o Claude também responda perfeitamente sem precisar lidar com callbacks de tools complexos.
        let claudeSystemPrompt = systemPrompt;
        
        const isFinQuery = message.toLowerCase().includes("livro caixa") || 
                           message.toLowerCase().includes("registros") || 
                           message.toLowerCase().includes("financeiro") || 
                           message.toLowerCase().includes("quantos") ||
                           message.toLowerCase().includes("despesa") ||
                           message.toLowerCase().includes("receita") ||
                           message.toLowerCase().includes("inseridos");

        if (isFinQuery) {
          const claudeWhere: any = {};
          if (fieldChurchIds !== null) {
            claudeWhere.churchId = { in: fieldChurchIds };
          }
          // Pré-carrega dados recentes do livro caixa para abastecer o Claude
          const recentData = await prisma.livroCaixa.findMany({
            where: claudeWhere,
            orderBy: { dataLancamento: "desc" },
            take: 30
          });
          const serialized = serializeDbData(recentData);
          claudeSystemPrompt += `\n\n[DADOS FINANCEIROS RECENTES DA IGREJA (Contexto Real)]:\n${JSON.stringify(serialized)}\nUse esses dados caso o usuário faça perguntas financeiras ou estatísticas sobre hoje ou dias recentes.`;
        }

        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.anthropicApiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: config.aiModel.includes("claude") ? config.aiModel : "claude-3-5-sonnet-20241022",
            max_tokens: config.aiMaxTokens,
            system: claudeSystemPrompt,
            messages: claudeMessages
          })
        });

        if (!claudeRes.ok) {
          const errText = await claudeRes.text();
          console.error("Claude Chat error:", errText);
          throw new Error(`Erro na API da Anthropic: ${claudeRes.statusText}`);
        }

        const data = await claudeRes.json();
        assistantResponse = data.content[0].text || "";
      }

      // 7. Salvar resposta da IA no banco
      const aiMsg = await prisma.aiChatMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content: assistantResponse
        }
      });

      return NextResponse.json({
        sessionId,
        message: aiMsg
      });
    } catch (e: any) {
      console.error("[POST /api/ai/chat]", e);
      return NextResponse.json({ error: e.message || "Erro ao responder chat." }, { status: 500 });
    }
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      if (!["master", "campo", "admin"].includes(user.profileType)) {
        return NextResponse.json({ error: "Acesso negado. Apenas perfis Master, Admin ou Campo têm acesso ao assistente." }, { status: 403 });
      }
      
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("sessionId");

      if (!sessionId) {
        return NextResponse.json({ error: "sessionId é obrigatório." }, { status: 400 });
      }

      // Buscar sessão para verificar permissão
      const session = await prisma.aiChatSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
      }

      // Apenas o dono da sessão ou usuários Master podem excluir
      if (session.userId !== user.id && user.profileType !== "master") {
        return NextResponse.json({ error: "Acesso negado para excluir esta sessão." }, { status: 403 });
      }

      // Excluir mensagens vinculadas primeiro
      await prisma.aiChatMessage.deleteMany({
        where: { sessionId }
      });

      // Excluir a sessão
      await prisma.aiChatSession.delete({
        where: { id: sessionId }
      });

      return NextResponse.json({ success: true, message: "Sessão excluída com sucesso." });
    } catch (e: any) {
      console.error("[DELETE /api/ai/chat]", e);
      return NextResponse.json({ error: e.message || "Erro ao excluir sessão." }, { status: 500 });
    }
  });
}
