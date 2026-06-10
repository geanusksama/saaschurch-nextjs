import type { Febraban240ParseResult } from './febraban240-parser.service'

// Valida estrutura e integridade de arquivo FEBRABAN 240 Santander

export interface Febraban240ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

class Febraban240Validator {
  validate(result: Febraban240ParseResult, expectedBankCode = '033'): Febraban240ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!result.header) {
      errors.push('Header de arquivo ausente (tipo 0)')
    } else {
      if (result.header.banco !== expectedBankCode) {
        errors.push(`Banco inválido no header: esperado ${expectedBankCode}, encontrado ${result.header.banco}`)
      }
      if (result.header.versao_layout !== '090') {
        warnings.push(`Versão do layout: ${result.header.versao_layout} (esperado 090)`)
      }
    }

    if (!result.lote_header) {
      errors.push('Header de lote ausente (tipo 1)')
    } else {
      if (result.lote_header.banco !== expectedBankCode) {
        errors.push(`Banco inválido no header de lote: ${result.lote_header.banco}`)
      }
      if (!result.lote_header.agencia || result.lote_header.agencia.length === 0) {
        errors.push('Agência ausente no header de lote')
      }
      if (!result.lote_header.conta || result.lote_header.conta.length === 0) {
        errors.push('Conta ausente no header de lote')
      }
    }

    if (result.lancamentos.length === 0) {
      warnings.push('Nenhum lançamento encontrado no arquivo')
    }

    for (let i = 0; i < result.lancamentos.length; i++) {
      const l = result.lancamentos[i]

      if (!['C', 'D'].includes(l.tipo)) {
        errors.push(`Lançamento ${i + 1}: tipo inválido '${l.tipo}' (esperado C ou D)`)
      }

      const valor = parseFloat(l.valor_raw.replace(/\D/g, '').padStart(3, '0').slice(0, -2) + '.' + l.valor_raw.slice(-2))
      if (isNaN(valor) || valor <= 0) {
        errors.push(`Lançamento ${i + 1}: valor inválido '${l.valor_raw}'`)
      }

      if (!l.data_lancamento || l.data_lancamento.trim() === '00000000') {
        errors.push(`Lançamento ${i + 1}: data de lançamento inválida`)
      }

      if (result.header && l.banco !== result.header.banco) {
        warnings.push(`Lançamento ${i + 1}: banco do detalhe (${l.banco}) difere do header`)
      }
    }

    if (result.linhas_com_erro > 0) {
      warnings.push(`${result.linhas_com_erro} linha(s) com erro de parsing ignorada(s)`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }
}

export const febraban240Validator = new Febraban240Validator()
