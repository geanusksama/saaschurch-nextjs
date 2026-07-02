const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const church = await prisma.$queryRawUnsafe(`
      SELECT id, name FROM churches WHERE id = '6d2688df-5249-4bd2-89cc-0cd8c324b3d8'::uuid
    `);
    console.log("CHURCH:", JSON.stringify(church, null, 2));

    const curChurch = await prisma.$queryRawUnsafe(`
      SELECT id, name FROM churches WHERE name ILIKE '%Campinas%'
    `);
    console.log("CAMPINAS CHURCHES:", JSON.stringify(curChurch, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
