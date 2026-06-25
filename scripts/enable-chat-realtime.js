const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Enabling Supabase Realtime publication for internal_chat_messages...");

    // First check if publication exists, then add the table
    await prisma.$executeRawUnsafe(`
      ALTER PUBLICATION supabase_realtime ADD TABLE internal_chat_messages;
    `);

    console.log("Successfully enabled Supabase Realtime for internal_chat_messages!");
  } catch (err) {
    console.error("Failed to enable Realtime:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
