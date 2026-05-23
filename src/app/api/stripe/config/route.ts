import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId } from "@/lib/helpers";
import { encryptKey, decryptKey, maskKey } from "@/lib/stripeEncrypt";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const config = await prisma.stripeConfig.findUnique({ where: { campoId, deletedAt: null } });
    if (!config) return NextResponse.json(null);

    // Nunca retorna as chaves em texto puro — apenas as versões mascaradas
    return NextResponse.json({
      id: config.id,
      campoId: config.campoId,
      publishableKey: config.publishableKey,
      secretKeyMask: maskKey(decryptKey(config.secretKeyEnc)),
      webhookSecretMask: config.webhookSecretEnc ? maskKey(decryptKey(config.webhookSecretEnc)) : null,
      accountId: config.accountId,
      ativo: config.ativo,
      modoProd: config.modoProd,
      pixEnabled: config.pixEnabled,
      cardEnabled: config.cardEnabled,
      currency: config.currency,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const {
      campoId: reqCampoId, publishableKey, secretKey, webhookSecret,
      accountId, ativo, modoProd, pixEnabled, cardEnabled, currency,
    } = body;
    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    if (!publishableKey || !secretKey) {
      return NextResponse.json({ error: "publishableKey e secretKey são obrigatórios" }, { status: 400 });
    }
    if (!publishableKey.startsWith("pk_") || !secretKey.startsWith("sk_")) {
      return NextResponse.json({ error: "Chaves Stripe inválidas (pk_... / sk_...)" }, { status: 400 });
    }

    const secretKeyEnc = encryptKey(secretKey);
    const webhookSecretEnc = webhookSecret ? encryptKey(webhookSecret) : undefined;

    const existing = await prisma.stripeConfig.findUnique({ where: { campoId } });

    const config = existing
      ? await prisma.stripeConfig.update({
          where: { campoId },
          data: {
            publishableKey,
            secretKeyEnc,
            ...(webhookSecretEnc && { webhookSecretEnc }),
            accountId: accountId || null,
            ativo: ativo !== false,
            modoProd: modoProd === true,
            pixEnabled: pixEnabled !== false,
            cardEnabled: cardEnabled !== false,
            currency: currency || "brl",
            deletedAt: null,
          },
        })
      : await prisma.stripeConfig.create({
          data: {
            campoId,
            publishableKey,
            secretKeyEnc,
            webhookSecretEnc: webhookSecretEnc || null,
            accountId: accountId || null,
            ativo: ativo !== false,
            modoProd: modoProd === true,
            pixEnabled: pixEnabled !== false,
            cardEnabled: cardEnabled !== false,
            currency: currency || "brl",
            createdBy: user.id ?? undefined,
          },
        });

    return NextResponse.json({
      id: config.id,
      campoId: config.campoId,
      publishableKey: config.publishableKey,
      secretKeyMask: maskKey(secretKey),
      ativo: config.ativo,
      modoProd: config.modoProd,
    }, { status: existing ? 200 : 201 });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    await prisma.stripeConfig.updateMany({
      where: { campoId },
      data: { deletedAt: new Date(), ativo: false },
    });
    return NextResponse.json({ ok: true });
  });
}
