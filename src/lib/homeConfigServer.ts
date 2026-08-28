/**
 * Leitura e semeadura da configuração da home pública no banco.
 *
 * Três garantias que este arquivo existe para dar:
 *  1. a home NUNCA cai por causa de configuração — banco fora, tabela ainda não
 *     migrada, JSON estragado: qualquer erro vira o default do código;
 *  2. a tela de administração nunca abre vazia — `ensureHomeConfig` grava, na
 *     primeira visita, o conteúdo real que a home mostra hoje (textos, imagens,
 *     ícones e links), para a igreja editar em cima de dado de verdade;
 *  3. endereço, telefone, redes sociais e programação de culto vêm de
 *     `headquarters` / `church_schedule` — os mesmos registros de Sistema →
 *     Informações da Igreja. A home só lê; quem edita é aquela tela.
 */
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_HOME_CARDS,
  DEFAULT_HOME_CONFIG,
  DEFAULT_HOME_PAYLOAD,
  DEFAULT_HOME_SEDE,
  mergeHomeCards,
  mergeHomeConfig,
  mergeHomeSede,
  type HomeCard,
  type HomeConfig,
  type HomeConfigPayload,
  type HomeSede,
} from "@/lib/homeConfig";

/** Linha do banco → objeto de configuração já saneado e completo. */
function rowToConfig(row: any): HomeConfig {
  return mergeHomeConfig({
    siteTitle: row.siteTitle,
    siteDescription: row.siteDescription,
    faviconUrl: row.faviconUrl,
    logoUrl: row.logoUrl,
    watermarkUrl: row.watermarkUrl,
    pwaName: row.pwaName,
    pwaShortName: row.pwaShortName,
    pwaIcon192: row.pwaIcon192,
    pwaIcon512: row.pwaIcon512,
    pwaIconMaskable: row.pwaIconMaskable,
    heroEyebrow: row.heroEyebrow,
    heroTitle: row.heroTitle,
    heroText: row.heroText,
    verseRef: row.verseRef,
    verseLabel: row.verseLabel,
    verseText: row.verseText,
    showVerse: row.showVerse,
    bgDark: row.bgDark,
    bgLight: row.bgLight,
    accentColor: row.accentColor,
    defaultDark: row.defaultDark,
    showSymbols: row.showSymbols,
    showSpotlights: row.showSpotlights,
    watermarkOpacity:
      row.watermarkOpacity === null || row.watermarkOpacity === undefined
        ? undefined
        : Number(row.watermarkOpacity),
    symbolColors: row.symbolColors,
    services: row.servicesConfig,
  });
}

/** Objeto de configuração → colunas do banco. */
export function configToRow(config: HomeConfig) {
  return {
    siteTitle: config.siteTitle,
    siteDescription: config.siteDescription,
    faviconUrl: config.faviconUrl,
    logoUrl: config.logoUrl,
    watermarkUrl: config.watermarkUrl,
    pwaName: config.pwaName,
    pwaShortName: config.pwaShortName,
    pwaIcon192: config.pwaIcon192,
    pwaIcon512: config.pwaIcon512,
    pwaIconMaskable: config.pwaIconMaskable,
    heroEyebrow: config.heroEyebrow,
    heroTitle: config.heroTitle,
    heroText: config.heroText,
    verseRef: config.verseRef,
    verseLabel: config.verseLabel,
    verseText: config.verseText,
    showVerse: config.showVerse,
    bgDark: config.bgDark,
    bgLight: config.bgLight,
    accentColor: config.accentColor,
    defaultDark: config.defaultDark,
    showSymbols: config.showSymbols,
    showSpotlights: config.showSpotlights,
    watermarkOpacity: config.watermarkOpacity,
    symbolColors: config.symbolColors,
    servicesConfig: config.services as any,
  };
}

export function cardToRow(card: HomeCard, index: number) {
  return {
    key: card.key,
    action: card.action,
    title: card.title,
    subtitle: card.subtitle,
    url: card.url,
    icon: card.icon,
    iconColor: card.iconColor,
    hoverColor: card.hoverColor,
    visible: card.visible,
    pulse: card.pulse,
    liveDot: card.liveDot,
    fullWidth: card.fullWidth,
    sortOrder: index,
  };
}

