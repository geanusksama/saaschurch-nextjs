import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { escopoDeIgrejas } from "@/lib/contasPagarScope";
import { NAO_INFORMADO } from "@/lib/contasPagarRules";

/**
 * GET /api/contas-pagar/relatorios — tudo o que a aba 2 da tela desenha.
 *
 * As agregações rodam no Postgres, não no cliente: a tesouraria filtra períodos
 * longos e trazer parcela por parcela para somar no navegador não escala.
 *
 * Filtros aceitos: churchId/regionalId/campoId, vencimentoDe, vencimentoAte,
 * credorId, planoDeContaId, departamentoId, status.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams;

    const escopo = escopoDeIgrejas(user, {
      churchId: sp.get("churchId") ?? undefined,
      regionalId: sp.get("regionalId") ?? undefined,
      campoId: sp.get("campoId") ?? undefined,
    });
    if (!escopo.ok) return NextResponse.json({ error: escopo.erro }, { status: 403 });

    const igrejas = await prisma.church.findMany({ where: escopo.churchWhere, select: { id: true } });
    if (!igrejas.length) return NextResponse.json(relatorioVazio());
    const churchIds = Prisma.join(igrejas.map((c) => Prisma.sql`${c.id}::uuid`));

    // Todas as consultas partem do mesmo FROM, com os LEFT JOINs já dentro —
    // assim cada agregação só troca o SELECT/GROUP BY.
    const origem = Prisma.sql`
      FROM parcelas_contas_pagar p
      JOIN contas_pagar c        ON c.id = p.conta_pagar_id
      LEFT JOIN plano_de_contas pc ON pc.id = c.plano_de_conta_id
      LEFT JOIN departamentos d  ON d.id = c.departamento_id
      LEFT JOIN credores cr      ON cr.id = c.credor_id
    `;

    // Fragmentos parametrizados — nada vindo do cliente vira texto de SQL.
    const cond: Prisma.Sql[] = [
      Prisma.sql`p.church_id IN (${churchIds})`,
      Prisma.sql`c.deleted_at IS NULL`,
      Prisma.sql`p.status <> 'CANCELADA'`,
    ];
    const vencDe = sp.get("vencimentoDe");
    const vencAte = sp.get("vencimentoAte");
    if (vencDe) cond.push(Prisma.sql`p.data_vencimento >= ${vencDe}::date`);
    if (vencAte) cond.push(Prisma.sql`p.data_vencimento <= ${vencAte}::date`);
    const credorId = sp.get("credorId");
    if (credorId) cond.push(Prisma.sql`c.credor_id = ${credorId}::uuid`);
    const planoDeContaId = sp.get("planoDeContaId");
    if (planoDeContaId) cond.push(Prisma.sql`c.plano_de_conta_id = ${planoDeContaId}::uuid`);
    const departamentoId = sp.get("departamentoId");
    if (departamentoId) {
      cond.push(
        departamentoId === "sem"
          ? Prisma.sql`c.departamento_id IS NULL`
          : Prisma.sql`c.departamento_id = ${departamentoId}::uuid`
      );
    }
    const status = sp.get("status");
    if (status) {
      const lista = Prisma.join(status.split(",").filter(Boolean).map((s) => Prisma.sql`${s}`));
      cond.push(Prisma.sql`p.status IN (${lista})`);
    }
    const filtro = Prisma.join(cond, " AND ");

    const [porStatus, porTipo, porDepartamento, projecao, saldoResidual, evolucao, totais] =
      await Promise.all([
        prisma.$queryRaw`
          SELECT p.status,
                 COUNT(*)::int                 AS quantidade,
                 SUM(p.valor_parcela)::numeric AS valor,
                 SUM(p.valor_saldo)::numeric   AS saldo
          ${origem}
          WHERE ${filtro}
          GROUP BY p.status
          ORDER BY valor DESC
        `,
        prisma.$queryRaw`
          SELECT pc.id                                AS id,
                 COALESCE(pc.nome, ${NAO_INFORMADO})  AS nome,
                 COUNT(*)::int                        AS quantidade,
                 SUM(p.valor_parcela)::numeric        AS valor,
                 SUM(p.valor_pago)::numeric           AS pago,
                 SUM(p.valor_saldo)::numeric          AS saldo
          ${origem}
          WHERE ${filtro}
          GROUP BY pc.id, pc.nome
          ORDER BY valor DESC
          LIMIT 15
        `,
        prisma.$queryRaw`
          SELECT d.id                               AS id,
                 COALESCE(d.nome, ${NAO_INFORMADO}) AS nome,
                 d.cor                              AS cor,
                 COUNT(*)::int                      AS quantidade,
                 SUM(p.valor_parcela)::numeric      AS valor,
                 SUM(p.valor_pago)::numeric         AS pago,
                 SUM(p.valor_saldo)::numeric        AS saldo
          ${origem}
          WHERE ${filtro}
          GROUP BY d.id, d.nome, d.cor
          ORDER BY valor DESC
          LIMIT 15
        `,
        // Fluxo projetado: o que ainda se deve, por mês de vencimento,
        // separando o que já venceu do que está por vencer.
        prisma.$queryRaw`
          SELECT to_char(date_trunc('month', p.data_vencimento), 'YYYY-MM') AS mes,
                 COALESCE(SUM(p.valor_saldo) FILTER (WHERE p.data_vencimento <  CURRENT_DATE), 0)::numeric AS vencido,
                 COALESCE(SUM(p.valor_saldo) FILTER (WHERE p.data_vencimento >= CURRENT_DATE), 0)::numeric AS a_vencer,
                 SUM(p.valor_saldo)::numeric AS saldo
          ${origem}
          WHERE ${filtro} AND p.valor_saldo > 0
          GROUP BY 1
          ORDER BY 1
          LIMIT 24
        `,
        // Saldo residual: parcela que já recebeu algo e ainda deve — é o
        // relatório do pagamento parcial (o caso do pastor).
        prisma.$queryRaw`
          SELECT p.id, p.numero_parcela, p.total_parcelas, p.data_vencimento,
                 p.valor_parcela::numeric, p.valor_pago::numeric, p.valor_saldo::numeric, p.status,
                 c.id AS conta_id, c.numero AS conta_numero, c.descricao,
                 cr.nome AS credor_nome,
                 (CURRENT_DATE - p.data_vencimento)::int AS dias_em_aberto
          ${origem}
          WHERE ${filtro} AND p.valor_saldo > 0 AND p.valor_pago > 0
          ORDER BY dias_em_aberto DESC
          LIMIT 200
        `,
        // Previsto (por vencimento) × pago (por data do pagamento).
        prisma.$queryRaw`
          SELECT mes, SUM(previsto)::numeric AS previsto, SUM(pago)::numeric AS pago
          FROM (
            SELECT to_char(date_trunc('month', p.data_vencimento), 'YYYY-MM') AS mes,
                   p.valor_parcela AS previsto,
                   0::numeric      AS pago
            ${origem}
            WHERE ${filtro}
            UNION ALL
            SELECT to_char(date_trunc('month', pg.data_pagamento), 'YYYY-MM') AS mes,
                   0::numeric    AS previsto,
                   pg.valor_pago AS pago
            ${origem}
            JOIN pagamentos_parcela pg ON pg.parcela_id = p.id
            WHERE ${filtro} AND pg.estornado_em IS NULL
          ) t
          GROUP BY mes
          ORDER BY mes DESC
          LIMIT 18
        `,
        prisma.$queryRaw`
          SELECT COUNT(*)::int             AS parcelas,
                 COUNT(DISTINCT c.id)::int AS contas,
                 COALESCE(SUM(p.valor_parcela), 0)::numeric AS total,
                 COALESCE(SUM(p.valor_pago), 0)::numeric    AS pago,
                 COALESCE(SUM(p.valor_saldo), 0)::numeric   AS saldo,
                 COALESCE(SUM(p.valor_saldo) FILTER (WHERE p.data_vencimento < CURRENT_DATE), 0)::numeric AS vencido,
                 COALESCE(SUM(p.valor_saldo) FILTER (WHERE p.valor_pago > 0), 0)::numeric AS saldo_residual
          ${origem}
          WHERE ${filtro}
        `,
      ]);

    return NextResponse.json(
      serializeBigInts({
        porStatus,
        porTipoDespesa: porTipo,
        porDepartamento,
        projecao,
        saldoResidual,
        evolucaoMensal: Array.isArray(evolucao) ? [...(evolucao as unknown[])].reverse() : [],
        totais: Array.isArray(totais) ? ((totais as unknown[])[0] ?? null) : null,
      })
    );
  });
}

function relatorioVazio() {
  return {
    porStatus: [],
    porTipoDespesa: [],
    porDepartamento: [],
    projecao: [],
    saldoResidual: [],
    evolucaoMensal: [],
    totais: null,
  };
}
