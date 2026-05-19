const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);
    const tables = {};
    rows.forEach(r => {
      if (!tables[r.table_name]) tables[r.table_name] = [];
      tables[r.table_name].push(r.column_name + " (" + r.data_type + (r.is_nullable === "NO" ? " NOT NULL" : "") + ")");
    });
    Object.entries(tables).forEach(([t, cols]) => {
      console.log("TABLE: " + t);
      cols.forEach(c => console.log("  " + c));
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