/** Junta logradouro, número, bairro e cidade numa linha só. */
function montarEndereco(hq: any): string {
  const rua = [hq.street, hq.number].filter(Boolean).join(", ");
  const local = [hq.neighborhood, hq.city].filter(Boolean).join(" - ");
  return [rua, local].filter(Boolean).join(" - ");
}

/**
 * Sede do campo: a marcada com `show`, senão a primeira cadastrada. Sem
 * nenhuma, devolve o default (o que a home mostra hoje) em vez de um cartão
 * vazio.
 */
export async function loadHomeSede(campoId: string | null): Promise<HomeSede> {
  if (!campoId) return DEFAULT_HOME_SEDE;
  try {
    const hq = await prisma.legacyChurchHeadquarters.findFirst({
      where: { fieldId: campoId },
      orderBy: [{ show: "desc" }, { churchName: "asc" }],
      include: { schedules: { orderBy: { order: "asc" } } },
    });
    if (!hq) return DEFAULT_HOME_SEDE;

    return mergeHomeSede({
      churchName: hq.churchName,
      address: montarEndereco(hq),
      phone: hq.contact,
      whatsapp: hq.whatsapp,
      email: hq.email,
      instagram: hq.instagram,
      youtube: hq.youtube,
      facebook: hq.facebook,
      tiktok: hq.tiktok,
      site: hq.site,
      schedules: hq.schedules.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        name: s.name,
        time: s.time,
      })),
    });
  } catch (error) {
    console.error("[homeConfig] sede não pôde ser lida, usando o padrão:", error);
    return DEFAULT_HOME_SEDE;
  }
}

/**
 * Lê a configuração. Nunca lança: sem linha, sem tabela ou com erro de banco,
 * devolve o default — a home não pode cair por causa disso.
 */
export async function loadHomePayload(campoId: string | null): Promise<HomeConfigPayload> {
  if (!campoId) return DEFAULT_HOME_PAYLOAD;

  const sede = await loadHomeSede(campoId);

  try {
    const row = await prisma.homeConfig.findUnique({
      where: { campoId },
      include: { cards: { orderBy: { sortOrder: "asc" } } },
    });
    if (!row) return { ...DEFAULT_HOME_PAYLOAD, sede };
    return {
      config: rowToConfig(row),
      cards: mergeHomeCards(row.cards),
      sede,
    };
  } catch (error) {
    // Banco de igreja ainda sem a migração aplicada cai aqui — e é o caminho
    // certo: a home continua no ar com o conteúdo padrão.
    console.error("[homeConfig] leitura falhou, usando o padrão:", error);
    return { ...DEFAULT_HOME_PAYLOAD, sede };
  }
}

/**
 * Garante a linha do campo com o conteúdo REAL da home (o mesmo que está no
 * ar). Só cria — nunca sobrescreve o que a igreja já editou.
 */
export async function ensureHomeConfig(campoId: string): Promise<HomeConfigPayload> {
  const existing = await prisma.homeConfig.findUnique({
    where: { campoId },
    include: { cards: { orderBy: { sortOrder: "asc" } } },
  });

  if (existing) {
    // Linha existe mas ficou sem cartão (edição interrompida, importação
    // parcial): repõe os cartões reais em vez de mostrar uma lista vazia.
    if (existing.cards.length === 0) {
      await prisma.homeCard.createMany({
        data: DEFAULT_HOME_CARDS.map((card, i) => ({
          ...cardToRow(card, i),
          configId: existing.id,
        })),
      });
      return loadHomePayload(campoId);
    }
    return {
      config: rowToConfig(existing),
      cards: mergeHomeCards(existing.cards),
      sede: await loadHomeSede(campoId),
    };
  }

  // Semeia com o nome real da igreja quando a sede já está cadastrada — é o
  // dado que a pessoa espera ver na tela, não "AD Campinas" para todo mundo.
  const sede = await loadHomeSede(campoId);
  const nome = sede.churchName?.trim();
  const seed: HomeConfig = nome
    ? {
        ...DEFAULT_HOME_CONFIG,
        siteTitle: nome,
        pwaName: nome,
        pwaShortName: nome,
        services: { ...DEFAULT_HOME_CONFIG.services, title: `Atendimento ${nome}` },
      }
    : DEFAULT_HOME_CONFIG;

  await prisma.homeConfig.create({
    data: {
      campoId,
      ...configToRow(seed),
      cards: { create: DEFAULT_HOME_CARDS.map((card, i) => cardToRow(card, i)) },
    },
  });

  return loadHomePayload(campoId);
}
