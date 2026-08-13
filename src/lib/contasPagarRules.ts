/**
 * Regras puras do módulo Contas a Pagar — sem Prisma, sem I/O.
 *
 * Fica separado de contasPagarService.ts (que fala com o banco) pelo mesmo
 * motivo de assetLocationOptions.ts: as telas e o E2E importam daqui sem
 * arrastar o cliente do Prisma para o bundle.
 *
 * Todo dinheiro circula aqui em **centavos inteiros**. Somar 0.1 + 0.2 em
 * float e comparar com o saldo é a origem clássica do "sobrou R$ 0,01 na
 * parcela que deveria estar quitada" — com inteiro isso não acontece.
 *
 * Ver docs/modules/contas-a-pagar/SPEC.md §2.2.
 */

export type StatusParcela = "PENDENTE" | "PARCIAL" | "PAGO" | "ATRASADO" | "CANCELADA";
export type StatusConta = StatusParcela;
export type StatusAprovacao = "NAO_REQUER" | "AGUARDANDO" | "APROVADO" | "REPROVADO";

export const STATUS_PARCELA_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  PARCIAL: "Parcial",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
  CANCELADA: "Cancelada",
};

export const STATUS_PARCELA_CORES: Record<string, string> = {
  PENDENTE: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  PARCIAL: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  PAGO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ATRASADO: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  CANCELADA: "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500",
};

/** Cores hex para os gráficos (recharts) — mesma semântica dos badges. */
export const STATUS_PARCELA_HEX: Record<string, string> = {
  PENDENTE: "#94a3b8",
  PARCIAL: "#f59e0b",
  PAGO: "#10b981",
  ATRASADO: "#ef4444",
  CANCELADA: "#cbd5e1",
};

export const STATUS_APROVACAO_LABELS: Record<string, string> = {
  NAO_REQUER: "Não requer",
  AGUARDANDO: "Aguardando aprovação",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
};

/**
 * Listas que o usuário escolhe em dropdown NÃO ficam aqui.
 *
 * Tipo de credor, natureza de despesa, tipo de departamento, tipo de conta
 * bancária, forma de pagamento, bancos e departamentos são todos cadastros em
 * Configurações › Listas e Cadastros Auxiliares, servidos por
 * `/api/lookups/<chave>` (ver src/lib/lookupRegistry.ts). A igreja cria,
 * renomeia e desativa item sem depender de deploy.
 *
 * O que sobra em código são os STATUS acima — eles não são escolha do usuário,
 * são resultado do cálculo de saldo/vencimento. Um status "cadastrável" seria
 * um valor que o motor de recálculo não saberia produzir.
 */

/** Rótulo usado sempre que banco/departamento não foi informado (histórico). */
export const NAO_INFORMADO = "Não informado";

// ─── dinheiro ────────────────────────────────────────────────────────────────

/** Reais (number | string | Decimal-like) → centavos inteiros. */
export function paraCentavos(valor: unknown): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Centavos inteiros → reais com 2 casas. */
export function paraReais(centavos: number): number {
  return Math.round(centavos) / 100;
}

