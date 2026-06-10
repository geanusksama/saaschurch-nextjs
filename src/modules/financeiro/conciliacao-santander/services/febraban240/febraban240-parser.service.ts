// Parser do layout FEBRABAN 240 posições — Santander Conta Max Versão 9.0
// Fonte: Santander - Layout Febraban 240 9.0 Conta Max.pdf
//
// Estrutura do arquivo:
//   Linha tipo 0: Header de Arquivo
//   Linha tipo 1: Header de Lote
//   Linha tipo 3: Detalhe de Lançamento (Segmento E)
//   Linha tipo 5: Trailer de Lote
//   Linha tipo 9: Trailer de Arquivo

export interface Febraban240Header {
  banco: string              // pos 001-003 = "033"
  empresa_cnpj: string       // pos 019-032
  empresa_nome: string       // pos 073-102
  data_geracao: string       // pos 144-151 (DDMMAAAA)
  hora_geracao: string       // pos 152-157 (HHMMSS)
  versao_layout: string      // pos 164-166 = "090"
}

export interface Febraban240LoteHeader {
  banco: string              // pos 001-003 = "033"
  agencia: string            // pos 053-057
  conta: string              // pos 059-070
  digito_conta: string       // pos 071-071
  empresa_nome: string       // pos 073-102
  data_saldo_inicial: string // pos 143-150 (DDMMAAAA)
  saldo_inicial: string      // pos 151-168 (valor com 2 casas implícitas)
  situacao_saldo: string     // pos 169 ('D'=Devedor, 'C'=Credor)
}

export interface Febraban240Lancamento {
  banco: string              // pos 001-003 = "033"
  agencia: string            // pos 053-057
  agencia_dv: string         // pos 058-058
  conta: string              // pos 059-070
  conta_dv: string           // pos 071-071
  empresa_nome: string       // pos 073-102
  data_contabil: string      // pos 135-142 (DDMMAAAA)
  data_lancamento: string    // pos 143-150 (DDMMAAAA)
  valor_raw: string          // pos 151-168 (18 chars, 2 decimais implícitos)
  tipo: 'D' | 'C'            // pos 169 ('D'=Débito, 'C'=Crédito)
  categoria: string          // pos 170-172 (código categoria FEBRABAN)
  codigo_historico: string   // pos 173-176
  descricao_historico: string // pos 177-201
  numero_documento: string   // pos 202-207
  complemento: string        // pos 208-232
  hora: string               // pos 233-238 (HHMMSS)
}

export interface Febraban240ParseResult {
  header: Febraban240Header | null
  lote_header: Febraban240LoteHeader | null
  lancamentos: Febraban240Lancamento[]
  total_linhas: number
  linhas_com_erro: number
  erros: string[]
}

class Febraban240Parser {
  parse(content: string): Febraban240ParseResult {
    const linhas = content.split('\n').map((l) => l.replace(/\r$/, ''))
    const result: Febraban240ParseResult = {
      header: null,
      lote_header: null,
      lancamentos: [],
      total_linhas: linhas.length,
      linhas_com_erro: 0,
      erros: [],
    }

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i]
      if (linha.length < 240 && linha.trim() === '') continue

      if (linha.length < 240) {
        result.linhas_com_erro++
        result.erros.push(`Linha ${i + 1}: comprimento inválido (${linha.length} chars, esperado 240)`)
        continue
      }

      const tipo = linha[7] // posição 008 (0-indexed: 7)

      try {
        switch (tipo) {
          case '0': result.header = this.parseHeader(linha); break
          case '1': result.lote_header = this.parseLoteHeader(linha); break
          case '3': result.lancamentos.push(this.parseLancamento(linha)); break
          case '5': break // Trailer de lote — não precisa de dados
          case '9': break // Trailer de arquivo — não precisa de dados
          default:
            result.erros.push(`Linha ${i + 1}: tipo de registro desconhecido '${tipo}'`)
        }
      } catch (err) {
        result.linhas_com_erro++
        result.erros.push(`Linha ${i + 1}: ${String(err)}`)
      }
    }

    return result
  }

  private col(linha: string, from: number, to: number): string {
    // FEBRABAN usa posições 1-based, substring usa 0-based
    return linha.substring(from - 1, to).trim()
  }

  private parseHeader(linha: string): Febraban240Header {
    return {
      banco: this.col(linha, 1, 3),
      empresa_cnpj: this.col(linha, 19, 32),
      empresa_nome: this.col(linha, 73, 102),
      data_geracao: this.col(linha, 144, 151),
      hora_geracao: this.col(linha, 152, 157),
      versao_layout: this.col(linha, 164, 166),
    }
  }

  private parseLoteHeader(linha: string): Febraban240LoteHeader {
    return {
      banco: this.col(linha, 1, 3),
      agencia: this.col(linha, 53, 57),
      conta: this.col(linha, 59, 70),
      digito_conta: this.col(linha, 71, 71),
      empresa_nome: this.col(linha, 73, 102),
      data_saldo_inicial: this.col(linha, 143, 150),
      saldo_inicial: this.col(linha, 151, 168),
      situacao_saldo: this.col(linha, 169, 169),
    }
  }

  private parseLancamento(linha: string): Febraban240Lancamento {
    const tipo = this.col(linha, 169, 169) as 'D' | 'C'

    return {
      banco: this.col(linha, 1, 3),
      agencia: this.col(linha, 53, 57),
      agencia_dv: this.col(linha, 58, 58),
      conta: this.col(linha, 59, 70),
      conta_dv: this.col(linha, 71, 71),
      empresa_nome: this.col(linha, 73, 102),
      data_contabil: this.col(linha, 135, 142),
      data_lancamento: this.col(linha, 143, 150),
      valor_raw: this.col(linha, 151, 168),
      tipo,
      categoria: this.col(linha, 170, 172),
      codigo_historico: this.col(linha, 173, 176),
      descricao_historico: this.col(linha, 177, 201),
      numero_documento: this.col(linha, 202, 207),
      complemento: this.col(linha, 208, 232),
      hora: this.col(linha, 233, 238),
    }
  }

  /** Converte valor FEBRABAN (18 chars, 2 casas implícitas) para número decimal */
  parseValor(valorRaw: string): number {
    const digits = valorRaw.replace(/\D/g, '').padStart(3, '0')
    const intPart = digits.slice(0, -2) || '0'
    const decPart = digits.slice(-2)
    return parseFloat(`${intPart}.${decPart}`)
  }

  /** Converte data FEBRABAN (DDMMAAAA) para ISO (YYYY-MM-DD) */
  parseData(ddmmaaaa: string): string | null {
    if (!ddmmaaaa || ddmmaaaa.trim() === '00000000') return null
    const d = ddmmaaaa.padStart(8, '0')
    const day = d.slice(0, 2)
    const month = d.slice(2, 4)
    const year = d.slice(4, 8)
    return `${year}-${month}-${day}`
  }
}

export const febraban240Parser = new Febraban240Parser()
