const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Criando tabela faceid_devices...");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS faceid_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
        serial VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(100),
        password VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      );
    `);
    console.log("Tabela faceid_devices criada com sucesso!");
  } catch (err) {
    console.error("Erro ao criar tabela faceid_devices:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
