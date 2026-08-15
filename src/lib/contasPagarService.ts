/**
 * Contas a Pagar — regras que falam com o banco.
 *
 * As regras puras (status, saldo, geração de parcelas, validações) ficam em
 * contasPagarRules.ts e são reexportadas daqui. Este arquivo cuida do que
 * precisa de transação: recalcular parcela/conta, registrar pagamento com baixa
 * no livro caixa e estornar.
 *
 * Invariante do módulo: `valor_pago`, `valor_saldo` e `status` da parcela — e o
 * `status_geral` da conta — NUNCA são gravados por uma rota. Só saem de
 * recalcularParcela()/recalcularConta(), sempre dentro da mesma transação do
 * pagamento. É isso que impede o clássico "a soma dos pagamentos não bate com o
 * saldo da parcela".
 *
 * Ver docs/modules/contas-a-pagar/SPEC.md.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  derivarStatusGeral,
  gerarParcelas,
  paraCentavos,
  paraDataISO,
  paraReais,
  podePagar,
  proximoNumeroConta,
  saldoDaParcela,
  statusDaParcela,
  validarPagamento,
} from "@/lib/contasPagarRules";

export * from "./contasPagarRules";

/** Cliente ou transação — as funções abaixo aceitam os dois. */
type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Opções das transações do módulo.
 *
 * O padrão do Prisma é 5s, e um pagamento faz meia dúzia de idas ao banco
 * (validar, lançar no livro caixa, recalcular parcela e conta). Contra o
 * pooler remoto do Supabase, cada ida custa dezenas de milissegundos e o
 * padrão estoura — abortando a transação no meio de uma operação financeira.
 * Recalcular em massa (`recalcularContaCompleta`) é o caso mais pesado.
 */
export const TX_CONTAS_PAGAR = { timeout: 30_000, maxWait: 15_000 } as const;

/** Erro de regra de negócio: quem chama traduz `status` em resposta HTTP. */
export class RegraContasPagarError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "RegraContasPagarError";
    this.status = status;
  }
}

const dec = (centavos: number) => new Prisma.Decimal(paraReais(centavos).toFixed(2));

/**
 * Traduz o credor para os campos de favorecido do livro caixa.
 *
 * O livro caixa fala MEMBRO | IGREJA | PJ | NAO_MEMBRO e guarda `member_id`
 * quando é membro — é isso que liga a despesa ao perfil e ao ROL. O cadastro de
 * credor fala outra língua (PF/PJ + tipo de credor + vínculo opcional com
 * membro), então a tradução mora aqui, num lugar só: a rota de pagamento e
 * qualquer outra porta futura usam a mesma regra.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function favorecidoDoCredor(credor: any) {
  if (!credor) {
    return { tipoPessoa: null as string | null, nome: null as string | null, memberId: null as string | null, idExterno: null as string | null };
  }

  // Igreja favorecida (repasse, ajuda, aluguel entre igrejas).
  if (credor.favorecidoChurchId) {
    return {
      tipoPessoa: "IGREJA",
      nome: credor.igrejaFavorecida?.name || credor.nome || null,
      memberId: null,
      idExterno: credor.favorecidoChurchId,
    };
  }

  // Credor ligado a membro: o nome vem do cadastro do membro, não do apelido
  // digitado no credor — o extrato do membro precisa bater com o perfil.
  if (credor.memberId) {
    return {
      tipoPessoa: "MEMBRO",
      nome: credor.member?.fullName || credor.nome || null,
      memberId: credor.memberId,
      idExterno: null,
    };
  }

  if (credor.tipoPessoa === "PJ") {
    return {
      tipoPessoa: "PJ",
      nome: credor.nome ?? null,
      memberId: null,
      idExterno: credor.cpfCnpj || null,
    };
  }

  return { tipoPessoa: "NAO_MEMBRO", nome: credor.nome ?? null, memberId: null, idExterno: null };
}

// ─── recálculo ───────────────────────────────────────────────────────────────

/**
 * Reescreve valor_pago / valor_saldo / status da parcela a partir dos
 * pagamentos NÃO estornados. Devolve o estado novo.
 */
