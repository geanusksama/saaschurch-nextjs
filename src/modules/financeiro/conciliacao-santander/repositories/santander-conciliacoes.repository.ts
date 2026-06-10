import { prisma } from '@/lib/prisma'
import type { SantanderConciliacaoTipo } from '../dtos/santander.dto'

class SantanderConciliacoesRepository {
  async create(data: {
    santander_movimento_id: string
    livro_caixa_id: number
    tipo_match: SantanderConciliacaoTipo
    score_match?: number
    observacao?: string
    conciliado_por: string
  }) {
    const [row] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO santander_conciliacoes (
        santander_movimento_id, livro_caixa_id, tipo_match,
        score_match, observacao, conciliado_por
      ) VALUES (
        ${data.santander_movimento_id}::uuid, ${data.livro_caixa_id},
        ${data.tipo_match}, ${data.score_match ?? null},
        ${data.observacao ?? null}, ${data.conciliado_por}
      )
      RETURNING id
    `
    return row.id
  }

  async desfazer(id: string, usuario: string) {
    await prisma.$executeRaw`
      UPDATE santander_conciliacoes
      SET status = 'desfeito'
      WHERE id = ${id}::uuid AND status = 'ativo'
    `

    // Reverter status do movimento para 'sem_lancamento'
    await prisma.$executeRaw`
      UPDATE santander_movimentos sm
      SET status = 'sem_lancamento', livro_caixa_id = NULL, updated_at = now()
      FROM santander_conciliacoes sc
      WHERE sc.id = ${id}::uuid
        AND sc.santander_movimento_id = sm.id
    `
  }

  async findActiveBySantanderMovimento(santander_movimento_id: string) {
    const [row] = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM santander_conciliacoes
      WHERE santander_movimento_id = ${santander_movimento_id}::uuid
        AND status = 'ativo'
    `
    return row ?? null
  }
}

export const santanderConciliacoesRepo = new SantanderConciliacoesRepository()
