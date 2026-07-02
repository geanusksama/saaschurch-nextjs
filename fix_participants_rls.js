const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Updating RLS policies for pastoral_attendance_participants...");
    
    await prisma.$executeRawUnsafe(`
      DROP POLICY IF EXISTS "pastoral_participants_church_select" ON pastoral_attendance_participants;
    `);
    await prisma.$executeRawUnsafe(`
      DROP POLICY IF EXISTS "pastoral_participants_church_insert" ON pastoral_attendance_participants;
    `);
    await prisma.$executeRawUnsafe(`
      DROP POLICY IF EXISTS "pastoral_participants_church_delete" ON pastoral_attendance_participants;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE POLICY "pastoral_participants_church_select"
        ON pastoral_attendance_participants FOR SELECT
        USING (app.current_church_id() IS NULL OR church_id = app.current_church_id());
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE POLICY "pastoral_participants_church_insert"
        ON pastoral_attendance_participants FOR INSERT
        WITH CHECK (app.current_church_id() IS NULL OR church_id = app.current_church_id());
    `);

    await prisma.$executeRawUnsafe(`
      CREATE POLICY "pastoral_participants_church_delete"
        ON pastoral_attendance_participants FOR DELETE
        USING (app.current_church_id() IS NULL OR church_id = app.current_church_id());
    `);

    console.log("RLS policies updated successfully!");
  } catch (err) {
    console.error("Error updating RLS policies:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
