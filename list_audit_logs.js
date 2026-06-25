const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  try {
    const logs = await prisma.$queryRawUnsafe(`
      SELECT *
      FROM audit_logs
      WHERE description ILIKE '%status%' 
         OR description ILIKE '%caixa%' 
         OR entity_type ILIKE '%status%'
         OR entity_type ILIKE '%caixa%'
         OR entity_type ILIKE '%cash%'
      ORDER BY created_at DESC
      LIMIT 100
    `);
    console.log("CASH STATUS AUDIT LOGS:", JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
