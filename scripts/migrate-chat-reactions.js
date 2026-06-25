const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Running reactions & reply migration...");

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "internal_chat_messages" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
    `);
    console.log("deleted_at column added.");

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "internal_chat_messages" ADD COLUMN IF NOT EXISTS "parent_id" UUID;
    `);
    console.log("parent_id column added.");

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "internal_chat_messages" ADD COLUMN IF NOT EXISTS "parent_name" VARCHAR(255);
    `);
    console.log("parent_name column added.");

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "internal_chat_messages" ADD COLUMN IF NOT EXISTS "parent_body" TEXT;
    `);
    console.log("parent_body column added.");

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "internal_chat_messages" ADD COLUMN IF NOT EXISTS "reactions" JSONB DEFAULT '{}';
    `);
    console.log("reactions column added.");

    console.log("Reactions/Replies Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
