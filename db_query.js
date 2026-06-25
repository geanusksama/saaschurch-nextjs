const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  try {
    const users = await prisma.$queryRawUnsafe(`
      SELECT id, email, is_admin, profile_type FROM users WHERE id = 'a5daff23-2700-45a6-94eb-5359cb087e22'::uuid
    `);
    const members = await prisma.$queryRawUnsafe(`
      SELECT id, full_name, email, phone FROM members WHERE user_id = 'a5daff23-2700-45a6-94eb-5359cb087e22'::uuid
    `);
    console.log("USER:", JSON.stringify(users, null, 2));
    console.log("MEMBER:", JSON.stringify(members, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
