/**
 * Numeração de dízimos por bloco.
 *
 * A igreja recebe talões de recibo físicos ("bloco 100, do 1 ao 100") e o
 * tesoureiro amarra cada dízimo lançado ao número do recibo que entregou. Este
 * arquivo guarda as regras que a tela e as rotas precisam enxergar igual — quem
 * duplicar a comparação de nome de plano em um dos lados vai ver a validação
 * pedir número numa tela e não pedir na outra.
 *
 * Regras que valem em todo lugar:
 *   1. Só DÍZIMO. Oferta e despesa não passam por aqui.
 *   2. O número pertence à igreja. O 100 da Sede e o 100 da congregação são
 *      recibos diferentes; nenhuma das duas vê ou gasta o da outra.
 *   3. A exigência é ligada igreja por igreja, porque os talões chegam aos
 *      poucos.
 */

/** Estados de um número da cartela. */
export const STATUS_LIVRE = "LIVRE";
export const STATUS_RESERVADO = "RESERVADO";
export const STATUS_USADO = "USADO";

export type DizimoNumeroStatus =
  | typeof STATUS_LIVRE
  | typeof STATUS_RESERVADO
  | typeof STATUS_USADO;

/**
 * Teto de números por bloco. Talão de recibo real não passa de algumas
 * centenas; o limite existe porque o cadastro materializa uma linha por número
 * e um dedo errado ("1 a 1000000") viraria um `createMany` de um milhão.
 */
export const MAX_NUMEROS_POR_BLOCO = 5000;

function normaliza(texto: string | null | undefined) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export type PlanoParaNumeracao = {
  nome?: string | null;
  /** Coluna `exige_numeracao_bloco` do plano de contas. */
  exigeNumeracaoBloco?: boolean | null;
  exige_numeracao_bloco?: boolean | null;
};

/**
 * Este plano de contas exige número do bloco?
 *
 * A flag do cadastro manda quando está preenchida. Quando é NULL — o estado de
 * todo banco que nunca abriu a tela de Plano de Contas — cai no nome: "dízimo"
 * sim, "oferta" não. Sem esse fallback a função nasceria desligada em toda
 * igreja até alguém marcar a caixinha uma por uma.
 *
 * NÃO dá para reaproveitar `considera_dizimo` aqui: essa coluna está `true`
 * também em OFERTAS, porque ela significa "entra no relatório de dizimistas",
 * outra pergunta.
 */
export function planoExigeNumeracaoDizimo(plano: PlanoParaNumeracao | null | undefined): boolean {
  if (!plano) return false;

  const flag = plano.exigeNumeracaoBloco ?? plano.exige_numeracao_bloco;
  if (typeof flag === "boolean") return flag;

  const nome = normaliza(plano.nome);
  if (!nome) return false;
  // "oferta" primeiro: um plano chamado "DIZIMOS E OFERTAS" é caixa misturada e
  // não tem como amarrar a um recibo só.
  if (nome.includes("oferta")) return false;
  return nome.includes("dizimo");
}

/** Aceita "0100", " 100 " e devolve 100. Recusa o resto. */
export function parseNumeroRecibo(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (!texto || !/^\d{1,9}$/.test(texto)) return null;
  const n = Number(texto);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export type FaixaBloco = { numeroInicial: number; numeroFinal: number };

/** Valida a faixa pedida no cadastro. Devolve o erro pronto para a tela. */
export function validarFaixa(faixa: FaixaBloco): string | null {
  const { numeroInicial, numeroFinal } = faixa;
  if (!Number.isSafeInteger(numeroInicial) || numeroInicial <= 0) {
    return "Número inicial inválido.";
  }
  if (!Number.isSafeInteger(numeroFinal) || numeroFinal <= 0) {
    return "Número final inválido.";
  }
  if (numeroFinal < numeroInicial) {
    return "O número final não pode ser menor que o inicial.";
  }
  const total = numeroFinal - numeroInicial + 1;
  if (total > MAX_NUMEROS_POR_BLOCO) {
    return `A faixa tem ${total.toLocaleString("pt-BR")} números. O máximo por bloco é ${MAX_NUMEROS_POR_BLOCO.toLocaleString("pt-BR")}.`;
  }
  return null;
}

/** Mensagens que o tesoureiro lê. Ficam aqui para a tela e a rota falarem igual. */
export const MSG = {
  foraDoBloco: (numero: number) =>
    `O número ${numero} não existe em nenhum bloco desta igreja. Confira o talão: cada igreja só pode usar os números dos blocos que recebeu.`,
  jaUsado: (numero: number, quando?: string | null, favorecido?: string | null) => {
    const detalhe = [
      quando ? `em ${quando}` : null,
      favorecido ? `para ${favorecido}` : null,
    ].filter(Boolean).join(" ");
    return `O número ${numero} já foi usado${detalhe ? ` ${detalhe}` : ""}. Use o próximo número livre do bloco.`;
  },
  obrigatorio:
    "Esta igreja trabalha com bloco de numeração: informe o número do recibo de dízimo.",
  semBloco:
    "Esta igreja está marcada para exigir numeração, mas não tem nenhum bloco cadastrado. Cadastre o bloco em Finanças › Blocos de Numeração.",
} as const;