export function formatarBRL(valor: unknown): string {
  const n = paraReais(paraCentavos(valor));
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── datas ───────────────────────────────────────────────────────────────────

/** "2026-08-12" ou Date → "2026-08-12" (sem fuso: a data de vencimento é DATE). */
export function paraDataISO(valor: Date | string): string {
  if (typeof valor === "string") return valor.slice(0, 10);
  return valor.toISOString().slice(0, 10);
}

/**
 * Soma meses preservando o "fim do mês": 31/01 + 1 mês = 28/02 (ou 29 em ano
 * bissexto), não 03/03. É o comportamento que a tesouraria espera de uma
 * parcela mensal.
 */
export function somarMeses(dataISO: string, meses: number): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-").map(Number);
  const alvoMes = mes - 1 + meses;
  const alvoAno = ano + Math.floor(alvoMes / 12);
  const mesNormalizado = ((alvoMes % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(alvoAno, mesNormalizado + 1, 0)).getUTCDate();
  const diaFinal = Math.min(dia, ultimoDia);
  return `${alvoAno}-${String(mesNormalizado + 1).padStart(2, "0")}-${String(diaFinal).padStart(2, "0")}`;
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Dias corridos entre duas datas ISO (b − a). Negativo = b antes de a. */
export function diasEntre(aISO: string, bISO: string): number {
  const a = Date.parse(`${aISO.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${bISO.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

// ─── geração de parcelas ─────────────────────────────────────────────────────

export type ParcelaGerada = {
  numeroParcela: number;
  totalParcelas: number;
  valorParcelaCentavos: number;
  dataVencimento: string;
};

/**
 * Divide o título em parcelas mensais.
 *
 * - `valoresManuais` (em reais) permite parcelas desiguais — nem toda despesa
 *   parcelada tem parcelas idênticas.
 * - Sem valores manuais, divide igual e joga o resíduo dos centavos na
 *   **última** parcela, de modo que a soma bata exatamente com o total.
 *
 * Lança Error com mensagem em português quando os dados não fecham — quem
 * chama traduz em HTTP 400.
 */
export function gerarParcelas(params: {
  valorTotal: number | string;
  numeroParcelas: number;
  primeiroVencimento: string;
  valoresManuais?: Array<number | string> | null;
  vencimentosManuais?: Array<string> | null;
}): ParcelaGerada[] {
  const totalCentavos = paraCentavos(params.valorTotal);
  const n = Math.trunc(Number(params.numeroParcelas) || 0);

  if (totalCentavos <= 0) throw new Error("O valor total precisa ser maior que zero.");
  if (n < 1) throw new Error("A conta precisa de pelo menos uma parcela.");
  if (n > 360) throw new Error("Número de parcelas acima do limite (360).");
  if (!/^\d{4}-\d{2}-\d{2}/.test(params.primeiroVencimento || "")) {
    throw new Error("Data do primeiro vencimento inválida.");
  }

  let valores: number[];
  if (params.valoresManuais && params.valoresManuais.length) {
    if (params.valoresManuais.length !== n) {
      throw new Error(`Foram informados ${params.valoresManuais.length} valores para ${n} parcelas.`);
    }
    valores = params.valoresManuais.map(paraCentavos);
    if (valores.some((v) => v <= 0)) throw new Error("Toda parcela precisa ter valor maior que zero.");
    const soma = valores.reduce((acc, v) => acc + v, 0);
    // Tolerância de 1 centavo para o resíduo de divisão feito na tela.
    if (Math.abs(soma - totalCentavos) > 1) {
      throw new Error(
        `A soma das parcelas (${formatarBRL(paraReais(soma))}) não bate com o valor total (${formatarBRL(paraReais(totalCentavos))}).`
      );
    }
    // Encosta a diferença de 1 centavo na última, para fechar exato.
    valores[valores.length - 1] += totalCentavos - soma;
  } else {
    const base = Math.floor(totalCentavos / n);
    valores = Array.from({ length: n }, () => base);
    valores[n - 1] += totalCentavos - base * n;
  }

  if (params.vencimentosManuais && params.vencimentosManuais.length !== n) {
    throw new Error(`Foram informados ${params.vencimentosManuais.length} vencimentos para ${n} parcelas.`);
  }

  return valores.map((valorParcelaCentavos, i) => ({
    numeroParcela: i + 1,
    totalParcelas: n,
    valorParcelaCentavos,
    dataVencimento:
      params.vencimentosManuais?.[i]?.slice(0, 10) ?? somarMeses(params.primeiroVencimento, i),
  }));
}

// ─── status ──────────────────────────────────────────────────────────────────

/**
 * Status de uma parcela a partir do que já foi pago nela.
 *
 * Detalhe que importa no caso do pastor: parcela **vencida com pagamento
 * parcial continua PARCIAL**, não vira ATRASADO. Ela aparece no relatório de
 * saldo residual, que é onde a tesouraria acompanha esse tipo de dívida.
 */
export function statusDaParcela(params: {
  valorParcelaCentavos: number;
  valorPagoCentavos: number;
  dataVencimento: string;
  cancelada?: boolean;
  hoje?: string;
}): StatusParcela {
  if (params.cancelada) return "CANCELADA";

  const devido = params.valorParcelaCentavos;
  const pago = params.valorPagoCentavos;
  const hoje = params.hoje ?? hojeISO();

  if (pago >= devido) return "PAGO";
  if (pago > 0) return "PARCIAL";
  return diasEntre(hoje, params.dataVencimento.slice(0, 10)) < 0 ? "ATRASADO" : "PENDENTE";
}

/** Saldo devedor da parcela, nunca negativo. */
export function saldoDaParcela(valorParcelaCentavos: number, valorPagoCentavos: number): number {
  return Math.max(0, valorParcelaCentavos - valorPagoCentavos);
}

/**
 * Status do título a partir do conjunto de parcelas (as canceladas não contam).
 *
 *   todas PAGO                          → PAGO
 *   alguma PAGO/PARCIAL, mas não todas  → PARCIAL
 *   nenhuma paga e alguma ATRASADO      → ATRASADO
 *   resto                               → PENDENTE
 */
export function derivarStatusGeral(parcelas: Array<{ status: string }>): StatusConta {
  const ativas = parcelas.filter((p) => p.status !== "CANCELADA");
  if (!ativas.length) return "CANCELADA";

  if (ativas.every((p) => p.status === "PAGO")) return "PAGO";
  if (ativas.some((p) => p.status === "PAGO" || p.status === "PARCIAL")) return "PARCIAL";
  if (ativas.some((p) => p.status === "ATRASADO")) return "ATRASADO";
  return "PENDENTE";
}

// ─── validações ──────────────────────────────────────────────────────────────

export type ResultadoValidacao = { ok: true } | { ok: false; erro: string };

/**
 * Um pagamento precisa ser positivo e caber no saldo da parcela. Pagar mais que
 * o devido não é "crédito", é erro de digitação — e num caixa de igreja isso
 * vira diferença de prestação de contas.
 */
export function validarPagamento(params: {
  valorPagoCentavos: number;
  valorSaldoCentavos: number;
}): ResultadoValidacao {
  if (params.valorPagoCentavos <= 0) {
    return { ok: false, erro: "O valor do pagamento precisa ser maior que zero." };
  }
  if (params.valorSaldoCentavos <= 0) {
    return { ok: false, erro: "Esta parcela já está quitada." };
  }
  if (params.valorPagoCentavos > params.valorSaldoCentavos) {
    return {
      ok: false,
      erro: `Pagamento de ${formatarBRL(paraReais(params.valorPagoCentavos))} excede o saldo de ${formatarBRL(paraReais(params.valorSaldoCentavos))} desta parcela.`,
    };
  }
  return { ok: true };
}

/** Conta acima da alçada só libera pagamento depois de aprovada. */
export function podePagar(conta: { statusAprovacao: string }): ResultadoValidacao {
  if (conta.statusAprovacao === "AGUARDANDO") {
    return { ok: false, erro: "Esta conta aguarda aprovação e ainda não pode ser paga." };
  }
  if (conta.statusAprovacao === "REPROVADO") {
    return { ok: false, erro: "Esta conta foi reprovada e não pode ser paga." };
  }
  return { ok: true };
}

/** Alçada: NAO_REQUER quando não há limite ou o valor está abaixo dele. */
export function aprovacaoInicial(valorTotal: number | string, alcada: number | string | null): StatusAprovacao {
  const limite = paraCentavos(alcada);
  if (!limite) return "NAO_REQUER";
  return paraCentavos(valorTotal) >= limite ? "AGUARDANDO" : "NAO_REQUER";
}

/** Sequencial por igreja: CP-2026-000123. */
export function proximoNumeroConta(ultimoNumero: string | null | undefined, ano: number): string {
  const prefixo = `CP-${ano}-`;
  const atual = ultimoNumero?.startsWith(prefixo)
    ? Number(ultimoNumero.slice(prefixo.length)) || 0
    : 0;
  return `${prefixo}${String(atual + 1).padStart(6, "0")}`;
}
