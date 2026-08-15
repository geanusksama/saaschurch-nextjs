/**
 * E2E do vínculo Contas a Pagar ⇄ Livro Caixa, contra a API de verdade.
 *
 * Percorre o caminho que a tesouraria faz na tela:
 *
 *   1. cria uma conta parcelada (4x)
 *   2. paga PARCIAL a 1ª parcela  → parcela fica PARCIAL, saldo continua
 *   3. quita o residual da 1ª     → parcela fica PAGA, conta fica PARCIAL
 *   4. confere que cada pagamento virou DESPESA no livro caixa
 *   5. exclui o lançamento do livro caixa → tem que ESTORNAR a parcela
 *   6. confere que a parcela voltou a ficar em aberto e o lançamento saiu
 *   7. exclui uma parcela          → o valor é redistribuído nas restantes
 *   8. cancela a conta de teste (limpeza)
 *
 * Uso:
 *   MRM_TOKEN="<token do localStorage mrm_token>" \
 *   MRM_CHURCH_ID="<uuid da igreja>" \
 *   node scripts/e2e-contas-pagar-livro-caixa.mjs [http://localhost:3000]
 *
 * O token sai do navegador logado: DevTools › Application › Local Storage ›
 * mrm_token. O script cria e apaga os próprios dados, mas roda contra o banco
 * configurado no .env — use um ambiente de teste se o seu .env aponta para
 * produção.
 */

const BASE = process.argv[2] || process.env.MRM_BASE || 'http://localhost:3000';
const TOKEN = process.env.MRM_TOKEN;
const CHURCH_ID = process.env.MRM_CHURCH_ID;

