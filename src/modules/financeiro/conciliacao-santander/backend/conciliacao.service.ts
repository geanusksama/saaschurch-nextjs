import { prisma } from '@/lib/prisma'
import { isPastMonth } from '@/lib/helpers'
import { santanderAuthService } from '../services/santander/santander-auth.service'
import { santanderTransactionsService } from '../services/santander/santander-transactions.service'
import { santanderCredentialsRepo } from '../repositories/santander-credentials.repository'
import { santanderMovimentosRepo } from '../repositories/santander-movimentos.repository'
import { santanderConciliacoesRepo } from '../repositories/santander-conciliacoes.repository'
import { febraban240Parser } from '../services/febraban240/febraban240-parser.service'
import { febraban240Validator } from '../services/febraban240/febraban240-validator.service'
import { febraban240Mapper } from '../services/febraban240/febraban240-mapper.service'
import type {
  TransactionsQueryDto,
  TransactionsResponseDto,
  ConciliarDto,
  LancarNoLivroCaixaDto,
  LancarNoLivroCaixaResponseDto,
  MatchSugestao,
  SantanderMovimentoDto,
} from '../dtos/santander.dto'

// Orquestrador principal: conecta API Santander → banco local → Livro Caixa
// Esta classe é usada pelos API routes e nunca retorna secrets ao chamador

