import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonSemCache, rotaMobile } from '@/lib/mobile/rota';

/**
 * Painel Mobile — o que está esperando alguém do campo: solicitações em
 * análise, Pix para conferir, pedidos e reembolsos. Contagens só; as listas
 * ficam nas telas de cada assunto. Secretário/tesoureiro de uma igreja vê só
 * a própria igreja (mesma regra das listas).
 */
export async function GET(req: NextRequest) {
  return rotaMobile(req, 'mobile_painel', 'view', async ({ campoId, igreja }) => {
    const daIgreja = igreja ? { churchId: igreja } : {};
    const agora = new Date();
    const [solicitacoes, contribuicoes, pedidos, reembolsos, contas, eventos] = await Promise.all([
      prisma.appV3Solicitacao.count({ where: { campoId, ...daIgreja, status: { in: ['EM_ANALISE', 'AGUARDANDO_LINK'] } } }),
      prisma.appV3Contribuicao.count({ where: { campoId, ...daIgreja, status: 'AGUARDANDO_CONFERENCIA' } }),
      prisma.appV3Pedido.count({ where: { campoId, ...daIgreja, status: { in: ['AGUARDANDO_CONFERENCIA', 'PAGO', 'EM_SEPARACAO'] } } }),
      prisma.appV3Reembolso.count({ where: { status: 'SOLICITADO', perfil: { campoId, ...daIgreja } } }),
      prisma.appV3Perfil.count({ where: { campoId, ...daIgreja, excluidoEm: null } }),
      prisma.appV3Evento.count({ where: { campoId, escopo: 'CAMPO', publicado: true, inicio: { gte: agora } } }),
    ]);
    return jsonSemCache({ solicitacoes, contribuicoes, pedidos, reembolsos, contas, eventos });
  });
}
