/**
 * Script de limpeza de notificações duplicadas.
 * Para cada batchId, mantém apenas o registro mais antigo (primeiro criado) e apaga os demais.
 *
 * Uso: node prisma/cleanup-notification-dupes.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Buscando notificações com batchId duplicado...');

  const rows = await prisma.$queryRaw`
    SELECT id::text AS id, data->>'batchId' AS batch_id, created_at
    FROM notifications
    WHERE data->>'batchId' IS NOT NULL
    ORDER BY created_at ASC
  `;

  if (!rows.length) {
    console.log('Nenhuma notificação com batchId encontrada.');
    return;
  }

  // Para cada batchId, mantém o primeiro (mais antigo)
  const keepIds = new Set();
  const seenBatch = new Map();

  for (const row of rows) {
    if (!seenBatch.has(row.batch_id)) {
      seenBatch.set(row.batch_id, row.id);
      keepIds.add(row.id);
    }
  }

  const allIds = rows.map((r) => r.id);
  const deleteIds = allIds.filter((id) => !keepIds.has(id));

  if (!deleteIds.length) {
    console.log('Sem duplicatas para remover.');
    return;
  }

  console.log(`Total com batchId: ${allIds.length}`);
  console.log(`Mantendo: ${keepIds.size} (um por batchId)`);
  console.log(`Removendo: ${deleteIds.length} duplicatas...`);

  const result = await prisma.notification.deleteMany({
    where: { id: { in: deleteIds } },
  });

  console.log(`✓ ${result.count} notificações duplicadas removidas.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