export async function recalcularParcela(db: Db, parcelaId: string, hoje?: string) {
  const parcela = await db.parcelaContaPagar.findUnique({
    where: { id: parcelaId },
    select: { id: true, valorParcela: true, dataVencimento: true, status: true },
  });
  if (!parcela) throw new RegraContasPagarError("Parcela não encontrada.", 404);

  const pagamentos = await db.pagamentoParcela.findMany({
    where: { parcelaId, estornadoEm: null },
    select: { valorPago: true },
  });

  const devidoCentavos = paraCentavos(parcela.valorParcela);
  const pagoCentavos = pagamentos.reduce((acc, p) => acc + paraCentavos(p.valorPago), 0);
  const saldoCentavos = saldoDaParcela(devidoCentavos, pagoCentavos);

  const status = statusDaParcela({
    valorParcelaCentavos: devidoCentavos,
    valorPagoCentavos: pagoCentavos,
    dataVencimento: paraDataISO(parcela.dataVencimento),
    cancelada: parcela.status === "CANCELADA",
    hoje,
  });

  await db.parcelaContaPagar.update({
    where: { id: parcelaId },
    data: { valorPago: dec(pagoCentavos), valorSaldo: dec(saldoCentavos), status },
  });

  return { pagoCentavos, saldoCentavos, status };
}

/** Reescreve o status_geral do título a partir das parcelas. */
export async function recalcularConta(db: Db, contaPagarId: string) {
  const parcelas = await db.parcelaContaPagar.findMany({
    where: { contaPagarId },
    select: { status: true },
  });
  const statusGeral = derivarStatusGeral(parcelas);
  await db.contaPagar.update({ where: { id: contaPagarId }, data: { statusGeral } });
  return statusGeral;
}

/**
 * Recalcula todas as parcelas de uma conta e depois a própria conta. Usado
 * depois de editar valores/vencimentos e pelo job que "vira o dia" (parcela que
 * venceu ontem precisa aparecer como ATRASADO hoje).
 */
export async function recalcularContaCompleta(db: Db, contaPagarId: string, hoje?: string) {
  const parcelas = await db.parcelaContaPagar.findMany({
    where: { contaPagarId },
    select: { id: true },
  });
  for (const p of parcelas) await recalcularParcela(db, p.id, hoje);
  return recalcularConta(db, contaPagarId);
}

// ─── criação do título ───────────────────────────────────────────────────────

/** Alçada configurada por igreja em `settings` (0/ausente = sem alçada). */
export async function alcadaDaIgreja(db: Db, churchId: string): Promise<number> {
  const setting = await db.setting.findFirst({
    where: { churchId, settingKey: "contas_pagar.alcada_aprovacao" },
    select: { settingValue: true },
  });
  const valor = Number(String(setting?.settingValue ?? "").replace(",", "."));
  return Number.isFinite(valor) && valor > 0 ? valor : 0;
}

