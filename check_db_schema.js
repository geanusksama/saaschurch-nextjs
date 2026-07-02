const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const notesPolicies = await prisma.$queryRawUnsafe(`
      SELECT policyname, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'pastoral_attendance_notes'
    `);
    console.log("NOTES POLICIES:", JSON.stringify(notesPolicies, null, 2));

    const attsPolicies = await prisma.$queryRawUnsafe(`
      SELECT policyname, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'pastoral_attendances'
    `);
    console.log("ATTENDANCES POLICIES:", JSON.stringify(attsPolicies, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
