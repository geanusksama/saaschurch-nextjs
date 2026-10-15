/**
 * Cliente HTTP do Asaas (API v3). Só roda no servidor.
 *
 * A chave vem da configuração do campo (asaas_configs, criptografada) — nunca
 * de código, do navegador ou do app. Referência: https://docs.asaas.com/reference
 *
 * Valores em reais com 2 casas, como o Asaas usa (49.90).
 */

const BASE = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
} as const;

export type AmbienteAsaas = keyof typeof BASE;
export type FormaAsaas = 'UNDEFINED' | 'PIX' | 'CREDIT_CARD' | 'BOLETO';
export type CicloAsaas = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';

export class AsaasErro extends Error {
  constructor(public status: number, public erros: { code?: string; description?: string }[], mensagem?: string) {
    super(mensagem || erros.map((e) => e.description).filter(Boolean).join('; ') || `Asaas respondeu ${status}`);
  }
}

export function ambienteDaChave(chave: string): AmbienteAsaas | null {
  if (chave.startsWith('$aact_prod_')) return 'production';
  if (chave.startsWith('$aact_hmlg_')) return 'sandbox';
  return null;
}

export interface CartaoAsaas {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface TitularAsaas {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone?: string;
  mobilePhone?: string;
}

export interface PagamentoAsaas {
  id: string;
  customer: string;
  status: string;
  value: number;
  netValue?: number;
  billingType: string;
  invoiceUrl?: string;
  dueDate?: string;
  description?: string;
  externalReference?: string | null;
  installment?: string | null;
  installmentCount?: number | null;
  subscription?: string | null;
  paymentLink?: string | null;
  confirmedDate?: string | null;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  refunds?: unknown;
  creditCard?: { creditCardNumber?: string; creditCardBrand?: string; creditCardToken?: string } | null;
  deleted?: boolean;
}

export interface AssinaturaAsaas {
  id: string;
  customer: string;
  status: string;
  value: number;
  cycle: string;
  billingType: string;
  nextDueDate?: string;
  description?: string;
  externalReference?: string | null;
  deleted?: boolean;
  creditCard?: { creditCardNumber?: string; creditCardBrand?: string; creditCardToken?: string } | null;
}

export interface Lista<T> { data: T[]; hasMore: boolean; totalCount: number }

export function clienteAsaas(apiKey: string, ambiente: AmbienteAsaas) {
  const base = BASE[ambiente];
  if (!base) throw new Error(`Ambiente Asaas inválido: ${ambiente}`);
  const doChave = ambienteDaChave(apiKey);
  if (doChave && doChave !== ambiente) throw new Error('A chave Asaas é de outro ambiente (sandbox x produção).');

  async function req<T>(metodo: string, caminho: string, corpo?: unknown, tentativa = 0): Promise<T> {
    const r = await fetch(`${base}${caminho}`, {
      method: metodo,
      headers: { access_token: apiKey, 'Content-Type': 'application/json', 'User-Agent': 'saaschurch' },
      // GET com corpo responde 403 no Asaas.
      body: corpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(25_000),
      cache: 'no-store',
    });
    if (r.status >= 500 && metodo === 'GET' && tentativa < 2) {
      await new Promise((ok) => setTimeout(ok, 400 * (tentativa + 1)));
      return req<T>(metodo, caminho, corpo, tentativa + 1);
    }
    const texto = await r.text();
    let dados: Record<string, unknown> = {};
    try {
      dados = texto ? JSON.parse(texto) : {};
    } catch {
      dados = {};
    }
    if (!r.ok) {
      const erros = Array.isArray(dados.errors) ? (dados.errors as { code?: string; description?: string }[]) : [];
      throw new AsaasErro(r.status, erros, (dados.message as string) || undefined);
    }
    return dados as T;
  }

  const qs = (o: Record<string, string | number | boolean | undefined | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  return {
    ambiente,
    conta: () => req<{ name?: string; cpfCnpj?: string; email?: string; status?: string; personType?: string }>('GET', '/myAccount'),

    clientes: {
      criar: (d: { name: string; cpfCnpj: string; email?: string; mobilePhone?: string; externalReference?: string; notificationDisabled?: boolean }) =>
        req<{ id: string }>('POST', '/customers', d),
      porCpf: (cpfCnpj: string) => req<Lista<{ id: string; name: string; deleted?: boolean }>>('GET', `/customers${qs({ cpfCnpj })}`),
      obter: (id: string) => req<{ id: string; name: string; cpfCnpj?: string; email?: string; mobilePhone?: string }>('GET', `/customers/${id}`),
    },

    cobrancas: {
      criar: (d: Record<string, unknown>) => req<PagamentoAsaas>('POST', '/payments', d),
      obter: (id: string) => req<PagamentoAsaas>('GET', `/payments/${id}`),
      pix: (id: string) => req<{ encodedImage: string; payload: string; expirationDate?: string }>('GET', `/payments/${id}/pixQrCode`),
      estornar: (id: string, valor?: number, descricao?: string) =>
        req<PagamentoAsaas>('POST', `/payments/${id}/refund`, { ...(valor ? { value: valor } : {}), ...(descricao ? { description: descricao } : {}) }),
      cancelar: (id: string) => req<{ deleted: boolean; id: string }>('DELETE', `/payments/${id}`),
      recebidaEmDinheiro: (id: string, valor: number, data: string) =>
        req<PagamentoAsaas>('POST', `/payments/${id}/receiveInCash`, { paymentDate: data, value: valor, notifyCustomer: false }),
    },

    assinaturas: {
      criar: (d: Record<string, unknown>) => req<AssinaturaAsaas>('POST', '/subscriptions', d),
      obter: (id: string) => req<AssinaturaAsaas>('GET', `/subscriptions/${id}`),
      atualizar: (id: string, d: Record<string, unknown>) => req<AssinaturaAsaas>('PUT', `/subscriptions/${id}`, d),
      cancelar: (id: string) => req<{ deleted: boolean; id: string }>('DELETE', `/subscriptions/${id}`),
      cobrancas: (id: string) => req<Lista<PagamentoAsaas>>('GET', `/subscriptions/${id}/payments`),
      // Troca o cartão sem cobrar; as cobranças pendentes da assinatura também passam a usar o novo.
      trocarCartao: (id: string, d: Record<string, unknown>) => req<AssinaturaAsaas>('POST', `/subscriptions/${id}/updateCreditCard`, d),
    },

    links: {
      criar: (d: Record<string, unknown>) => req<{ id: string; url: string; active: boolean }>('POST', '/paymentLinks', d),
      atualizar: (id: string, d: Record<string, unknown>) => req<{ id: string; url: string; active: boolean }>('PUT', `/paymentLinks/${id}`, d),
      remover: (id: string) => req<{ deleted: boolean }>('DELETE', `/paymentLinks/${id}`),
      restaurar: (id: string) => req<{ id: string; url: string; active: boolean }>('POST', `/paymentLinks/${id}/restore`),
    },

    financeiro: {
      saldo: () => req<{ balance: number }>('GET', '/finance/balance'),
      estatisticas: (f: Record<string, string>) => req<{ quantity: number; value: number; netValue: number }>('GET', `/finance/payment/statistics${qs(f)}`),
      extrato: (inicio: string, fim: string, offset = 0, limit = 100) =>
        req<Lista<{ id: string; value: number; balance: number; type: string; date: string; description: string; paymentId?: string; transferId?: string }>>(
          'GET', `/financialTransactions${qs({ startDate: inicio, finishDate: fim, offset, limit, order: 'desc' })}`,
        ),
    },

    pixChaves: () => req<Lista<{ id: string; key: string; type: string; status: string }>>('GET', '/pix/addressKeys?status=ACTIVE'),

    webhooks: {
      listar: () => req<Lista<{ id: string; name: string; url: string; enabled: boolean; interrupted: boolean; penalizedRequestsCount?: number }>>('GET', '/webhooks'),
      criar: (d: Record<string, unknown>) => req<{ id: string }>('POST', '/webhooks', d),
      atualizar: (id: string, d: Record<string, unknown>) => req<{ id: string }>('PUT', `/webhooks/${id}`, d),
    },
  };
}

export type ClienteAsaas = ReturnType<typeof clienteAsaas>;

/** Eventos que o webhook do campo assina. */
export const EVENTOS_WEBHOOK = [
  'PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE',
  'PAYMENT_DELETED', 'PAYMENT_RESTORED', 'PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS', 'PAYMENT_RECEIVED_IN_CASH_UNDONE', 'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE', 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_APPROVED_BY_RISK_ANALYSIS', 'PAYMENT_AWAITING_RISK_ANALYSIS',
  'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_INACTIVATED', 'SUBSCRIPTION_DELETED',
];

/** Data de hoje no fuso de Brasília (AAAA-MM-DD), como o Asaas espera. */
export function hojeBR(somaDias = 0): string {
  const d = new Date(Date.now() + somaDias * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

export const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
