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

// Remove acentos e normaliza para minúsculas — usado para classificar plano de contas
function normalizeText(text: string | null | undefined): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Classifica uma receita pelo plano de conta, na MESMA regra do Livro Caixa (Cashbook.tsx):
// dízimo = plano contém "dizimo"; oferta = plano contém "oferta".
function classifyPlano(planoDeConta: string | null | undefined): "dizimo" | "oferta" | "outro" {
  const p = normalizeText(planoDeConta);
  if (p.includes("dizimo")) return "dizimo";
  if (p.includes("oferta")) return "oferta";
  return "outro";
}

type AggRow = { tipo: string | null; valor: any; planoDeConta?: string | null };

// Soma os totais financeiros de um conjunto de lançamentos (matemática feita no servidor, não pela IA)
function aggregateRows(rows: AggRow[]) {
  let receitas = 0, despesas = 0, dizimos = 0, ofertas = 0, outrasReceitas = 0;
  let qtdReceitas = 0, qtdDespesas = 0, qtdDizimos = 0, qtdOfertas = 0;
  for (const r of rows) {
    const valor = Number(r.valor);
    if (r.tipo === "DESPESA") {
      // valor pode estar negativo; usamos o módulo para somar despesa
      despesas += Math.abs(valor);
      qtdDespesas++;
    } else if (r.tipo === "RECEITA") {
      receitas += valor;
      qtdReceitas++;
      const cls = classifyPlano(r.planoDeConta);
      if (cls === "dizimo") { dizimos += valor; qtdDizimos++; }
      else if (cls === "oferta") { ofertas += valor; qtdOfertas++; }
      else { outrasReceitas += valor; }
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    totalReceitas: round(receitas),
    totalDespesas: round(despesas),
    totalDizimos: round(dizimos),
    totalOfertas: round(ofertas),
    totalOutrasReceitas: round(outrasReceitas),
    liquido: round(receitas - despesas),
    qtdLancamentos: rows.length,
    qtdReceitas, qtdDespesas, qtdDizimos, qtdOfertas,
  };
}

// Constrói o filtro `where` do Prisma para LivroCaixa a partir dos argumentos da ferramenta.
// Compartilhado por consultar_livro_caixa, consultar_totais e ranking_igrejas.
function buildLivroCaixaWhere(args: any, fieldChurchIds: string[] | null): any {
  const queryWhere: any = {};
  if (fieldChurchIds !== null) {
    queryWhere.churchId = { in: fieldChurchIds };
  }
  if (args.data_inicio || args.data_fim) {
    queryWhere.dataLancamento = {};
    if (args.data_inicio) queryWhere.dataLancamento.gte = new Date(args.data_inicio + "T00:00:00Z");
    if (args.data_fim) queryWhere.dataLancamento.lte = new Date(args.data_fim + "T23:59:59Z");
  }
  if (args.tipo) queryWhere.tipo = args.tipo;
  if (args.favorecido) {
    queryWhere.OR = [
      { favorecido: { contains: args.favorecido, mode: "insensitive" } },
      { member: { fullName: { contains: args.favorecido, mode: "insensitive" } } },
    ];
  }
  if (args.igreja) {
    queryWhere.church = { name: { contains: args.igreja, mode: "insensitive" } };
  }
  if (args.plano_de_conta) {
    queryWhere.planoDeConta = { contains: args.plano_de_conta, mode: "insensitive" };
  }
  if (args.categoria) {
    queryWhere.categoria = { contains: args.categoria, mode: "insensitive" };
  }
  if (args.centro_de_custo) {
    queryWhere.centroDeCusto = { contains: args.centro_de_custo, mode: "insensitive" };
  }
  if (args.cargo) {
    queryWhere.member = { ecclesiasticalTitle: { contains: args.cargo, mode: "insensitive" } };
  }
  return queryWhere;
}

// Limite de segurança para varreduras agregadas (1 mês de campo cabe folgado)
const AGG_SCAN_LIMIT = 50000;

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
      ATENÇÃO: Você tem acesso aos dados de todas as igrejas pertencentes ao seu campo/região. Por padrão, filtre ou informe os dados da igreja do usuário logado (${user.churchName || "Nenhuma"}, ID: ${user.churchId}) a menos que ele solicite explicitamente sobre outra filial ou sobre o campo todo.

REGRAS OBRIGATÓRIAS PARA CONSULTAS FINANCEIRAS (siga sempre — sua precisão depende disso):
1. NUNCA some, conte ou ranqueie lançamentos manualmente a partir de listas. Os valores precisos são SEMPRE calculados pelo servidor.
2. Para TOTAIS/SOMATÓRIOS ("quanto arrecadou", "total de dízimos", "total de despesas do mês"): use a ferramenta "consultar_totais" e responda com os valores do campo "resumo".
3. Para RANKINGS ("igrejas com maior/menor X", "top 5", "qual arrecadou mais"): use a ferramenta "ranking_igrejas" com a "metrica" adequada e responda exatamente com o "ranking" retornado (campo "valorMetrica" é o valor da métrica pedida).
4. Para LISTAR lançamentos individuais: use "consultar_livro_caixa". A lista "lancamentos" é apenas amostra (máx. 100); os totais corretos estão no "resumo" — use-os e nunca some a amostra.
5. Definições (idênticas ao Livro Caixa do sistema): DÍZIMO = receita cujo plano de conta contém "dízimo"; OFERTA = receita cujo plano de conta contém "oferta". LÍQUIDO = receitas − despesas.
6. Se o usuário pedir "todas as igrejas do campo", NÃO passe o filtro de igreja — deixe a ferramenta agregar o campo inteiro.
7. Sempre apresente valores monetários no formato R$ com duas casas (ex: R$ 64.512,23).`;

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
            name: "consultar_totais",
            description: "Retorna os TOTAIS financeiros já somados pelo servidor (total de receitas, despesas, dízimos, ofertas, líquido e quantidades) para um período/filtro. Use SEMPRE que o usuário pedir totais, somatórios, 'quanto arrecadou', total de dízimos/ofertas etc. NUNCA some lançamentos manualmente — use esta ferramenta para garantir o valor exato.",
            parameters: {
              type: "object",
              properties: {
                data_inicio: { type: "string", description: "Data de início YYYY-MM-DD (ex: '2026-06-01')" },
                data_fim: { type: "string", description: "Data de fim YYYY-MM-DD (ex: '2026-06-30')" },
                tipo: { type: "string", enum: ["RECEITA", "DESPESA", "TRANSFERENCIA"], description: "Filtra por tipo de lançamento" },
                favorecido: { type: "string", description: "Nome ou parte do nome do favorecido/membro" },
                igreja: { type: "string", description: "Nome ou parte do nome da igreja/filial (ex: 'SEDE'). Omita para somar TODAS as igrejas do campo." },
                plano_de_conta: { type: "string", description: "Nome ou código do plano de conta (ex: 'DIZIMOS', 'OFERTAS')" },
                categoria: { type: "string", description: "Categoria do lançamento" },
                centro_de_custo: { type: "string", description: "Centro de custo" },
                cargo: { type: "string", description: "Cargo/título eclesiástico do membro (ex: 'PASTOR')" }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "ranking_igrejas",
            description: "Retorna o RANKING das igrejas/congregações do campo já agregado e ordenado pelo servidor, segundo a métrica escolhida (dízimos, ofertas, receitas, despesas ou líquido) em um período. Use SEMPRE que o usuário pedir 'as igrejas com maior/menor X', 'ranking', 'top', 'qual igreja arrecadou mais' etc. NUNCA monte ranking somando manualmente.",
            parameters: {
              type: "object",
              properties: {
                data_inicio: { type: "string", description: "Data de início YYYY-MM-DD (ex: '2026-06-01')" },
                data_fim: { type: "string", description: "Data de fim YYYY-MM-DD (ex: '2026-06-30')" },
                metrica: {
                  type: "string",
                  enum: ["dizimos", "ofertas", "receitas", "despesas", "liquido"],
                  description: "Métrica usada para ordenar o ranking. 'dizimos' = soma das receitas cujo plano de conta contém 'dízimo'."
                },
                ordem: { type: "string", enum: ["desc", "asc"], description: "desc = maiores primeiro (padrão); asc = menores primeiro" },
                limite: { type: "number", description: "Quantidade de igrejas a retornar (padrão 10)" }
              },
              required: ["metrica"]
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

      // Executor único de ferramentas, compartilhado entre OpenAI e Claude (Anthropic).
      // Retorna um objeto JS (o chamador serializa). Toda a matemática é feita aqui, no servidor.
      async function executeAgentTool(name: string, args: any): Promise<any> {
        if (name === "consultar_livro_caixa") {
          console.log("[POST /api/ai/chat] Tool 'consultar_livro_caixa' args:", args);
          const queryWhere = buildLivroCaixaWhere(args, fieldChurchIds);
          const allRows = await prisma.livroCaixa.findMany({
            where: queryWhere,
            select: { tipo: true, valor: true, planoDeConta: true },
            take: AGG_SCAN_LIMIT
          });
          const resumo = aggregateRows(allRows);
          const dbResults = await prisma.livroCaixa.findMany({
            where: queryWhere,
            include: {
              church: { select: { name: true } },
              member: { select: { fullName: true, ecclesiasticalTitle: true, memberType: true } }
            },
            orderBy: { dataLancamento: "desc" },
            take: 100
          });
          return {
            resumo,
            observacao: dbResults.length < resumo.qtdLancamentos
              ? `O 'resumo' já contém os totais corretos de TODOS os ${resumo.qtdLancamentos} lançamentos. A lista 'lancamentos' é apenas uma amostra dos ${dbResults.length} mais recentes — NÃO some a lista manualmente; use os valores do 'resumo'.`
              : `O 'resumo' contém os totais de todos os ${resumo.qtdLancamentos} lançamentos.`,
            lancamentos: serializeDbData(dbResults)
          };
        }

        if (name === "consultar_totais") {
          console.log("[POST /api/ai/chat] Tool 'consultar_totais' args:", args);
          const queryWhere = buildLivroCaixaWhere(args, fieldChurchIds);
          const allRows = await prisma.livroCaixa.findMany({
            where: queryWhere,
            select: { tipo: true, valor: true, planoDeConta: true },
            take: AGG_SCAN_LIMIT
          });
          const resumo = aggregateRows(allRows);
          return { resumo, observacao: "Totais já somados pelo servidor. Use exatamente estes valores; não recalcule." };
        }

        if (name === "ranking_igrejas") {
          console.log("[POST /api/ai/chat] Tool 'ranking_igrejas' args:", args);
          const { igreja, ...rankArgs } = args;
          const queryWhere = buildLivroCaixaWhere(rankArgs, fieldChurchIds);
          const allRows = await prisma.livroCaixa.findMany({
            where: queryWhere,
            select: { churchId: true, tipo: true, valor: true, planoDeConta: true, church: { select: { name: true } } },
            take: AGG_SCAN_LIMIT
          });
          const grupos = new Map<string, { nome: string; rows: AggRow[] }>();
          for (const r of allRows) {
            const key = r.churchId;
            if (!grupos.has(key)) grupos.set(key, { nome: r.church?.name || "(sem nome)", rows: [] });
            grupos.get(key)!.rows.push(r);
          }
          const metrica = (args.metrica || "receitas") as string;
          const metricKey: Record<string, keyof ReturnType<typeof aggregateRows>> = {
            dizimos: "totalDizimos", ofertas: "totalOfertas", receitas: "totalReceitas",
            despesas: "totalDespesas", liquido: "liquido",
          };
          const chave = metricKey[metrica] || "totalReceitas";
          let ranking = Array.from(grupos.values()).map(g => {
            const agg = aggregateRows(g.rows);
            return {
              igreja: g.nome, valorMetrica: agg[chave] as number,
              totalDizimos: agg.totalDizimos, totalOfertas: agg.totalOfertas,
              totalReceitas: agg.totalReceitas, totalDespesas: agg.totalDespesas, liquido: agg.liquido,
            };
          });
          const ordem = args.ordem === "asc" ? 1 : -1;
          ranking.sort((a, b) => (a.valorMetrica - b.valorMetrica) * ordem);
          const limite = Math.max(1, Math.min(Number(args.limite) || 10, 100));
          ranking = ranking.slice(0, limite);
          return {
            metrica, ordem: args.ordem === "asc" ? "asc" : "desc", totalIgrejas: grupos.size, ranking,
            observacao: "Ranking já agregado e ordenado pelo servidor pela métrica escolhida (campo 'valorMetrica'). Use exatamente estes valores; não recalcule nem reordene."
          };
        }

        if (name === "consultar_membros") {
          console.log("[POST /api/ai/chat] Tool 'consultar_membros' args:", args);
          const queryWhereMembers: any = {};
          if (fieldChurchIds !== null) queryWhereMembers.churchId = { in: fieldChurchIds };
          if (args.nome) queryWhereMembers.fullName = { contains: args.nome, mode: "insensitive" };
          if (args.cargo) queryWhereMembers.ecclesiasticalTitle = { contains: args.cargo, mode: "insensitive" };
          if (args.igreja) queryWhereMembers.church = { name: { contains: args.igreja, mode: "insensitive" } };
          if (args.status) queryWhereMembers.membershipStatus = args.status;
          const dbResultsMembers = await prisma.member.findMany({
            where: queryWhereMembers,
            include: { church: { select: { name: true } } },
            take: 100
          });
          return serializeDbData(dbResultsMembers);
        }

        if (name === "gerar_pdf") {
          try {
            const downloadUrl = generateReportPdf({
              titulo: args.titulo, subtitulo: args.subtitulo,
              colunas: args.colunas || [], linhas: args.linhas || [], totais: args.totais || []
            });
            return { success: true, downloadUrl };
          } catch (pdfErr: any) {
            console.error("[POST /api/ai/chat] Error generating PDF:", pdfErr);
            return { success: false, error: pdfErr.message || "Erro desconhecido ao gerar PDF." };
          }
        }

        if (name === "gerar_excel") {
          try {
            const downloadUrl = generateReportExcel({
              titulo: args.titulo, colunas: args.colunas || [], linhas: args.linhas || [], totais: args.totais || []
            });
            return { success: true, downloadUrl };
          } catch (xlsErr: any) {
            console.error("[POST /api/ai/chat] Error generating Excel:", xlsErr);
            return { success: false, error: xlsErr.message || "Erro desconhecido ao gerar Excel." };
          }
        }

        return { error: `Ferramenta desconhecida: ${name}` };
      }

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
          const toolMessages: any[] = [];

          for (const toolCall of messageObj.tool_calls) {
            let parsedArgs: any = {};
            try {
              parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
            } catch {
              parsedArgs = {};
            }
            const result = await executeAgentTool(toolCall.function.name, parsedArgs);
            toolMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(result)
            });
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
        // Anthropic (Claude) — tool use nativo, com as MESMAS ferramentas do executor compartilhado.
        if (!config.anthropicApiKey) {
          return NextResponse.json({ error: "Chave Anthropic não cadastrada." }, { status: 400 });
        }

        // Converte as tools do formato OpenAI para o formato Anthropic
        const claudeTools = tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters
        }));

        // Histórico no formato Anthropic (content como array de blocos)
        const claudeMessages: any[] = messageHistory.map(msg => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: [{ type: "text", text: msg.content }]
        }));

        const claudeModel = config.aiModel.includes("claude") ? config.aiModel : "claude-3-5-sonnet-20241022";
        const callClaude = async () => {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": config.anthropicApiKey,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: claudeModel,
              max_tokens: config.aiMaxTokens,
              system: systemPrompt,
              tools: claudeTools,
              messages: claudeMessages
            })
          });
          if (!res.ok) {
            const errText = await res.text();
            console.error("Claude Chat error:", errText);
            throw new Error(`Erro na API da Anthropic: ${res.statusText}`);
          }
          return res.json();
        };

        // Loop de tool use (limite de iterações por segurança)
        let claudeData = await callClaude();
        let iterations = 0;
        while (claudeData.stop_reason === "tool_use" && iterations < 5) {
          iterations++;
          const toolUseBlocks = (claudeData.content || []).filter((b: any) => b.type === "tool_use");

          // Anexa a resposta do assistente (com os blocos de tool_use) ao histórico
          claudeMessages.push({ role: "assistant", content: claudeData.content });

          // Executa cada ferramenta e monta os tool_result
          const toolResults: any[] = [];
          for (const block of toolUseBlocks) {
            const result = await executeAgentTool(block.name, block.input || {});
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result)
            });
          }
          claudeMessages.push({ role: "user", content: toolResults });

          claudeData = await callClaude();
        }

        // Concatena os blocos de texto da resposta final
        assistantResponse = (claudeData.content || [])
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("\n")
          .trim();
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
