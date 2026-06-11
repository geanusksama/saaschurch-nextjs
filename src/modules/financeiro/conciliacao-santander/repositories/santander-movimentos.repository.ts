import { prisma } from '@/lib/prisma'
import type { SantanderApiMovimento, SantanderMovimentoStatus } from '../dtos/santander.dto'
import { santanderTransactionsService } from '../services/santander/santander-transactions.service'

export interface InsertMovimentoData {
  credential_id: string
  santander_account_id: string
  account_id: string
  source: 'api' | 'febraban' | 'importacao'
  imported_by?: string
  movimento: SantanderApiMovimento
}

export interface InsertResult {
  inserted: number
  duplicated: number
  errors: number
  ids: string[]
}

export interface MovimentoFilter {
  santander_account_id: string
  from: string
  to: string
  type?: 'all' | 'credit' | 'debit' | 'pix'
  status?: SantanderMovimentoStatus
  page?: number
  limit?: number
}

class SantanderMovimentosRepository {
  async upsertMany(items: InsertMovimentoData[]): Promise<InsertResult> {
    const result: InsertResult = { inserted: 0, duplicated: 0, errors: 0, ids: [] }

    for (const item of items) {
      try {
        const mv = item.movimento
        const hash = santanderTransactionsService.generateHash(
          item.account_id,
          mv.transactionDate,
          mv.amount,
          mv.creditDebitType,
          mv.documentNumber,
          mv.historyCode,
        )

        // Verificar se já existe pelo hash único
        const existing = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM santander_movimentos WHERE hash_unico = ${hash} LIMIT 1
        `

        if (existing.length > 0) {
          result.duplicated++
          continue
        }

        const [inserted] = await prisma.$queryRaw<{ id: string }[]>`
          INSERT INTO santander_movimentos (
            credential_id, santander_account_id, account_id,
            transaction_date, accounting_date,
            amount, credit_debit_type,
            transaction_name, category_code, history_code,
            history_description, document_number, complement,
            raw_payload, source, status, hash_unico, imported_by
          ) VALUES (
            ${item.credential_id}::uuid, ${item.santander_account_id}::uuid, ${item.account_id},
            ${mv.transactionDate}::date, ${mv.accountingDate ?? null}::date,
            ${mv.amount}, ${mv.creditDebitType},
            ${mv.transactionName ?? null}, ${mv.categoryCode ?? null}, ${mv.historyCode ?? null},
            ${mv.historyDescription ?? null}, ${mv.documentNumber ?? null}, ${mv.complement ?? null},
            ${JSON.stringify(mv.rawPayload ?? {})}::jsonb,
            ${item.source}, 'novo', ${hash}, ${item.imported_by ?? null}
          )
          RETURNING id
        `

        result.inserted++
        result.ids.push(inserted.id)
      } catch {
        result.errors++
      }
    }

    return result
  }

  async findMany(filter: MovimentoFilter) {
    const page = filter.page ?? 1
    const limit = Math.min(filter.limit ?? 50, 100)
    const offset = (page - 1) * limit

    const typeFilter  = filter.type === 'credit' ? "AND credit_debit_type = 'C'"
                      : filter.type === 'debit'  ? "AND credit_debit_type = 'D'"
                      : filter.type === 'pix'    ? "AND raw_payload->>'type' = 'PIX'"
                      : ''
    const statusFilter = filter.status ? `AND status = '${filter.status}'` : ''

    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT *
      FROM santander_movimentos
      WHERE santander_account_id = '${filter.santander_account_id}'::uuid
        AND transaction_date BETWEEN '${filter.from}'::date AND '${filter.to}'::date
        ${typeFilter}
        ${statusFilter}
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `)

    const [{ count }] = await prisma.$queryRawUnsafe<{ count: string }[]>(`
      SELECT COUNT(*)::text as count
      FROM santander_movimentos
      WHERE santander_account_id = '${filter.santander_account_id}'::uuid
        AND transaction_date BETWEEN '${filter.from}'::date AND '${filter.to}'::date
        ${typeFilter}
        ${statusFilter}
    `)

    return { rows, total: parseInt(count, 10) }
  }

  async getSummary(santander_account_id: string, from: string, to: string) {
    const [row] = await prisma.$queryRaw<{
      total_credito: string
      total_debito: string
      total_novo: string
      total_conciliado: string
      total_lancado: string
      total_ignorado: string
    }[]>`
      SELECT
        COALESCE(SUM(CASE WHEN credit_debit_type = 'C' THEN amount ELSE 0 END), 0)::text as total_credito,
        COALESCE(SUM(CASE WHEN credit_debit_type = 'D' THEN amount ELSE 0 END), 0)::text as total_debito,
        COUNT(CASE WHEN status = 'novo' THEN 1 END)::text as total_novo,
        COUNT(CASE WHEN status IN ('match_exato','match_sugerido','conciliado') THEN 1 END)::text as total_conciliado,
        COUNT(CASE WHEN status = 'lancado' THEN 1 END)::text as total_lancado,
        COUNT(CASE WHEN status = 'ignorado' THEN 1 END)::text as total_ignorado
      FROM santander_movimentos
      WHERE santander_account_id = ${santander_account_id}::uuid
        AND transaction_date BETWEEN ${from}::date AND ${to}::date
    `

    const totalCredito = parseFloat(row.total_credito)
    const totalDebito = parseFloat(row.total_debito)

    return {
      total_credito: totalCredito,
      total_debito: totalDebito,
      saldo_periodo: totalCredito - totalDebito,
      total_novo: parseInt(row.total_novo, 10),
      total_duplicado: 0,
      total_conciliado: parseInt(row.total_conciliado, 10),
      total_lancado: parseInt(row.total_lancado, 10),
      total_ignorado: parseInt(row.total_ignorado, 10),
    }
  }

  async updateStatus(id: string, status: SantanderMovimentoStatus, livro_caixa_id?: number) {
    await prisma.$executeRaw`
      UPDATE santander_movimentos
      SET status = ${status},
          livro_caixa_id = ${livro_caixa_id ?? null},
          updated_at = now()
      WHERE id = ${id}::uuid
    `
  }

  async findById(id: string) {
    const [row] = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM santander_movimentos WHERE id = ${id}::uuid
    `
    return row ?? null
  }
}

export const santanderMovimentosRepo = new SantanderMovimentosRepository()
