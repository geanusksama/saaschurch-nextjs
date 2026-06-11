const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Running migration...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP;
    `);
    console.log("last_active_at column created or verified.");

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "presence_status" VARCHAR(20) DEFAULT 'online';
    `);
    console.log("presence_status column created or verified.");

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "custom_status" VARCHAR(255);
    `);
    console.log("custom_status column created or verified.");

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "internal_chat_messages" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "campo_id" UUID NOT NULL REFERENCES "campos"("id") ON DELETE CASCADE,
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "user_name" VARCHAR(255) NOT NULL,
        "user_role" VARCHAR(255),
        "body" TEXT,
        "file_url" TEXT,
        "file_name" VARCHAR(255),
        "file_type" VARCHAR(50),
        "file_size" INTEGER,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("internal_chat_messages table created or verified.");

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "internal_chat_messages_campo_id_idx" ON "internal_chat_messages"("campo_id");
    `);
    console.log("campoId index created or verified.");

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "internal_chat_messages_created_at_idx" ON "internal_chat_messages"("created_at");
    `);
    console.log("createdAt index created or verified.");

    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
