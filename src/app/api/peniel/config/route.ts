import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

const DEFAULT_CONFIG = {
  title: "Peniel",
  subtitle: "Um lugar de encontro, fé e transformação",
  description: 'A referência bíblica principal para "Peniel" é Gênesis 32:24-30. O termo significa "a face de Deus" e simboliza um momento de confronto, transformação e mudança de identidade após um encontro profundo e pessoal com o Senhor.',
  heroBgImage: "",
  primaryColor: "#0b2819", // Deep green
  secondaryColor: "#d4af37", // Gold
  accentColor: "#c5a880", // Sand/Beige
  buttonsConfig: {
    primaryLabel: "Ver Testemunhos",
    primaryLink: "#testemunhos",
    secondaryLabel: "Participar do Próximo Evento",
    secondaryLink: "#agenda"
  },
  heroCards: [
    { title: "Encontros que transformam vidas", image: "" },
    { title: "Uma comunidade que acolhe e fortalece", image: "", buttonText: "Ler Mais", buttonLink: "#testemunhos" },
    { title: "Palavra que renova e direciona", image: "" }
  ],
  testimonyVideos: [
    { name: "Juliana R.", quote: "O Peniel mudou a minha história.", videoUrl: "", imageUrl: "" },
    { name: "Marcos A.", quote: "Encontrei propósito e direção aqui.", videoUrl: "", imageUrl: "" },
    { name: "Camila S.", quote: "Aprendi a confiar e descansar em Deus.", videoUrl: "", imageUrl: "" },
    { name: "Lucas P.", quote: "Uma família que ora, acolhe e edifica.", videoUrl: "", imageUrl: "" }
  ],
  whatsappInstanceId: null
};

// GET /api/peniel/config
// Publicly retrieves Peniel page settings for a given campoId
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let campoId = searchParams.get("campoId");

    // Fallback: If no campoId is specified, resolve to the campo that actually
    // has Peniel set up (config first, then events), so the public page does not
    // land on an arbitrary empty campo when multiple campos exist.
    if (!campoId) {
      const configuredCampo = await prisma.penielConfig.findFirst({
        select: { campoId: true }
      });
      if (configuredCampo) {
        campoId = configuredCampo.campoId;
      } else {
        const eventCampo = await prisma.penielEvent.findFirst({
          where: { deletedAt: null },
          select: { campoId: true }
        });
        if (eventCampo) {
          campoId = eventCampo.campoId;
        } else {
          const firstCampo = await prisma.campo.findFirst({
            where: { deletedAt: null },
            select: { id: true }
          });
          if (firstCampo) {
            campoId = firstCampo.id;
          }
        }
      }
    }

    if (!campoId) {
      return NextResponse.json({ error: "Nenhum campo encontrado no sistema." }, { status: 404 });
    }

    const config = await prisma.penielConfig.findUnique({
      where: { campoId }
    });

    if (!config) {
      return NextResponse.json({ ...DEFAULT_CONFIG, campoId });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("[GET /api/peniel/config] Error:", error);
    return NextResponse.json({ error: "Erro interno ao buscar configurações." }, { status: 500 });
  }
}

// POST /api/peniel/config
// Saves or updates Peniel settings for the authenticated user's campo context
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    // Only administrators or higher can manage settings
    if (!["master", "admin", "campo"].includes(user.profileType || "")) {
      return NextResponse.json({ error: "Acesso negado. Apenas administradores podem gerenciar configurações." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      title,
      subtitle,
      description,
      heroBgImage,
      primaryColor,
      secondaryColor,
      accentColor,
      buttonsConfig,
      heroCards,
      testimonyVideos,
      whatsappInstanceId
    } = body;

    // Use active user's campoId (or override if master)
    const targetCampoId = user.profileType === "master" && body.campoId ? body.campoId : user.campoId;

    if (!targetCampoId) {
      return NextResponse.json({ error: "O campoId é obrigatório." }, { status: 400 });
    }

    const updatedConfig = await prisma.penielConfig.upsert({
      where: { campoId: targetCampoId },
      create: {
        campoId: targetCampoId,
        title: title || DEFAULT_CONFIG.title,
        subtitle: subtitle || DEFAULT_CONFIG.subtitle,
        description: description || DEFAULT_CONFIG.description,
        heroBgImage: heroBgImage || DEFAULT_CONFIG.heroBgImage,
        primaryColor: primaryColor || DEFAULT_CONFIG.primaryColor,
        secondaryColor: secondaryColor || DEFAULT_CONFIG.secondaryColor,
        accentColor: accentColor || DEFAULT_CONFIG.accentColor,
        buttonsConfig: buttonsConfig || DEFAULT_CONFIG.buttonsConfig,
        heroCards: heroCards || DEFAULT_CONFIG.heroCards,
        testimonyVideos: testimonyVideos || DEFAULT_CONFIG.testimonyVideos,
        whatsappInstanceId: whatsappInstanceId || null
      },
      update: {
        title: title !== undefined ? title : undefined,
        subtitle: subtitle !== undefined ? subtitle : undefined,
        description: description !== undefined ? description : undefined,
        heroBgImage: heroBgImage !== undefined ? heroBgImage : undefined,
        primaryColor: primaryColor !== undefined ? primaryColor : undefined,
        secondaryColor: secondaryColor !== undefined ? secondaryColor : undefined,
        accentColor: accentColor !== undefined ? accentColor : undefined,
        buttonsConfig: buttonsConfig !== undefined ? buttonsConfig : undefined,
        heroCards: heroCards !== undefined ? heroCards : undefined,
        testimonyVideos: testimonyVideos !== undefined ? testimonyVideos : undefined,
        whatsappInstanceId: whatsappInstanceId !== undefined ? whatsappInstanceId : undefined
      }
    });

    return NextResponse.json(updatedConfig);
  });
}
