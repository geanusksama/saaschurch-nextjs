/**
 * Configuração da home pública — lado administrativo.
 *
 *   GET  /api/home-config  → devolve a configuração do campo do usuário,
 *                            SEMEANDO a linha com o conteúdo real da home na
 *                            primeira visita (a tela nunca abre em branco).
 *   PUT  /api/home-config  → grava configuração + cartões numa transação.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthUser } from "@/lib/auth";
import {
  cardToRow,
  configToRow,
  ensureHomeConfig,
  loadHomePayload,
} from "@/lib/homeConfigServer";
import {
  DEFAULT_HOME_CARDS,
  HOME_CARD_ACTIONS,
  isHomeIconName,
  isHexColor,
  isLockedAction,
  isSafeUrl,
  LOCKED_ACTIONS,
  mergeHomeConfig,
  type HomeCard,
  type HomeCardAction,
} from "@/lib/homeConfig";

const ADMIN_PROFILES = ["master", "admin", "campo"];

function campoDoUsuario(user: AuthUser, bodyCampoId?: unknown): string | null {
  // Só o master pode editar a home de outro campo — os demais ficam no seu.
  if (user.profileType === "master" && typeof bodyCampoId === "string" && bodyCampoId) {
    return bodyCampoId;
  }
  return user.campoId ?? null;
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!ADMIN_PROFILES.includes(user.profileType || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const campoId = campoDoUsuario(user, searchParams.get("campoId"));
    if (!campoId) {
      return NextResponse.json({ error: "Usuário sem campo definido." }, { status: 400 });
    }

    try {
      const payload = await ensureHomeConfig(campoId);
      return NextResponse.json({ campoId, ...payload }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("[GET /api/home-config] semeadura falhou:", error);
      // Sem conseguir gravar, ainda dá para editar em cima do que existe.
      const payload = await loadHomePayload(campoId);
      return NextResponse.json({ campoId, ...payload, seedFailed: true });
    }
  });
}

/** Valida o que veio da tela. Devolve a lista de erros (vazia = tudo certo). */
function validarCartoes(raw: unknown): { erros: string[]; cards: HomeCard[] } {
  const erros: string[] = [];
  if (!Array.isArray(raw)) return { erros: ["A lista de cartões é obrigatória."], cards: [] };

  const cards: HomeCard[] = [];
  const chaves = new Set<string>();

  raw.forEach((item, i) => {
    const c = (item ?? {}) as Record<string, unknown>;
    const pos = `Cartão ${i + 1}`;

    const key = typeof c.key === "string" ? c.key.trim().slice(0, 60) : "";
    if (!key) { erros.push(`${pos}: identificador vazio.`); return; }
    if (chaves.has(key)) { erros.push(`${pos}: identificador "${key}" repetido.`); return; }
    chaves.add(key);

    const action = c.action as HomeCardAction;
    if (!HOME_CARD_ACTIONS.includes(action)) { erros.push(`${pos}: ação inválida.`); return; }

    const title = typeof c.title === "string" ? c.title.trim() : "";
    if (!title) { erros.push(`${pos}: o título é obrigatório.`); return; }
    if (title.length > 160) { erros.push(`${pos}: título acima de 160 caracteres.`); return; }

    const url = typeof c.url === "string" && c.url.trim() ? c.url.trim() : null;
    if (url && !isSafeUrl(url)) { erros.push(`${pos}: endereço inválido (use http://, https:// ou /caminho).`); return; }
    if (action === "link" && !url) { erros.push(`${pos}: cartão de link precisa de um endereço.`); return; }

    if (c.icon !== undefined && c.icon !== null && !isHomeIconName(c.icon)) {
      erros.push(`${pos}: ícone fora do catálogo.`); return;
    }
    for (const campo of ["iconColor", "hoverColor"] as const) {
      const v = c[campo];
      if (v !== null && v !== undefined && v !== "" && !isHexColor(v)) {
        erros.push(`${pos}: cor inválida em ${campo} (use #RRGGBB).`); return;
      }
    }

    cards.push({
      key,
      action,
      title,
      subtitle: typeof c.subtitle === "string" && c.subtitle.trim() ? c.subtitle : null,
      url,
      icon: isHomeIconName(c.icon) ? c.icon : "Circle",
      iconColor: isHexColor(c.iconColor) ? c.iconColor : null,
      hoverColor: isHexColor(c.hoverColor) ? c.hoverColor : null,
      // "Instalar o app" é padrão da plataforma: não se oculta por configuração.
      visible: isLockedAction(action) ? true : c.visible !== false,
      pulse: c.pulse === true,
      liveDot: c.liveDot === true,
      fullWidth: c.fullWidth === true,
    });
  });

  return { erros, cards };
}

export async function PUT(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!ADMIN_PROFILES.includes(user.profileType || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const campoId = campoDoUsuario(user, (body as any).campoId);
    if (!campoId) {
      return NextResponse.json({ error: "Usuário sem campo definido." }, { status: 400 });
    }

    // mergeHomeConfig já sanea cor, URL e número; o que sobra validar é o que
    // ele silenciosamente corrigiria e a pessoa precisa saber que está errado.
    const config = mergeHomeConfig((body as any).config);
    const { erros, cards } = validarCartoes((body as any).cards);

    // "Instalar o app" é padrão da plataforma: se a tela mandou uma lista sem
    // ele, repõe em vez de recusar o salvamento inteiro.
    for (const acao of LOCKED_ACTIONS) {
      if (!cards.some((c) => c.action === acao)) {
        const padrao = DEFAULT_HOME_CARDS.find((c) => c.action === acao);
        if (padrao) cards.push({ ...padrao });
      }
    }

    if (erros.length) {
      return NextResponse.json({ error: "Configuração inválida.", detalhes: erros }, { status: 400 });
    }

    await prisma.$transaction(
      async (tx) => {
        const salvo = await tx.homeConfig.upsert({
          where: { campoId },
          create: { campoId, ...configToRow(config) },
          update: configToRow(config),
        });

        // A lista enviada substitui a anterior por inteiro, e nada referencia
        // um cartão pelo id — então apagar e recriar resolve em 2 statements.
        //
        // A versão anterior fazia um upsert POR CARTÃO. Com ~700 ms de ida e
        // volta até o pooler do Supabase, 10 cartões passavam dos 5 s do limite
        // da transação interativa e o Prisma a fechava no meio
        // ("Transaction not found"), devolvendo 500 na hora de salvar.
        await tx.homeCard.deleteMany({ where: { configId: salvo.id } });

        if (cards.length) {
          await tx.homeCard.createMany({
            data: cards.map((card, i) => ({ ...cardToRow(card, i), configId: salvo.id })),
          });
        }
      },
      // Folga para banco lento: 3 statements não deveriam chegar perto disso,
      // mas um timeout aqui significa a home meio salva.
      { timeout: 20_000, maxWait: 10_000 }
    );

    const payload = await loadHomePayload(campoId);
    return NextResponse.json({ campoId, ...payload });
  });
}
