/**
 * Aprovação/devolução de um culto.
 *
 * Dois níveis: LOCAL (dirigente da igreja) e HOSPEDEIRA (dirigente da igreja
 * hospedeira). O Pastor Presidente NÃO aprova — "fica só olhando no nível topo".
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth';
import { NIVEIS, getCultoScope, podeAprovarNivel, type Nivel } from '@/lib/cultoScope';
import { recalcularStatus, temNivelHospedeira } from '@/lib/cultoService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const registro = await prisma.cultoRegistro.findFirst({
      where: { id, deletedAt: null },
      include: { aprovacoes: true },
    });
    if (!registro) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const nivel = String(body.nivel || '').toUpperCase() as Nivel;
    const decisao = String(body.decisao || '').toUpperCase();
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : '';

    if (!NIVEIS.includes(nivel)) {
      return NextResponse.json({ error: `Nível inválido: ${body.nivel}` }, { status: 400 });
    }
    if (!['APROVADO', 'REJEITADO'].includes(decisao)) {
      return NextResponse.json({ error: 'Decisão deve ser APROVADO ou REJEITADO.' }, { status: 400 });
    }
    if (decisao === 'REJEITADO' && !motivo) {
      return NextResponse.json(
        { error: 'Explique o motivo da devolução — é o que a igreja vai receber para corrigir.' },
        { status: 400 },
      );
    }

    const scope = await getCultoScope(user);
    if (!podeAprovarNivel(scope, nivel, registro.churchId)) {
      return NextResponse.json(
        { error: `Você não está anexado como aprovador do nível ${nivel} desta igreja.` },
        { status: 403 },
      );
    }

    if (nivel === 'HOSPEDEIRA' && !temNivelHospedeira(registro)) {
      return NextResponse.json(
        { error: 'Esta igreja não está anexada a uma hospedeira — o culto fecha na aprovação local.' },
        { status: 409 },
      );
    }

    // Ordem dos níveis: a hospedeira só decide depois do dirigente local.
    if (nivel === 'LOCAL' && registro.status === 'ABERTO') {
      return NextResponse.json(
        { error: 'Ainda faltam blocos para enviar. Não há o que aprovar.' },
        { status: 409 },
      );
    }
    if (nivel === 'HOSPEDEIRA' && registro.status !== 'APROVADO_LOCAL') {
      return NextResponse.json(
        { error: 'Aguardando a aprovação do dirigente da igreja antes de subir para a hospedeira.' },
        { status: 409 },
      );
    }

    await prisma.cultoAprovacao.upsert({
      where: { registroId_nivel: { registroId: id, nivel } },
      create: { registroId: id, nivel, decisao, aprovadorId: user.id, motivo: motivo || null },
      update: { decisao, aprovadorId: user.id, motivo: motivo || null, decididoEm: new Date() },
    });

    // Devolução da hospedeira apaga a aprovação local: o dirigente local
    // reavalia com o apontamento em mãos, em vez de o culto ficar num limbo
    // "aprovado por ele, rejeitado acima".
    if (nivel === 'HOSPEDEIRA' && decisao === 'REJEITADO') {
      await prisma.cultoAprovacao.deleteMany({ where: { registroId: id, nivel: 'LOCAL' } });
    }

    const resultado = await recalcularStatus(id);
    return NextResponse.json(resultado);
  });
}
