import { febraban240Parser } from '../services/febraban240/febraban240-parser.service'
import { febraban240Validator } from '../services/febraban240/febraban240-validator.service'
import { febraban240Mapper } from '../services/febraban240/febraban240-mapper.service'

// Linha de header de arquivo (tipo 0) mock — 240 chars
const MOCK_HEADER = '033' + '0000' + '0' + ' '.repeat(9) + '2' + '90400888000142' + '12345678901234567890' + '00011' + ' ' + '000010331607' + '0' + ' ' + 'EMPRESA TESTE LTDA             ' + 'SANTANDER BANESPA              ' + '          ' + '2' + '10062026' + '120000' + '000001' + '090' + '01600' + ' '.repeat(20) + ' '.repeat(20) + ' '.repeat(29)

// Linha de detalhe (tipo 3, segmento E) mock — 240 chars
function mockLancamento(tipo: 'C' | 'D', valor: string, data: string, categoria: string) {
  const banco = '033'
  const lote = '0002'
  const tipoReg = '3'
  const seq = '00001'
  const segmento = 'E'
  const uso1 = '   '
  const tipoInsc = '2'
  const cnpj = '90400888000142'
  const convenio = '12345678901234567890'
  const agencia = '00011'
  const agenciaDv = '0'
  const conta = '000010331607'
  const contaDv = '7'
  const dvAgConta = ' '
  const nomeEmpresa = 'EMPRESA TESTE LTDA             '
  const uso2 = '      '
  const natura = 'CDS'
  const tipoComp = '00'
  const complemento = '                    '
  const isenção = 'S'
  const dataContabil = data
  const dataLanc = data
  const valorStr = valor.padStart(18, '0')
  const tipoLanc = tipo
  const cat = categoria.padStart(3, '0')
  const codHist = '0001'
  const descHist = 'PIX RECEBIDO             '
  const numDoc = '123456'
  const compHist = 'COMPLEMENTO              '
  const hora = '120000'
  const usoFinal = '  '

  const linha = banco + lote + tipoReg + seq + segmento + uso1 + tipoInsc + cnpj + convenio + agencia + agenciaDv + conta + contaDv + dvAgConta + nomeEmpresa + uso2 + natura + tipoComp + complemento + isenção + dataContabil + dataLanc + valorStr + tipoLanc + cat + codHist + descHist + numDoc + compHist + hora + usoFinal
  return linha.padEnd(240, ' ').slice(0, 240)
}

const MOCK_HEADER_LOTE = '033' + '0001' + '1' + 'E' + '04' + '40' + '033' + ' ' + '2' + '90400888000142' + '12345678901234567890' + '00011' + ' ' + '000010331607' + '7' + ' ' + 'EMPRESA TESTE LTDA             ' + ' '.repeat(40) + '10062026' + '000000001500000000' + 'C' + 'F' + 'BRL' + '00001' + '000000000000000000' + '000000000000000000' + ' '.repeat(26)

describe('Febraban240Parser', () => {
  it('deve parsear valor FEBRABAN corretamente', () => {
    expect(febraban240Parser.parseValor('000000000000001500')).toBe(15.0)
    expect(febraban240Parser.parseValor('000000000012345678')).toBe(123456.78)
    expect(febraban240Parser.parseValor('000000000000000001')).toBe(0.01)
  })

  it('deve parsear data FEBRABAN (DDMMAAAA) para ISO (YYYY-MM-DD)', () => {
    expect(febraban240Parser.parseData('10062026')).toBe('2026-06-10')
    expect(febraban240Parser.parseData('01012024')).toBe('2024-01-01')
    expect(febraban240Parser.parseData('00000000')).toBeNull()
  })

  it('deve parsear uma linha de lançamento', () => {
    const linha = mockLancamento('C', '000000000000150000', '10062026', '218')
    const result = febraban240Parser.parse(linha)
    expect(result.lancamentos).toHaveLength(1)
    const l = result.lancamentos[0]
    expect(l.tipo).toBe('C')
    expect(l.data_lancamento).toBe('10062026')
    expect(l.categoria).toBe('218')
  })

  it('deve contar erros para linhas com comprimento incorreto', () => {
    const resultado = febraban240Parser.parse('linha curta\n')
    expect(resultado.linhas_com_erro).toBeGreaterThanOrEqual(1)
  })
})

describe('Febraban240Validator', () => {
  it('deve aceitar arquivo válido com banco 033', () => {
    const linha = mockLancamento('C', '000000000000150000', '10062026', '218')
    const parsed = febraban240Parser.parse(
      MOCK_HEADER.padEnd(240, ' ').slice(0, 240) + '\n' +
      MOCK_HEADER_LOTE.padEnd(240, ' ').slice(0, 240) + '\n' +
      linha
    )
    const result = febraban240Validator.validate(parsed)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('deve rejeitar arquivo sem header', () => {
    const parsed = febraban240Parser.parse('')
    const result = febraban240Validator.validate(parsed)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Header de arquivo'))).toBe(true)
  })
})

describe('Febraban240Mapper', () => {
  it('deve mapear lançamento de crédito corretamente', () => {
    const linha = mockLancamento('C', '000000000000500000', '10062026', '218')
    const parsed = febraban240Parser.parse(linha)
    const lancamento = parsed.lancamentos[0]
    const mapped = febraban240Mapper.mapLancamento(lancamento)

    expect(mapped.creditDebitType).toBe('C')
    expect(mapped.amount).toBe(5000.0)
    expect(mapped.transactionDate).toBe('2026-06-10')
    expect(mapped.categoryCode).toBe('218')
  })

  it('deve mapear lançamento de débito corretamente', () => {
    const linha = mockLancamento('D', '000000000000120000', '05062026', '112')
    const parsed = febraban240Parser.parse(linha)
    const mapped = febraban240Mapper.mapLancamento(parsed.lancamentos[0])

    expect(mapped.creditDebitType).toBe('D')
    expect(mapped.amount).toBe(1200.0)
    expect(mapped.categoryCode).toBe('112')
  })
})
