const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Criando tabelas do Peniel...");
  try {
    // 1. Criar peniel_configs
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS peniel_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campo_id UUID UNIQUE NOT NULL REFERENCES campos(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL DEFAULT 'Peniel',
        subtitle VARCHAR(255),
        description TEXT,
        hero_bg_image VARCHAR(500),
        primary_color VARCHAR(7) NOT NULL DEFAULT '#0b2819',
        secondary_color VARCHAR(7) NOT NULL DEFAULT '#d4af37',
        accent_color VARCHAR(7) NOT NULL DEFAULT '#c5a880',
        buttons_config JSONB,
        hero_cards JSONB,
        testimony_videos JSONB,
        whatsapp_instance_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      );
    `);
    console.log("- Tabela peniel_configs criada com sucesso.");

    // 2. Criar peniel_events
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS peniel_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campo_id UUID NOT NULL REFERENCES campos(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        time VARCHAR(50) NOT NULL,
        location VARCHAR(255) NOT NULL,
        value NUMERIC(12, 2) NOT NULL,
        "limit" INTEGER NOT NULL DEFAULT 100,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log("- Tabela peniel_events criada com sucesso.");

    // 3. Criar peniel_registrations
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS peniel_registrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL REFERENCES peniel_events(id) ON DELETE CASCADE,
        tipo_participante VARCHAR(20) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        endereco VARCHAR(255) NOT NULL,
        data_nascimento DATE NOT NULL,
        estado_civil VARCHAR(50) NOT NULL,
        idade INTEGER NOT NULL,
        celular VARCHAR(20) NOT NULL,
        igreja_base VARCHAR(255) NOT NULL,
        batizado_aguas BOOLEAN NOT NULL,
        participa_grupo_familiar BOOLEAN NOT NULL,
        grupo_familiar_qual VARCHAR(255),
        nome_lider VARCHAR(255),
        quem_motivou VARCHAR(255) NOT NULL,
        porque_decidiu TEXT NOT NULL,
        expectativas TEXT NOT NULL,
        peso NUMERIC(5, 2) NOT NULL,
        altura NUMERIC(3, 2) NOT NULL,
        medicamentos TEXT,
        alergias_restricoes TEXT,
        important_contacts JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'inscrito',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log("- Tabela peniel_registrations criada com sucesso.");

    console.log("Todas as tabelas foram criadas com sucesso!");
  } catch (err) {
    console.error("Erro ao criar tabelas:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
