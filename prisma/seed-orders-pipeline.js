/**
 * Seed: Pipeline PEDIDOS (Kanban administrativo de pedidos de ingressos)
 * Run: node prisma/seed-orders-pipeline.js
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // ── KanService ──────────────────────────────────────────────────────────────
  await prisma.kanService.upsert({
    where: { id: 33 },
    update: {},
    create: {
      id: 33,
      sigla: "ORDERS",
      description: "Gestão de Pedidos de Ingressos",
      servico: "Pedidos",
      serviceGroup: "APP",
      usesMatrix: false,
      isActive: true,
    },
  });

  // ── KanPipeline ─────────────────────────────────────────────────────────────
  const pipeline = await prisma.kanPipeline.upsert({
    where: { id: 5 },
    update: {},
    create: {
      id: 5,
      name: "PEDIDOS",
      type: "Pedidos de Ingressos",
      hash: "pedidos2026",
      campo: null,
      isActive: true,
    },
  });

  // ── KanStage ─────────────────────────────────────────────────────────────────
  const stage = await prisma.kanStage.upsert({
    where: { id: 20 },
    update: {},
    create: {
      id: 20,
      pipelineId: pipeline.id,
      serviceId: 33,
      name: "PEDIDOS",
      description: "Fluxo operacional dos pedidos gerados pelo APP",
      author: "Sistema",
      campo: null,
      hash: "pedidos2026",
      show: true,
      isActive: true,
    },
  });

  // ── KanColumns ───────────────────────────────────────────────────────────────
  const columns = [
    { id: 50, name: "Pagamento Pendente",       columnIndex: 1, color: "yellow"  },
    { id: 51, name: "Pagamento Realizado",       columnIndex: 2, color: "green"   },
    { id: 52, name: "Solicitação de Reembolso",  columnIndex: 3, color: "orange"  },
    { id: 53, name: "Reembolsado",               columnIndex: 4, color: "purple"  },
    { id: 54, name: "Cancelado",                 columnIndex: 5, color: "red"     },
  ];

  for (const col of columns) {
    await prisma.kanColumn.upsert({
      where: { id: col.id },
      update: { name: col.name, color: col.color },
      create: { id: col.id, stageId: stage.id, ...col },
    });
  }

  console.log("✅ Pipeline PEDIDOS criado com sucesso.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
