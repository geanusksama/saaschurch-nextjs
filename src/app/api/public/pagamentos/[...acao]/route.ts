/**
 * Pagamentos do site público (sem login) — src/lib/asaas/vitrine.ts.
 *
 * GET  vitrine                 → eventos com ingressos e produtos do campo (mesmas tabelas do app)
 * POST checkout                → { itens, comprador: { nome, cpf, celular, email? }, metodo: PIX|CARTAO }
 * GET  status/:cobrancaId      → situação do pagamento (consulta o Asaas se pendente) + ingressos quando pago
 * GET  peniel/:eventId         → { asaas: boolean } — o modal do Peniel decide entre pagar agora e o fluxo antigo
 * POST peniel/pagar            → { inscricaoId, codigo, cpf, metodo, email? }
 * POST dept/pagar              → { tipo: pedido|inscricao, id, token, metodo } (sites de departamento)
 *
 * Campo: domínio/?campo= (publicTenant). Preço e vagas sempre do banco.
 */
import { NextRequest, NextResponse } from 'next/server';
import { respostaDeErro } from '@/lib/asaas/appAuth';
import { campoDoSite, checkoutSite, pagarDept, pagarPeniel, penielTemAsaas, statusSite, vitrine } from '@/lib/asaas/vitrine';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ acao: string[] }> };

const json = (d: unknown, status = 200) => NextResponse.json(d, { status, headers: { 'Cache-Control': 'no-store' } });

async function rodar(fn: () => Promise<unknown>) {
  try {
    return json(await fn());
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function GET(req: NextRequest, { params }: P) {
  const [a, id] = (await params).acao;
  if (a === 'vitrine') return rodar(async () => vitrine(await campoDoSite(req)));
  if (a === 'status' && id) return rodar(() => statusSite(id));
  if (a === 'peniel' && id) return rodar(async () => ({ asaas: await penielTemAsaas(id) }));
  return json({ error: 'Rota desconhecida.' }, 404);
}

export async function POST(req: NextRequest, { params }: P) {
  const [a, b] = (await params).acao;
  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (a === 'checkout') return rodar(() => checkoutSite(req, corpo));
  if (a === 'peniel' && b === 'pagar') return rodar(() => pagarPeniel(corpo));
  if (a === 'dept' && b === 'pagar') return rodar(() => pagarDept(corpo));
  return json({ error: 'Rota desconhecida.' }, 404);
}
