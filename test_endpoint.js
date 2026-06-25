const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  try {
    const res = await prisma.penielRegistration.findMany({
      where: {
        deletedAt: null,
        event: {
          deletedAt: null
        }
      },
      include: {
        event: true
      }
    });
    console.log("Success! Items count:", res.length);
  } catch (err) {
    console.error("FAILED WITH ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