class ConciliacaoService {
  /** Consulta e importa extrato da API Santander */
  async importarTransacoes(
    query: TransactionsQueryDto,
    importedBy: string,
  ): Promise<TransactionsResponseDto> {
    const credential = await santanderCredentialsRepo.findFullById(query.credential_id)
    if (!credential) throw Object.assign(new Error('Credencial não encontrada'), { code: 'CREDENTIAL_NOT_FOUND' })

    // Buscar conta local
    const [account] = await prisma.$queryRaw<{ branch_code: string; account_number: string; account_id: string }[]>`
      SELECT branch_code, account_number, account_id
      FROM santander_accounts
      WHERE id = ${query.account_id}::uuid AND credential_id = ${query.credential_id}::uuid
    `
    if (!account) throw Object.assign(new Error('Conta não encontrada'), { code: 'SANTANDER_ACCOUNT_NOT_FOUND' })

    const logStart = new Date()
    const [syncLog] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO santander_sync_logs (credential_id, account_id, data_inicio, data_fim, status, source, created_by, started_at)
      VALUES (${query.credential_id}::uuid, ${account.account_id}, ${query.from}::date, ${query.to ?? new Date().toISOString().split('T')[0]}::date, 'parcial', 'api', ${importedBy}, ${logStart.toISOString()}::timestamptz)
      RETURNING id
    `

    let totalImportado = 0
    let totalDuplicado = 0
    let totalErro = 0

    try {
      const token = await santanderAuthService.getToken({
        id: credential.id as string,
        ambiente: credential.ambiente as 'sandbox' | 'producao',
        client_id: credential.client_id as string,
        client_secret_encrypted: credential.client_secret_encrypted as string,
        client_secret_iv: credential.client_secret_iv as string,
        certificate_public_path: credential.certificate_public_path as string,
        certificate_private_ref: credential.certificate_private_ref as string,
        certificate_expires_at: credential.certificate_expires_at ? new Date(credential.certificate_expires_at as string) : null,
      })

      const apiConfig = {
        ambiente: credential.ambiente as 'sandbox' | 'producao',
        accessToken: token,
        clientId: credential.client_id as string,
        certificatePublicPath: credential.certificate_public_path as string,
        certificatePrivateRef: credential.certificate_private_ref as string,
      }

      const to = query.to ?? new Date().toISOString().split('T')[0]
      // bank_id da credencial (0033 para Santander, CNPJ para Open Finance)
      const bankId = (credential.bank_id as string | undefined) ?? '0033'
      const movimentos = await santanderTransactionsService.getStatements(
        apiConfig,
        bankId,
        account.branch_code,
        account.account_number,
        account.account_id,   // accountId da API Santander (não nosso UUID)
        query.from,
        to,
      )

      const insertResult = await santanderMovimentosRepo.upsertMany(
        movimentos.map((mv) => ({
          credential_id: query.credential_id,
          santander_account_id: query.account_id,
          account_id: account.account_id,
          source: 'api' as const,
          imported_by: importedBy,
          movimento: mv,
        })),
      )

      totalImportado = insertResult.inserted
      totalDuplicado = insertResult.duplicated
      totalErro = insertResult.errors

      // Atualizar log
      await prisma.$executeRaw`
        UPDATE santander_sync_logs
        SET status = 'sucesso', total_importado = ${totalImportado},
            total_duplicado = ${totalDuplicado}, total_erro = ${totalErro},
            finished_at = now()
        WHERE id = ${syncLog.id}::uuid
      `
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await prisma.$executeRaw`
        UPDATE santander_sync_logs
        SET status = 'erro', error_message = ${msg}, finished_at = now()
        WHERE id = ${syncLog.id}::uuid
      `
      throw err
    }

    const { rows, total } = await santanderMovimentosRepo.findMany({
      santander_account_id: query.account_id,
      from: query.from,
      to: query.to ?? new Date().toISOString().split('T')[0],
      type: query.type,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    })

    const summary = await santanderMovimentosRepo.getSummary(
      query.account_id,
      query.from,
      query.to ?? new Date().toISOString().split('T')[0],
    )

    const page = query.page ?? 1
    const limit = query.limit ?? 50

    return {
      movimentos: rows as unknown as SantanderMovimentoDto[],
      summary: { ...summary, total_duplicado: totalDuplicado },
      pagination: { page, limit, total, hasMore: (page * limit) < total },
      sync_log_id: syncLog.id,
    }
  }

  /** Importa arquivo FEBRABAN 240 */
  async importarFebraban240(
    content: string,
    credentialId: string,
    accountId: string,
    importedBy: string,
    preview = false,
  ) {
    const parsed = febraban240Parser.parse(content)
    const validation = febraban240Validator.validate(parsed)

    if (!validation.valid) {
      throw Object.assign(
        new Error(`Arquivo FEBRABAN 240 inválido: ${validation.errors.join('; ')}`),
        { code: 'FEBRABAN_PARSE_ERROR' },
      )
    }

    const movimentos = febraban240Mapper.mapAll(parsed.lancamentos)

    if (preview) {
      return {
        total_registros: parsed.lancamentos.length,
        total_importado: 0,
        total_duplicado: 0,
        total_erro: 0,
        preview: true,
        movimentos: movimentos.slice(0, 10),
        warnings: validation.warnings,
      }
    }

    // Buscar account_id da API
    const [account] = await prisma.$queryRaw<{ account_id: string }[]>`
      SELECT account_id FROM santander_accounts WHERE id = ${accountId}::uuid
    `

    const insertResult = await santanderMovimentosRepo.upsertMany(
      movimentos.map((mv) => ({
        credential_id: credentialId,
        santander_account_id: accountId,
        account_id: account?.account_id ?? accountId,
        source: 'febraban' as const,
        imported_by: importedBy,
        movimento: mv,
      })),
    )

    return {
      total_registros: parsed.lancamentos.length,
      total_importado: insertResult.inserted,
      total_duplicado: insertResult.duplicated,
      total_erro: parsed.linhas_com_erro + insertResult.errors,
      preview: false,
      movimentos: [],
      warnings: validation.warnings,
    }
  }

  /** Gera sugestões de match automático para movimentos sem conciliação */
  async gerarSugestoes(
    santanderAccountId: string,
    churchId: string,
    from: string,
    to: string,
    toleranceDays: number,
  ): Promise<MatchSugestao[]> {
    const movimentos = await prisma.$queryRaw<SantanderMovimentoDto[]>`
      SELECT * FROM santander_movimentos
      WHERE santander_account_id = ${santanderAccountId}::uuid
        AND transaction_date BETWEEN ${from}::date AND ${to}::date
        AND status IN ('novo', 'sem_lancamento')
      ORDER BY transaction_date
    `

    const sugestoes: MatchSugestao[] = []

    for (const mv of movimentos) {
      const tipoLivro = mv.credit_debit_type === 'C' ? 'RECEITA' : 'DESPESA'

      const candidatos = await prisma.$queryRaw<{
        id: number
        data_lancamento: string
        valor: number
        tipo: string
        favorecido: string | null
        plano_de_contas: string | null
      }[]>`
        SELECT
          lc.id, lc.data_lancamento::text, lc.valor, lc.tipo,
          m.nome as favorecido,
          lc.plano_de_contas
        FROM livro_caixa lc
        LEFT JOIN members m ON m.id = lc.member_id
        WHERE lc.church_id = ${churchId}
          AND lc.tipo = ${tipoLivro}
          AND lc.valor = ${mv.amount}
          AND lc.data_lancamento BETWEEN (${mv.transaction_date}::date - ${toleranceDays} * INTERVAL '1 day')
                                     AND (${mv.transaction_date}::date + ${toleranceDays} * INTERVAL '1 day')
          AND lc.deleted_at IS NULL
        LIMIT 5
      `

      if (candidatos.length === 0) continue

      const scoredCandidates = candidatos.map((c) => {
        const diffDias = Math.abs(
          (new Date(c.data_lancamento).getTime() - new Date(mv.transaction_date).getTime()) / 86400000,
        )

        let score = 60
        if (diffDias === 0) score += 30
        else if (diffDias === 1) score += 15
        if (mv.document_number && c.favorecido?.includes(mv.document_number.slice(-4))) score += 10

        return {
          livro_caixa_id: c.id,
          data_lancamento: c.data_lancamento,
          valor: Number(c.valor),
          tipo: c.tipo,
          favorecido: c.favorecido,
          plano_de_conta: c.plano_de_contas,
          score: Math.min(score, 100),
          diferencaDias: diffDias,
        }
      })

      sugestoes.push({ movimento: mv, candidatos: scoredCandidates })
    }

    return sugestoes
  }

  /** Lança movimento Santander no Livro Caixa */
  async lancarNoLivroCaixa(
    data: LancarNoLivroCaixaDto,
    usuario: string,
  ): Promise<LancarNoLivroCaixaResponseDto> {
    const movimento = await santanderMovimentosRepo.findById(data.santander_movimento_id)
    if (!movimento) throw Object.assign(new Error('Movimento não encontrado'), { code: 'MOVIMENTO_NOT_FOUND' })

    const mv = movimento as Record<string, unknown>
    if (mv.status === 'lancado') throw Object.assign(new Error('Movimento já lançado'), { code: 'MOVIMENTO_ALREADY_LANCADO' })
    if (mv.status === 'ignorado') throw Object.assign(new Error('Movimento está ignorado'), { code: 'MOVIMENTO_IGNORADO' })

    // Verificar cash status
    const cashDate = mv.transaction_date as string
    const cashYear = cashDate.slice(0, 4)
    const cashMonth = cashDate.slice(5, 7)

    const [permanentRow] = await prisma.$queryRaw<{ permanent_open: boolean }[]>`
      SELECT cashbook_permanent_open AS permanent_open
      FROM churches
      WHERE id = ${data.church_id}::uuid
      LIMIT 1
    `
    const permanentOpen = Boolean(permanentRow?.permanent_open)
    const [cashStatus] = await prisma.$queryRaw<{ status: string; allow_until: Date | null }[]>`
      SELECT status, allow_until
      FROM church_cashbook_status
      WHERE church_id = ${data.church_id}::uuid
        AND reference_year = ${Number(cashYear)}::integer
        AND reference_month = ${Number(cashMonth)}::integer
      LIMIT 1
    `
    const defaultStatus = isPastMonth(Number(cashYear), Number(cashMonth)) ? "CLOSED" : "OPEN";
    const rawStatus = permanentOpen ? "OPEN" : String(cashStatus?.status || defaultStatus).toUpperCase();
    const allowUntil = cashStatus?.allow_until ? (typeof cashStatus.allow_until === "string" ? cashStatus.allow_until.slice(0, 10) : new Date(cashStatus.allow_until as unknown as string).toISOString().slice(0, 10)) : null;
    const canInsert = permanentOpen || rawStatus === "OPEN" || (allowUntil !== null && allowUntil >= cashDate);

    if (!canInsert) {
      throw Object.assign(new Error('Período do Livro Caixa fechado para esta igreja'), { code: 'CASH_STATUS_FECHADO' })
    }

    const tipo = (mv.credit_debit_type as string) === 'C' ? 'RECEITA' : 'DESPESA'
    const observacao = data.observacao
      ?? `Santander | ${mv.account_id} | ${mv.history_description ?? mv.transaction_name ?? ''}`

    // Inserir no Livro Caixa
    const [livroRow] = await prisma.$queryRaw<{ id: number }[]>`
      INSERT INTO livro_caixa (
        church_id, data_lancamento, valor, tipo, plano_de_contas,
        forma_pagamento, observacao, created_by
      ) VALUES (
        ${data.church_id},
        ${mv.transaction_date as string}::date,
        ${mv.amount as number},
        ${tipo},
        ${data.plano_de_conta},
        ${data.forma_pagamento ?? 'PIX'},
        ${observacao},
        ${usuario}
      )
      RETURNING id
    `

    await santanderMovimentosRepo.updateStatus(data.santander_movimento_id, 'lancado', livroRow.id)

    const conciliacaoId = await santanderConciliacoesRepo.create({
      santander_movimento_id: data.santander_movimento_id,
      livro_caixa_id: livroRow.id,
      tipo_match: 'automatico',
      score_match: 100,
      observacao: `Lançado via módulo Santander por ${usuario}`,
      conciliado_por: usuario,
    })

    return {
      livro_caixa_id: livroRow.id,
      santander_movimento_id: data.santander_movimento_id,
      conciliacao_id: conciliacaoId,
      message: 'Movimento lançado no Livro Caixa com sucesso',
    }
  }

  /** Concilia manualmente um movimento a um lançamento existente */
  async conciliar(data: ConciliarDto, usuario: string) {
    const movimento = await santanderMovimentosRepo.findById(data.santander_movimento_id)
    if (!movimento) throw Object.assign(new Error('Movimento não encontrado'), { code: 'MOVIMENTO_NOT_FOUND' })

    await santanderMovimentosRepo.updateStatus(data.santander_movimento_id, 'conciliado')

    const conciliacaoId = await santanderConciliacoesRepo.create({
      santander_movimento_id: data.santander_movimento_id,
      livro_caixa_id: data.livro_caixa_id,
      tipo_match: data.tipo_match,
      observacao: data.observacao,
      conciliado_por: usuario,
    })

    return {
      conciliacao_id: conciliacaoId,
      santander_movimento_id: data.santander_movimento_id,
      livro_caixa_id: data.livro_caixa_id,
      tipo_match: data.tipo_match,
      conciliado_por: usuario,
      conciliado_em: new Date().toISOString(),
    }
  }
}

export const conciliacaoService = new ConciliacaoService()