/** Próximo número sequencial da igreja, no formato CP-2026-000123. */
export async function proximoNumero(db: Db, churchId: string, ano = new Date().getFullYear()) {
  const ultima = await db.contaPagar.findFirst({
    where: { churchId, numero: { startsWith: `CP-${ano}-` } },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  return proximoNumeroConta(ultima?.numero, ano);
}

export type NovaContaInput = {
  churchId: string;
  descricao: string;
  valorTotal: number | string;
  dataEmissao: string;
  primeiroVencimento: string;
  numeroParcelas?: number;
  parcelado?: boolean;
  recorrente?: boolean;
  valoresManuais?: Array<number | string> | null;
  vencimentosManuais?: string[] | null;
  planoDeContaId?: string | null;
  credorId?: string | null;
  departamentoId?: string | null;
  bancoId?: string | null;
  formaPagamentoPrevista?: string | null;
  numeroDocumento?: string | null;
  anexoDocumentoUrl?: string | null;
  observacoes?: string | null;
  criadoPor?: string | null;
  statusAprovacao: string;
};

/**
 * Cria o título e gera as parcelas na mesma transação. Uma conta sem parcela
 * não existe: mesmo "à vista" é uma parcela 1/1.
 */
export async function criarContaComParcelas(db: Db, input: NovaContaInput) {
  const numeroParcelas = input.parcelado ? Math.max(1, Number(input.numeroParcelas) || 1) : 1;

  let parcelas;
  try {
    parcelas = gerarParcelas({
      valorTotal: input.valorTotal,
      numeroParcelas,
      primeiroVencimento: input.primeiroVencimento,
      valoresManuais: input.valoresManuais,
      vencimentosManuais: input.vencimentosManuais,
    });
  } catch (e) {
    throw new RegraContasPagarError(e instanceof Error ? e.message : "Parcelamento inválido.", 400);
  }

  const numero = await proximoNumero(db, input.churchId, new Date(input.dataEmissao).getUTCFullYear());

  const conta = await db.contaPagar.create({
    data: {
      churchId: input.churchId,
      numero,
      descricao: input.descricao,
      valorTotal: dec(paraCentavos(input.valorTotal)),
      dataEmissao: new Date(`${input.dataEmissao.slice(0, 10)}T00:00:00Z`),
      planoDeContaId: input.planoDeContaId || null,
      credorId: input.credorId || null,
      departamentoId: input.departamentoId || null,
      bancoId: input.bancoId || null,
      formaPagamentoPrevista: input.formaPagamentoPrevista || null,
      numeroDocumento: input.numeroDocumento || null,
      recorrente: !!input.recorrente,
      parcelado: numeroParcelas > 1,
      numeroParcelas,
      anexoDocumentoUrl: input.anexoDocumentoUrl || null,
      observacoes: input.observacoes || null,
      criadoPor: input.criadoPor || null,
      statusAprovacao: input.statusAprovacao,
      statusGeral: "PENDENTE",
    },
  });

  // Parcela recém-criada não tem pagamento nenhum, então o status sai do
  // cálculo em memória — chamar recalcularContaCompleta() aqui faria 3 queries
  // por parcela (12 parcelas = 36 idas ao banco) só para redescobrir que o
  // valor pago é zero, e estourava o timeout da transação num banco remoto.
  const statusIniciais = parcelas.map((p) =>
    statusDaParcela({
      valorParcelaCentavos: p.valorParcelaCentavos,
      valorPagoCentavos: 0,
      dataVencimento: p.dataVencimento,
    })
  );

  await db.parcelaContaPagar.createMany({
    data: parcelas.map((p, i) => ({
      churchId: input.churchId,
      contaPagarId: conta.id,
      numeroParcela: p.numeroParcela,
      totalParcelas: p.totalParcelas,
      valorParcela: dec(p.valorParcelaCentavos),
      valorPago: dec(0),
      valorSaldo: dec(p.valorParcelaCentavos),
      dataVencimento: new Date(`${p.dataVencimento}T00:00:00Z`),
      status: statusIniciais[i],
    })),
  });

  const statusGeral = derivarStatusGeral(statusIniciais.map((status) => ({ status })));
  if (statusGeral !== conta.statusGeral) {
    await db.contaPagar.update({ where: { id: conta.id }, data: { statusGeral } });
    return { ...conta, statusGeral };
  }
  return conta;
}

// ─── pagamento ───────────────────────────────────────────────────────────────

export type NovoPagamentoInput = {
  parcelaId: string;
  valorPago: number | string;
  dataPagamento: string;
  formaPagamento?: string | null;
  bancoId?: string | null;
  comprovanteUrl?: string | null;
  observacao?: string | null;
  registradoPor?: string | null;
  /** Nome do operador gravado no livro caixa (o campo é texto lá). */
  operadorNome?: string | null;
};

/**
 * Registra um pagamento (total ou parcial) numa parcela e faz a baixa contábil.
 *
 * Tudo numa transação só: ou o pagamento, o lançamento do livro caixa e os
 * recálculos entram juntos, ou nada entra. Meio caminho aqui significa dinheiro
 * que sumiu de um relatório e apareceu em outro.
 *
 * O saldo que sobra num pagamento parcial CONTINUA na mesma parcela — não vira
 * parcela nova. É o caso do pastor pago pela metade num mês e quitado meses
 * depois: dois registros em pagamentos_parcela, uma parcela só.
 */
export async function registrarPagamento(db: Db, input: NovoPagamentoInput) {
  const parcela = await db.parcelaContaPagar.findUnique({
    where: { id: input.parcelaId },
    include: {
      contaPagar: {
        include: {
          credor: {
            select: {
              nome: true, memberId: true, tipoPessoa: true, tipoCredor: true, cpfCnpj: true,
              favorecidoChurchId: true,
              member: { select: { id: true, fullName: true, rol: true } },
              igrejaFavorecida: { select: { id: true, name: true } },
            },
          },
          planoDeConta: { select: { nome: true, codigo: true } },
        },
      },
    },
  });
  if (!parcela) throw new RegraContasPagarError("Parcela não encontrada.", 404);
  if (parcela.status === "CANCELADA") {
    throw new RegraContasPagarError("Parcela cancelada não recebe pagamento.", 400);
  }

  const conta = parcela.contaPagar;
  const liberado = podePagar({ statusAprovacao: conta.statusAprovacao });
  if (!liberado.ok) throw new RegraContasPagarError(liberado.erro, 409);

  // Saldo recalculado na hora — não confia no valor gravado, que pode estar
  // defasado se dois pagamentos entraram em paralelo.
  const pagosAtuais = await db.pagamentoParcela.findMany({
    where: { parcelaId: parcela.id, estornadoEm: null },
    select: { valorPago: true },
  });
  const devidoCentavos = paraCentavos(parcela.valorParcela);
  const jaPagoCentavos = pagosAtuais.reduce((acc, p) => acc + paraCentavos(p.valorPago), 0);
  const saldoCentavos = saldoDaParcela(devidoCentavos, jaPagoCentavos);
  const valorCentavos = paraCentavos(input.valorPago);

  const valido = validarPagamento({ valorPagoCentavos: valorCentavos, valorSaldoCentavos: saldoCentavos });
  if (!valido.ok) throw new RegraContasPagarError(valido.erro, 400);

  const dataPagamento = input.dataPagamento.slice(0, 10);

  // Baixa contábil: uma DESPESA no livro caixa por pagamento. O livro caixa
  // grava o plano de conta pelo NOME (é assim nos 331 mil registros antigos),
  // então usa o nome já carregado junto com a conta.
  const planoNome = conta.planoDeConta?.nome ?? null;

  // O favorecido do livro caixa sai do credor, traduzido para o vocabulário da
  // tela de lançamento (MEMBRO | PJ | NAO_MEMBRO). Credor ligado a membro grava
  // o member_id e o nome do cadastro — é o que amarra o extrato ao perfil e o
  // que faltava quando o pagamento entrava por outra porta.
  const favorecido = favorecidoDoCredor(conta.credor);

  // Documento: número da conta + parcela. É por ele que se acha o pagamento no
  // livro caixa e se volta para o título de origem.
  const numeroDocumento = `${conta.numero} ${parcela.numeroParcela}/${parcela.totalParcelas}`;
  const lancamento = await db.livroCaixa.create({
    data: {
      churchId: parcela.churchId,
      dataLancamento: new Date(`${dataPagamento}T00:00:00Z`),
      referencia: `CP ${conta.numero} parcela ${parcela.numeroParcela}/${parcela.totalParcelas}`,
      valor: dec(valorCentavos),
      tipo: "DESPESA",
      formaPg: input.formaPagamento || conta.formaPagamentoPrevista || null,
      planoDeConta: planoNome,
      categoria: conta.planoDeConta?.nome ?? null,
      numDoc: numeroDocumento,
      tipoPessoa: favorecido.tipoPessoa,
      favorecido: favorecido.nome,
      memberId: favorecido.memberId,
      idFavorecidoExterno: favorecido.idExterno,
      bancoId: input.bancoId || conta.bancoId || null,
      departamentoId: conta.departamentoId || null,
      operador: input.operadorNome || null,
      operadorId: input.registradoPor || null,
      obs: input.observacao || conta.descricao,
      foto: input.comprovanteUrl || null,
      createdBy: input.registradoPor || null,
    },
    select: { id: true },
  });

  const pagamento = await db.pagamentoParcela.create({
    data: {
      churchId: parcela.churchId,
      parcelaId: parcela.id,
      valorPago: dec(valorCentavos),
      dataPagamento: new Date(`${dataPagamento}T00:00:00Z`),
      formaPagamento: input.formaPagamento || null,
      bancoId: input.bancoId || conta.bancoId || null,
      comprovanteUrl: input.comprovanteUrl || null,
      observacao: input.observacao || null,
      livroCaixaId: lancamento.id,
      registradoPor: input.registradoPor || null,
    },
  });

  const estadoParcela = await recalcularParcela(db, parcela.id);
  const statusGeral = await recalcularConta(db, conta.id);

  return { pagamento, parcela: estadoParcela, statusGeral, livroCaixaId: lancamento.id };
}

/**
 * Estorna um pagamento. Nada é apagado: o pagamento fica marcado com quem/quando
 * e por quê, e o lançamento do livro caixa é estornado logicamente (o mesmo
 * `deleted_at`/`deletado_por` que o resto do sistema usa).
 */
export async function estornarPagamento(
  db: Db,
  pagamentoId: string,
  motivo: string,
  usuario: { id?: string | null; nome?: string | null }
) {
  const pagamento = await db.pagamentoParcela.findUnique({
    where: { id: pagamentoId },
    include: { parcela: { select: { id: true, contaPagarId: true } } },
  });
  if (!pagamento) throw new RegraContasPagarError("Pagamento não encontrado.", 404);
  if (pagamento.estornadoEm) throw new RegraContasPagarError("Este pagamento já foi estornado.", 409);
  if (!motivo?.trim()) throw new RegraContasPagarError("Informe o motivo do estorno.", 400);

  await db.pagamentoParcela.update({
    where: { id: pagamentoId },
    data: {
      estornadoEm: new Date(),
      estornadoPor: usuario.id || null,
      motivoEstorno: motivo.trim(),
    },
  });

  if (pagamento.livroCaixaId) {
    await db.livroCaixa.updateMany({
      where: { id: pagamento.livroCaixaId, deletedAt: null },
      data: {
        deletedAt: new Date(),
        situacao: false,
        deletadoPor: usuario.nome || usuario.id || "estorno contas a pagar",
      },
    });
  }

  const estadoParcela = await recalcularParcela(db, pagamento.parcela.id);
  const statusGeral = await recalcularConta(db, pagamento.parcela.contaPagarId);

  return { parcela: estadoParcela, statusGeral };
}

// ─── exclusão de parcela ─────────────────────────────────────────────────────

/**
 * Exclui uma parcela e redistribui o valor dela entre as que sobraram.
 *
 * A regra que a tesouraria espera: o TÍTULO continua valendo o mesmo. Uma conta
 * de R$ 1.000 em 4× R$ 250 que perde uma parcela vira 3× R$ 333,33 — não some
 * R$ 250 do compromisso.
 *
 * Quem já recebeu pagamento não se mexe: a parcela paga fica com o valor que
 * foi pago, senão o saldo dela mudaria por baixo do recibo já emitido. A sobra
 * é dividida só entre as parcelas ainda intocadas, com o resíduo dos centavos
 * na última. Se não sobrar nenhuma parcela livre para absorver, aí sim o total
 * do título encolhe — não há onde pendurar o valor.
 */
export async function excluirParcela(db: Db, parcelaId: string) {
  const parcela = await db.parcelaContaPagar.findUnique({
    where: { id: parcelaId },
    select: { id: true, contaPagarId: true, numeroParcela: true },
  });
  if (!parcela) throw new RegraContasPagarError("Parcela não encontrada.", 404);

  const pagamentos = await db.pagamentoParcela.count({
    where: { parcelaId, estornadoEm: null },
  });
  if (pagamentos > 0) {
    throw new RegraContasPagarError(
      "Esta parcela já tem pagamento registrado. Estorne os pagamentos antes de excluí-la.",
      409
    );
  }

  const conta = await db.contaPagar.findUnique({
    where: { id: parcela.contaPagarId },
    select: { id: true, valorTotal: true },
  });
  if (!conta) throw new RegraContasPagarError("Conta a pagar não encontrada.", 404);

  const todas = await db.parcelaContaPagar.findMany({
    where: { contaPagarId: parcela.contaPagarId },
    orderBy: { numeroParcela: "asc" },
    select: { id: true, valorParcela: true, valorPago: true, dataVencimento: true },
  });
  if (todas.length <= 1) {
    throw new RegraContasPagarError(
      "Esta é a única parcela da conta. Cancele a conta inteira em vez de excluir a parcela.",
      409
    );
  }

  await db.parcelaContaPagar.delete({ where: { id: parcelaId } });

  const restantes = todas.filter((p) => p.id !== parcelaId);
  const travadas = restantes.filter((p) => paraCentavos(p.valorPago) > 0);
  const livres = restantes.filter((p) => paraCentavos(p.valorPago) === 0);

  const totalCentavos = paraCentavos(conta.valorTotal);
  const travadoCentavos = travadas.reduce((s, p) => s + paraCentavos(p.valorParcela), 0);
  const aDistribuir = totalCentavos - travadoCentavos;

  let novoTotalCentavos = totalCentavos;
  if (livres.length && aDistribuir > 0) {
    const base = Math.floor(aDistribuir / livres.length);
    for (let i = 0; i < livres.length; i++) {
      const valor = i === livres.length - 1 ? base + (aDistribuir - base * livres.length) : base;
      await db.parcelaContaPagar.update({
        where: { id: livres[i].id },
        data: { valorParcela: dec(valor), valorSaldo: dec(valor) },
      });
    }
  } else {
    // Nenhuma parcela livre (ou o pago já cobre o total): o título passa a valer
    // a soma do que sobrou.
    novoTotalCentavos = restantes.reduce((s, p) => s + paraCentavos(p.valorParcela), 0);
  }

  // Renumeração em duas passadas: (conta_pagar_id, numero_parcela) é único, e
  // mover 3→2 com a 2 ainda no lugar quebraria a constraint.
  const ordenadas = [...restantes].sort(
    (a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()
  );
  for (let i = 0; i < ordenadas.length; i++) {
    await db.parcelaContaPagar.update({
      where: { id: ordenadas[i].id },
      data: { numeroParcela: -(i + 1) },
    });
  }
  for (let i = 0; i < ordenadas.length; i++) {
    await db.parcelaContaPagar.update({
      where: { id: ordenadas[i].id },
      data: { numeroParcela: i + 1, totalParcelas: ordenadas.length },
    });
  }

  await db.contaPagar.update({
    where: { id: conta.id },
    data: {
      numeroParcelas: ordenadas.length,
      parcelado: ordenadas.length > 1,
      ...(novoTotalCentavos !== totalCentavos ? { valorTotal: dec(novoTotalCentavos) } : {}),
    },
  });

  const statusGeral = await recalcularContaCompleta(db, conta.id);

  return {
    parcelasRestantes: ordenadas.length,
    valorTotal: paraReais(novoTotalCentavos),
    totalAjustado: novoTotalCentavos !== totalCentavos,
    statusGeral,
  };
}

// ─── apoio ───────────────────────────────────────────────────────────────────

/**
 * Apaga a conta a pagar e tudo que pendura nela.
 *
 * Conta que NUNCA recebeu pagamento não deixou rastro contábil nenhum: some de
 * verdade do banco, e o Postgres leva junto as parcelas e os pagamentos pelo
 * ON DELETE CASCADE das FKs.
 *
 * Conta que já teve pagamento é outra história. Todo pagamento gerou um
 * lançamento no livro caixa, e esse lançamento não tem FK para o pagamento
 * (é assim de propósito, por causa dos 331 mil registros antigos). Apagar em
 * cascata deixaria despesas órfãs no livro caixa, apontando para um pagamento
 * que não existe mais — o caixa continuaria com dinheiro saindo por uma conta
 * fantasma. Nesse caso a conta é CANCELADA logicamente, preservando a trilha.
 * Para apagar de verdade, estorne os pagamentos primeiro (o estorno já baixa o
 * lançamento do livro caixa) — e mesmo assim a conta fica cancelada, porque o
 * histórico do estorno precisa continuar existindo.
 *
 * Devolve como a conta saiu: `{ modo: "apagada" | "cancelada" }`.
 */
export async function cancelarConta(db: Db, contaPagarId: string) {
  const ativos = await db.pagamentoParcela.count({
    where: { parcela: { contaPagarId }, estornadoEm: null },
  });
  if (ativos > 0) {
    throw new RegraContasPagarError(
      "Esta conta já tem pagamento registrado. Estorne os pagamentos antes de excluir.",
      409
    );
  }

  const historico = await db.pagamentoParcela.count({ where: { parcela: { contaPagarId } } });

  if (historico === 0) {
    // Cascata real: parcelas e pagamentos saem com a conta.
    await db.contaPagar.delete({ where: { id: contaPagarId } });
    return { modo: "apagada" as const };
  }

  await db.parcelaContaPagar.updateMany({ where: { contaPagarId }, data: { status: "CANCELADA" } });
  await db.contaPagar.update({
    where: { id: contaPagarId },
    data: { statusGeral: "CANCELADA", deletedAt: new Date() },
  });
  return { modo: "cancelada" as const };
}
