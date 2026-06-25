const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Adicionando novas colunas às tabelas do Peniel...");
  try {
    // Alter peniel_events
    await prisma.$executeRawUnsafe(`
      ALTER TABLE peniel_events 
      ADD COLUMN IF NOT EXISTS date_label VARCHAR(255),
      ADD COLUMN IF NOT EXISTS departure_location VARCHAR(255),
      ADD COLUMN IF NOT EXISTS event_location VARCHAR(255),
      ADD COLUMN IF NOT EXISTS latitude VARCHAR(50),
      ADD COLUMN IF NOT EXISTS longitude VARCHAR(50),
      ADD COLUMN IF NOT EXISTS extra_fields_config JSONB DEFAULT '{}'::jsonb;
    `);
    console.log("- Colunas adicionadas à tabela peniel_events com sucesso.");

    // Alter peniel_registrations
    await prisma.$executeRawUnsafe(`
      ALTER TABLE peniel_registrations
      ADD COLUMN IF NOT EXISTS additional_fields JSONB DEFAULT '{}'::jsonb;
    `);
    console.log("- Colunas adicionadas à tabela peniel_registrations com sucesso.");

    console.log("Banco de dados atualizado com sucesso!");
  } catch (err) {
    console.error("Erro ao atualizar o banco de dados:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
