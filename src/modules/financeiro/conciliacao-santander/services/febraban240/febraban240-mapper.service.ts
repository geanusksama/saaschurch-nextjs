import { febraban240Parser, type Febraban240Lancamento } from './febraban240-parser.service'
import type { SantanderApiMovimento } from '../../dtos/santander.dto'

// Mapeia lançamentos do layout FEBRABAN 240 para o DTO padrão do módulo Santander
// Categorias FEBRABAN: 101-127 = débitos, 201-222 = créditos

export const FEBRABAN_CATEGORY_NAMES: Record<string, string> = {
  // Débitos
  '101': 'Cheque Compensado',
  '102': 'Encargos',
  '103': 'Estornos',
  '104': 'Lançamento Avisado',
  '105': 'Tarifas',
  '106': 'Aplicação',
  '107': 'Empréstimo / Financiamento',
  '108': 'Câmbio',
  '109': 'CPMF',
  '110': 'IOF',
  '111': 'Imposto de Renda',
  '112': 'Pagamento Fornecedores',
  '113': 'Pagamentos Salário',
  '114': 'Saque Eletrônico',
  '115': 'Ações',
  '117': 'Transferência entre Contas',
  '118': 'Devolução da Compensação',
  '119': 'Devolução de Cheque Depositado',
  '120': 'Transferência Interbancária (DOC, TED)',
  '121': 'Antecipação a Fornecedores',
  '122': 'OC / AEROPS',
  '123': 'Saque em Espécie',
  '124': 'Cheque Pago',
  '125': 'Pagamentos Diversos',
  '126': 'Pagamento de Tributos',
  '127': 'Cartão de Crédito - Pagamento de Fatura',
  // Créditos
  '201': 'Depósito em Cheque',
  '202': 'Crédito de Cobrança',
  '203': 'Devolução de Cheques',
  '204': 'Estornos',
  '205': 'Lançamento Avisado',
  '206': 'Resgate de Aplicação',
  '207': 'Empréstimo / Financiamento',
  '208': 'Câmbio',
  '209': 'Transferência Interbancária (DOC, TED)',
  '210': 'Ações',
  '211': 'Dividendos',
  '212': 'Seguro',
  '213': 'Transferência entre Contas',
  '214': 'Depósitos Especiais',
  '215': 'Devolução da Compensação',
  '216': 'OCT',
  '217': 'Pagamentos Fornecedores',
  '218': 'Pagamentos Diversos',
  '219': 'Recebimento de Salário',
  '220': 'Depósito em Espécie',
  '221': 'Pagamento de Tributos',
  '222': 'Cartão de Crédito - Recebíveis',
}

class Febraban240Mapper {
  mapLancamento(l: Febraban240Lancamento): SantanderApiMovimento {
    const amount = febraban240Parser.parseValor(l.valor_raw)
    const transactionDate = febraban240Parser.parseData(l.data_lancamento) ?? new Date().toISOString().split('T')[0]
    const accountingDate = febraban240Parser.parseData(l.data_contabil) ?? undefined

    const categoryName = FEBRABAN_CATEGORY_NAMES[l.categoria] ?? `Categoria ${l.categoria}`

    return {
      transactionDate,
      accountingDate,
      amount,
      creditDebitType: l.tipo,
      transactionName: l.descricao_historico || categoryName,
      categoryCode: l.categoria || undefined,
      historyCode: l.codigo_historico || undefined,
      historyDescription: l.descricao_historico || undefined,
      documentNumber: l.numero_documento || undefined,
      complement: l.complemento || undefined,
      rawPayload: {
        source: 'febraban240',
        agencia: l.agencia,
        conta: l.conta,
        data_contabil: l.data_contabil,
        hora: l.hora,
      },
    }
  }

  mapAll(lancamentos: Febraban240Lancamento[]): SantanderApiMovimento[] {
    return lancamentos.map((l) => this.mapLancamento(l))
  }
}

export const febraban240Mapper = new Febraban240Mapper()
