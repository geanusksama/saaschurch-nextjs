/**
 * Envio do bloco de um lançador.
 *
 * Regra que dá nome ao módulo: cada um só grava o PRÓPRIO bloco. Um tesoureiro
 * que tentar enviar PRESENCA leva 403, mesmo que a tela dele tenha o campo.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth';
import { BLOCOS, getCultoScope, podeEnviarBloco, type Bloco } from '@/lib/cultoScope';
import { recalcularStatus } from '@/lib/cultoService';

/** Campos aceitos por bloco. O que não estiver aqui é ignorado. */
const CAMPOS_POR_BLOCO: Record<Bloco, string[]> = {
  // `observacao` vale para os três blocos: é o recado de quem lança para quem
  // aprova, separado do conteúdo do bloco EXTRA (`texto`).
  FINANCEIRO: ['totalDizimos', 'totalOfertas', 'qtdDizimos', 'qtdOfertas', 'observacao'],
  PRESENCA: [
    'qtdHomens',
    'qtdMulheres',
    'qtdJovens',
    'qtdAdolescentes',
    'qtdCriancas',
    'qtdVisitantes',
    'qtdConversoes',
    'qtdReconciliacoes',
    'qtdFamilias',
    'cadeirasVazias',
    'observacao',
  ],
  EXTRA: ['texto', 'anexoUrl', 'observacao'],
};

const CAMPOS_DECIMAIS = new Set(['totalDizimos', 'totalOfertas']);
const CAMPOS_TEXTO = new Set(['texto', 'anexoUrl', 'observacao']);

function normalizar(bloco: Bloco, body: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const campo of CAMPOS_POR_BLOCO[bloco]) {
    const bruto = body[campo];
    if (bruto === undefined) continue;
    if (bruto === null || bruto === '') {
      saida[campo] = null;
      continue;
    }
    if (CAMPOS_TEXTO.has(campo)) {
      saida[campo] = String(bruto).trim() || null;
      continue;
    }
    const numero = Number(bruto);
    if (!Number.isFinite(numero) || numero < 0) {
      throw new Error(`Valor inválido em ${campo}.`);
    }
    saida[campo] = CAMPOS_DECIMAIS.has(campo) ? numero : Math.round(numero);
  }
  return saida;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const registro = await prisma.cultoRegistro.findFirst({ where: { id, deletedAt: null } });
    if (!registro) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const bloco = String(body.bloco || '').toUpperCase() as Bloco;
    if (!BLOCOS.includes(bloco)) {
      return NextResponse.json({ error: `Bloco inválido: ${body.bloco}` }, { status: 400 });
    }

    const scope = await getCultoScope(user);
    if (!podeEnviarBloco(scope, bloco, registro.churchId)) {
      return NextResponse.json(
        { error: `Você não está anexado à posição responsável pelo bloco ${bloco} desta igreja.` },
        { status: 403 },
      );
    }

    // Depois de aprovado, o número não muda mais sem passar por uma devolução.
    if (!['ABERTO', 'AGUARDANDO_LOCAL', 'REJEITADO'].includes(registro.status)) {
      return NextResponse.json(
        { error: 'Este culto já foi aprovado. Peça a devolução ao dirigente para corrigir.' },
        { status: 409 },
      );
    }

    let dados: Record<string, unknown>;
    try {
      dados = normalizar(bloco, body);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const enviar = body.enviar !== false; // padrão: gravar já como enviado

    const lancamento = await prisma.cultoLancamento.upsert({
      where: { registroId_bloco: { registroId: id, bloco } },
      create: {
        registroId: id,
        bloco,
        enviadoPor: user.id,
        enviadoEm: enviar ? new Date() : null,
        ...dados,
      },
      update: {
        enviadoPor: user.id,
        enviadoEm: enviar ? new Date() : null,
        ...dados,
      },
    });

    // Uma devolução destrava a edição; reenviar precisa apagar a decisão antiga
    // para o dirigente olhar de novo o número corrigido.
    if (registro.status === 'REJEITADO' && enviar) {
      await prisma.cultoAprovacao.deleteMany({ where: { registroId: id } });
    }

    const resultado = await recalcularStatus(id);
    return NextResponse.json({ lancamento, ...resultado });
  });
}
