import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { escopoDeIgrejas, igrejaDeGravacao } from "@/lib/contasPagarScope";

/** Campos gravaveis de um credor, vindos do corpo da requisição. */
function dadosDoCorpo(body: Record<string, unknown>) {
  const texto = (v: unknown) => (v === undefined ? undefined : v === "" || v === null ? null : String(v));
  return {
    nome: body.nome === undefined ? undefined : String(body.nome).trim(),
    tipoPessoa: texto(body.tipoPessoa),
    cpfCnpj: texto(body.cpfCnpj),
    tipoCredor: texto(body.tipoCredor),
    memberId: texto(body.memberId),
    // Igreja que recebe (repasse entre igrejas) — excludente com memberId.
    favorecidoChurchId: texto(body.favorecidoChurchId),
    bancoId: texto(body.bancoId),
    bancoNome: texto(body.bancoNome),
    agencia: texto(body.agencia),
    conta: texto(body.conta),
    tipoConta: texto(body.tipoConta),
    chavePix: texto(body.chavePix),
    telefone: texto(body.telefone),
    email: texto(body.email),
    observacoes: texto(body.observacoes),
    ativo: body.ativo === undefined ? undefined : !!body.ativo,
  };
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams;

    const escopo = escopoDeIgrejas(user, {
      churchId: sp.get("churchId") ?? undefined,
      regionalId: sp.get("regionalId") ?? undefined,
      campoId: sp.get("campoId") ?? undefined,
    });
    if (!escopo.ok) return NextResponse.json({ error: escopo.erro }, { status: 403 });

    const where: Record<string, unknown> = { deletedAt: null, church: escopo.churchWhere };
    const q = (sp.get("q") ?? "").trim();
    if (q) {
      where.OR = [
        { nome: { contains: q, mode: "insensitive" } },
        { cpfCnpj: { contains: q, mode: "insensitive" } },
      ];
    }
    const tipoCredor = sp.get("tipoCredor");
    if (tipoCredor) where.tipoCredor = { in: tipoCredor.split(",").filter(Boolean) };
    if (sp.get("ativo") === "1") where.ativo = true;

    const data = await prisma.credor.findMany({
      where,
      orderBy: { nome: "asc" },
      take: Math.min(Math.max(1, Number(sp.get("pageSize")) || 500), 2000),
      include: {
        banco: { select: { id: true, nome: true } },
        member: { select: { id: true, fullName: true, rol: true } },
        church: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(serializeBigInts({ data, total: data.length }));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));

    const igreja = igrejaDeGravacao(user, body.churchId);
    if (!igreja.ok) return NextResponse.json({ error: igreja.erro }, { status: 403 });

    const dados = dadosDoCorpo(body);
    if (!dados.nome) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

    const credor = await prisma.credor.create({
      data: {
        churchId: igreja.churchId,
        nome: dados.nome,
        tipoPessoa: dados.tipoPessoa ?? "PF",
        tipoCredor: dados.tipoCredor ?? "FORNECEDOR",
        cpfCnpj: dados.cpfCnpj ?? null,
        memberId: dados.favorecidoChurchId ? null : (dados.memberId ?? null),
        favorecidoChurchId: dados.favorecidoChurchId ?? null,
        bancoId: dados.bancoId ?? null,
        bancoNome: dados.bancoNome ?? null,
        agencia: dados.agencia ?? null,
        conta: dados.conta ?? null,
        tipoConta: dados.tipoConta ?? null,
        chavePix: dados.chavePix ?? null,
        telefone: dados.telefone ?? null,
        email: dados.email ?? null,
        observacoes: dados.observacoes ?? null,
        ativo: dados.ativo ?? true,
      },
    });

    return NextResponse.json(serializeBigInts(credor), { status: 201 });
  });
}
