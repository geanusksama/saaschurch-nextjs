const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Running migration to add receiver_id to internal_chat_messages...");

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "internal_chat_messages" ADD COLUMN IF NOT EXISTS "receiver_id" UUID REFERENCES "users"("id") ON DELETE CASCADE;
    `);
    console.log("receiver_id column added.");

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "internal_chat_messages_receiver_id_idx" ON "internal_chat_messages"("receiver_id");
    `);
    console.log("receiver_id index created.");

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