if (!TOKEN) {
  console.error('Faltou MRM_TOKEN. Veja o cabeçalho deste arquivo.');
  process.exit(2);
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

let falhas = 0;
let contaId = null;

function ok(condicao, descricao, detalhe = '') {
  const marca = condicao ? '  ✓' : '  ✗';
  console.log(`${marca} ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
  return condicao;
}

async function api(rota, opcoes = {}) {
  const res = await fetch(`${BASE}/api${rota}`, { headers, ...opcoes });
  const texto = await res.text();
  let corpo = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = texto; }
  if (!res.ok) {
    const erro = new Error(corpo?.error || `HTTP ${res.status} em ${rota}`);
    erro.status = res.status;
    erro.corpo = corpo;
    throw erro;
  }
  return corpo;
}

const num = (v) => Number(v ?? 0);
const brl = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hoje = new Date().toISOString().slice(0, 10);

async function main() {
  console.log(`\nE2E Contas a Pagar ⇄ Livro Caixa — ${BASE}\n`);

  // ── 1. conta parcelada ─────────────────────────────────────────────────────
  console.log('1. Criando conta 4x R$ 100,00');
  const conta = await api('/contas-pagar', {
    method: 'POST',
    body: JSON.stringify({
      churchId: CHURCH_ID || undefined,
      descricao: `E2E automatizado ${new Date().toISOString()}`,
      valorTotal: 400,
      dataEmissao: hoje,
      primeiroVencimento: hoje,
      numeroParcelas: 4,
      parcelado: true,
      numeroDocumento: `E2E-${Date.now()}`,
    }),
  });
  contaId = conta.id;
  ok(conta.parcelas?.length === 4, 'conta criada com 4 parcelas', conta.numero);
  ok(num(conta.valorTotal) === 400, 'valor total de R$ 400,00');

  const parcela1 = conta.parcelas[0];
  ok(num(parcela1.valorParcela) === 100, 'parcela 1/4 vale R$ 100,00');

  // ── 2. pagamento parcial ───────────────────────────────────────────────────
  console.log('\n2. Pagando R$ 40,00 da parcela 1/4 (parcial)');
  const pg1 = await api(`/contas-pagar/parcelas/${parcela1.id}/pagamentos`, {
    method: 'POST',
    body: JSON.stringify({ valorPago: 40, dataPagamento: hoje, formaPagamento: 'DINHEIRO' }),
  });
  ok(pg1.parcela.status === 'PARCIAL', 'parcela ficou PARCIAL', pg1.parcela.status);
  ok(pg1.parcela.saldoCentavos === 6000, 'saldo de R$ 60,00', brl(pg1.parcela.saldoCentavos / 100));
  ok(Boolean(pg1.livroCaixaId), 'gerou lançamento no livro caixa', pg1.livroCaixaId);
  ok(pg1.statusGeral === 'PARCIAL', 'conta ficou PARCIAL', pg1.statusGeral);

  // ── 3. quitação do residual ────────────────────────────────────────────────
  console.log('\n3. Quitando o residual de R$ 60,00 da mesma parcela');
  const pg2 = await api(`/contas-pagar/parcelas/${parcela1.id}/pagamentos`, {
    method: 'POST',
    body: JSON.stringify({ valorPago: 60, dataPagamento: hoje, formaPagamento: 'DINHEIRO' }),
  });
  ok(pg2.parcela.status === 'PAGO', 'parcela ficou PAGA', pg2.parcela.status);
  ok(pg2.parcela.saldoCentavos === 0, 'saldo zerado');

  // ── 4. os dois pagamentos no livro caixa ───────────────────────────────────
  console.log('\n4. Conferindo os lançamentos no livro caixa');
  const detalhe = await api(`/contas-pagar/parcelas/${parcela1.id}`);
  const pagamentosAtivos = (detalhe.pagamentos ?? []).filter((p) => !p.estornadoEm);
  ok(pagamentosAtivos.length === 2, 'dois pagamentos ativos na parcela', String(pagamentosAtivos.length));
  ok(pagamentosAtivos.every((p) => p.livroCaixaId), 'todos com lançamento no livro caixa');

  // ── 5. excluir o lançamento do livro caixa deve estornar ───────────────────
  console.log('\n5. Excluindo o 2º lançamento pelo Livro Caixa (deve estornar)');
  const alvo = pagamentosAtivos[1];
  const exclusao = await api(`/livro-caixa/${alvo.livroCaixaId}`, {
    method: 'DELETE',
    body: JSON.stringify({ motivo: 'teste e2e' }),
  });
  ok(exclusao.estornado === true, 'a exclusão virou estorno', JSON.stringify(exclusao));

  // ── 6. parcela voltou a ficar em aberto ────────────────────────────────────
  console.log('\n6. Conferindo o efeito do estorno na parcela');
  const depois = await api(`/contas-pagar/parcelas/${parcela1.id}`);
  ok(depois.status === 'PARCIAL', 'parcela voltou para PARCIAL', depois.status);
  ok(num(depois.valorSaldo) === 60, 'saldo voltou para R$ 60,00', brl(depois.valorSaldo));
  ok(num(depois.valorPago) === 40, 'pago voltou para R$ 40,00', brl(depois.valorPago));
  const estornados = (depois.pagamentos ?? []).filter((p) => p.estornadoEm);
  ok(estornados.length === 1, 'estorno registrado no histórico (nada apagado)');

  // ── 7. excluir parcela redistribui o valor ─────────────────────────────────
  console.log('\n7. Excluindo a parcela 4/4 (o valor vai para as restantes)');
  const contaAntes = await api(`/contas-pagar/${contaId}`);
  const ultima = contaAntes.parcelas[contaAntes.parcelas.length - 1];
  const exclusaoParcela = await api(`/contas-pagar/parcelas/${ultima.id}`, { method: 'DELETE' });
  ok(exclusaoParcela.parcelasRestantes === 3, 'sobraram 3 parcelas', String(exclusaoParcela.parcelasRestantes));

  const contaDepois = await api(`/contas-pagar/${contaId}`);
  const somaParcelas = contaDepois.parcelas.reduce((s, p) => s + num(p.valorParcela), 0);
  ok(Math.abs(somaParcelas - 400) < 0.01, 'as parcelas continuam somando R$ 400,00', brl(somaParcelas));
  ok(num(contaDepois.parcelas[0].valorParcela) === 100, 'a parcela já paga não mudou de valor', brl(contaDepois.parcelas[0].valorParcela));
  const livres = contaDepois.parcelas.slice(1);
  ok(livres.every((p) => num(p.valorParcela) === 150), 'as duas livres viraram R$ 150,00 cada',
    livres.map((p) => brl(p.valorParcela)).join(' / '));
  ok(contaDepois.parcelas.every((p, i) => p.numeroParcela === i + 1 && p.totalParcelas === 3),
    'parcelas renumeradas para 1/3, 2/3 e 3/3');
}

async function limpar() {
  if (!contaId) return;
  console.log('\n8. Excluindo a conta de teste (cascata real quando não há histórico)');
  try {
    // Estorna o que sobrou para o cancelamento ser aceito.
    const conta = await api(`/contas-pagar/${contaId}`);
    for (const parcela of conta.parcelas ?? []) {
      for (const pagamento of parcela.pagamentos ?? []) {
        if (pagamento.estornadoEm) continue;
        await api(`/contas-pagar/pagamentos/${pagamento.id}/estorno`, {
          method: 'POST',
          body: JSON.stringify({ motivo: 'limpeza do teste e2e' }),
        }).catch(() => {});
      }
    }
    const saida = await api(`/contas-pagar/${contaId}`, { method: 'DELETE' });
    ok(['apagada', 'cancelada'].includes(saida.modo), `conta de teste removida (${saida.modo})`);

    // Cascata real: sem histórico de pagamento, a conta some do banco.
    if (saida.modo === 'apagada') {
      const sumiu = await api(`/contas-pagar/${contaId}`).then(() => false).catch((e) => e.status === 404);
      ok(sumiu, 'conta não existe mais (parcelas foram em cascata)');
    }
  } catch (e) {
    console.log(`  ! não deu para limpar automaticamente (${e.message}) — cancele a conta ${contaId} na tela`);
  }
}

main()
  .catch((e) => {
    falhas++;
    console.error(`\n✗ Erro: ${e.message}`);
    if (e.corpo) console.error(JSON.stringify(e.corpo, null, 2));
  })
  .finally(async () => {
    await limpar();
    console.log(falhas === 0 ? '\n✅ Tudo passou.\n' : `\n❌ ${falhas} verificação(ões) falharam.\n`);
    process.exit(falhas === 0 ? 0 : 1);
  });
