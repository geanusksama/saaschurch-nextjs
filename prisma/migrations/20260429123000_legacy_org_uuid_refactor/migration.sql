CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS "contatos_igreja" RENAME TO "church_contacts";
ALTER TABLE IF EXISTS "tbfuncoes" RENAME TO "church_function_catalog";
ALTER TABLE IF EXISTS "funcoes_igreja" RENAME TO "church_function_history";
ALTER TABLE IF EXISTS "historico_dirigente_igreja" RENAME TO "church_leader_history";
ALTER TABLE IF EXISTS "tbcampo" RENAME TO "field";
ALTER TABLE IF EXISTS "regional" RENAME TO "region";
ALTER TABLE IF EXISTS "tbigrejasede" RENAME TO "headquarters";
ALTER TABLE IF EXISTS "tbigrejafoto" RENAME TO "church_photo";
ALTER TABLE IF EXISTS "tbigreja" RENAME TO "church";

DO $$
BEGIN
  IF to_regclass('public.church_function_catalog') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'abreviacao') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "abreviacao" TO "abbreviation";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'nome') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "nome" TO "name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'ativo') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "ativo" TO "is_active";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'numero') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "numero" TO "number";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'nivelprerequisito') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "nivelprerequisito" TO "prerequisite_level";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'idademinima') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "idademinima" TO "minimum_age";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'idademaxima') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "idademaxima" TO "maximum_age";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'ordem') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "ordem" TO "display_order";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'exigirdatamin') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "exigirdatamin" TO "requires_minimum_date";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'dirigente') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "dirigente" TO "is_leader_role";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'diretoria') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "diretoria" TO "is_board_role";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'somenteministro') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "somenteministro" TO "only_minister";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'permitirhomem') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "permitirhomem" TO "allow_men";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'permitirmulher') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "permitirmulher" TO "allow_women";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'perfis') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "perfis" TO "profiles";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'campo') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "campo" TO "field_name";
    END IF;
  END IF;

  IF to_regclass('public.field') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'field' AND column_name = 'estado') THEN
      ALTER TABLE "field" RENAME COLUMN "estado" TO "state";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'field' AND column_name = 'campo') THEN
      ALTER TABLE "field" RENAME COLUMN "campo" TO "name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'field' AND column_name = 'presidente') THEN
      ALTER TABLE "field" RENAME COLUMN "presidente" TO "president";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'field' AND column_name = 'sede') THEN
      ALTER TABLE "field" RENAME COLUMN "sede" TO "headquarters_name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'field' AND column_name = 'senha') THEN
      ALTER TABLE "field" RENAME COLUMN "senha" TO "password";
    END IF;
  END IF;

  IF to_regclass('public.region') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'region' AND column_name = 'regional') THEN
      ALTER TABLE "region" RENAME COLUMN "regional" TO "name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'region' AND column_name = 'idsede') THEN
      ALTER TABLE "region" RENAME COLUMN "idsede" TO "headquarters_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'region' AND column_name = 'campo') THEN
      ALTER TABLE "region" RENAME COLUMN "campo" TO "field_name";
    END IF;
  END IF;

  IF to_regclass('public.headquarters') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'tictoc') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "tictoc" TO "tiktok";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'contato') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "contato" TO "contact";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'rua') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "rua" TO "street";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'numero') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "numero" TO "number";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'cidade') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "cidade" TO "city";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'estado') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "estado" TO "state";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'pais') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "pais" TO "country";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'bairro') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "bairro" TO "neighborhood";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'mostrar') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "mostrar" TO "show";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'pagamentoTokenUm') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "pagamentoTokenUm" TO "payment_token_one";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'pagamentoTokenDois') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "pagamentoTokenDois" TO "payment_token_two";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'regional') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "regional" TO "region_name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'campo') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "campo" TO "field_name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'igreja') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "igreja" TO "name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'idigrejasede') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "idigrejasede" TO "linked_headquarters_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'agendapdf') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "agendapdf" TO "agenda_pdf";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'banco') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "banco" TO "bank";
    END IF;
  END IF;

  IF to_regclass('public.church_photo') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_photo' AND column_name = 'idtbigreja') THEN
      ALTER TABLE "church_photo" RENAME COLUMN "idtbigreja" TO "church_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_photo' AND column_name = 'foto') THEN
      ALTER TABLE "church_photo" RENAME COLUMN "foto" TO "photo_url";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_photo' AND column_name = 'campo') THEN
      ALTER TABLE "church_photo" RENAME COLUMN "campo" TO "field_name";
    END IF;
  END IF;

  IF to_regclass('public.church') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'igreja') THEN
      ALTER TABLE "church" RENAME COLUMN "igreja" TO "name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'idtbregional') THEN
      ALTER TABLE "church" RENAME COLUMN "idtbregional" TO "region_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'idtbsede') THEN
      ALTER TABLE "church" RENAME COLUMN "idtbsede" TO "headquarters_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'hierarquia') THEN
      ALTER TABLE "church" RENAME COLUMN "hierarquia" TO "hierarchy";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'tipodocumento') THEN
      ALTER TABLE "church" RENAME COLUMN "tipodocumento" TO "document_type";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'documento') THEN
      ALTER TABLE "church" RENAME COLUMN "documento" TO "document_number";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'datafundacao') THEN
      ALTER TABLE "church" RENAME COLUMN "datafundacao" TO "foundation_date";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'cep') THEN
      ALTER TABLE "church" RENAME COLUMN "cep" TO "zipcode";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'pais') THEN
      ALTER TABLE "church" RENAME COLUMN "pais" TO "country";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'estado') THEN
      ALTER TABLE "church" RENAME COLUMN "estado" TO "state";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'cidade') THEN
      ALTER TABLE "church" RENAME COLUMN "cidade" TO "city";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'bairro') THEN
      ALTER TABLE "church" RENAME COLUMN "bairro" TO "neighborhood";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'logradouro') THEN
      ALTER TABLE "church" RENAME COLUMN "logradouro" TO "street";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'regional') THEN
      ALTER TABLE "church" RENAME COLUMN "regional" TO "region_name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'temploproprio') THEN
      ALTER TABLE "church" RENAME COLUMN "temploproprio" TO "has_own_temple";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'campo') THEN
      ALTER TABLE "church" RENAME COLUMN "campo" TO "field_name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'idfirebase') THEN
      ALTER TABLE "church" RENAME COLUMN "idfirebase" TO "firebase_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'obs') THEN
      ALTER TABLE "church" RENAME COLUMN "obs" TO "notes";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'igrejapai') THEN
      ALTER TABLE "church" RENAME COLUMN "igrejapai" TO "parent_church_name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'ativo') THEN
      ALTER TABLE "church" RENAME COLUMN "ativo" TO "is_active";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'codigo') THEN
      ALTER TABLE "church" RENAME COLUMN "codigo" TO "code";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'nomeplaca') THEN
      ALTER TABLE "church" RENAME COLUMN "nomeplaca" TO "plate_name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'dirigente') THEN
      ALTER TABLE "church" RENAME COLUMN "dirigente" TO "leader_name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'entrada') THEN
      ALTER TABLE "church" RENAME COLUMN "entrada" TO "entry_date";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'saida') THEN
      ALTER TABLE "church" RENAME COLUMN "saida" TO "exit_date";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'roldirigente') THEN
      ALTER TABLE "church" RENAME COLUMN "roldirigente" TO "leader_roll";
    END IF;
  END IF;
END $$;

ALTER TABLE IF EXISTS "region" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
DECLARE
  pk_name TEXT;
BEGIN
  IF to_regclass('public.headquarters') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'id' AND data_type <> 'uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'legacy_id') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "id" TO "legacy_id";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'linked_headquarters_id' AND data_type <> 'uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'headquarters' AND column_name = 'legacy_linked_headquarters_id') THEN
      ALTER TABLE "headquarters" RENAME COLUMN "linked_headquarters_id" TO "legacy_linked_headquarters_id";
    END IF;

    ALTER TABLE "headquarters" ADD COLUMN IF NOT EXISTS "id" UUID;
    ALTER TABLE "headquarters" ADD COLUMN IF NOT EXISTS "linked_headquarters_id" UUID;

    UPDATE "headquarters"
    SET "id" = CASE
      WHEN lower(coalesce("field_name", '')) = 'campinas' OR lower(coalesce("name", '')) LIKE '%campinas%' THEN '0d4f2e77-6f4c-4e3a-9a7f-2d0ce9d68f01'::uuid
      WHEN lower(coalesce("field_name", '')) = 'aguai' OR lower(coalesce("name", '')) LIKE '%aguai%' THEN '4d9e9df8-62fe-4b6c-8d5d-9f2a74395c02'::uuid
      WHEN lower(coalesce("field_name", '')) = 'curitiba' OR lower(coalesce("name", '')) LIKE '%curitiba%' THEN 'c1d64cc7-8e02-4b86-9c2c-9019d9a96d03'::uuid
      ELSE gen_random_uuid()
    END
    WHERE "id" IS NULL;

    UPDATE "headquarters" current_row
    SET "linked_headquarters_id" = linked_row."id"
    FROM "headquarters" linked_row
    WHERE current_row."linked_headquarters_id" IS NULL
      AND current_row."legacy_linked_headquarters_id" IS NOT NULL
      AND linked_row."legacy_id" = current_row."legacy_linked_headquarters_id";

    INSERT INTO "headquarters" ("id", "created_at", "field_name", "name", "state", "country", "show")
    SELECT '0d4f2e77-6f4c-4e3a-9a7f-2d0ce9d68f01'::uuid, CURRENT_TIMESTAMP, 'campinas', 'Campinas', 'SP', 'Brasil', true
    WHERE NOT EXISTS (
      SELECT 1 FROM "headquarters"
      WHERE lower(coalesce("field_name", '')) = 'campinas' OR lower(coalesce("name", '')) LIKE '%campinas%'
    );

    INSERT INTO "headquarters" ("id", "created_at", "field_name", "name", "state", "country", "show")
    SELECT '4d9e9df8-62fe-4b6c-8d5d-9f2a74395c02'::uuid, CURRENT_TIMESTAMP, 'aguai', 'Aguai', 'SP', 'Brasil', true
    WHERE NOT EXISTS (
      SELECT 1 FROM "headquarters"
      WHERE lower(coalesce("field_name", '')) = 'aguai' OR lower(coalesce("name", '')) LIKE '%aguai%'
    );

    INSERT INTO "headquarters" ("id", "created_at", "field_name", "name", "state", "country", "show")
    SELECT 'c1d64cc7-8e02-4b86-9c2c-9019d9a96d03'::uuid, CURRENT_TIMESTAMP, 'curitiba', 'Curitiba', 'PR', 'Brasil', true
    WHERE NOT EXISTS (
      SELECT 1 FROM "headquarters"
      WHERE lower(coalesce("field_name", '')) = 'curitiba' OR lower(coalesce("name", '')) LIKE '%curitiba%'
    );

    ALTER TABLE "headquarters" ALTER COLUMN "id" SET NOT NULL;
    ALTER TABLE "headquarters" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

    SELECT conname INTO pk_name FROM pg_constraint WHERE conrelid = 'public.headquarters'::regclass AND contype = 'p' LIMIT 1;
    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE "headquarters" DROP CONSTRAINT %I', pk_name);
    END IF;

    ALTER TABLE "headquarters" ADD CONSTRAINT "headquarters_pkey" PRIMARY KEY ("id");
    CREATE UNIQUE INDEX IF NOT EXISTS "headquarters_legacy_id_key" ON "headquarters" ("legacy_id");
  END IF;
END $$;

DO $$
DECLARE
  pk_name TEXT;
BEGIN
  IF to_regclass('public.region') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'region' AND column_name = 'id' AND data_type <> 'uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'region' AND column_name = 'legacy_id') THEN
      ALTER TABLE "region" RENAME COLUMN "id" TO "legacy_id";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'region' AND column_name = 'headquarters_id' AND data_type <> 'uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'region' AND column_name = 'legacy_headquarters_id') THEN
      ALTER TABLE "region" RENAME COLUMN "headquarters_id" TO "legacy_headquarters_id";
    END IF;

    ALTER TABLE "region" ADD COLUMN IF NOT EXISTS "id" UUID;
    ALTER TABLE "region" ADD COLUMN IF NOT EXISTS "headquarters_id" UUID;

    UPDATE "region" SET "id" = gen_random_uuid() WHERE "id" IS NULL;

    UPDATE "region" current_row
    SET "headquarters_id" = linked_row."id"
    FROM "headquarters" linked_row
    WHERE current_row."headquarters_id" IS NULL
      AND current_row."legacy_headquarters_id" IS NOT NULL
      AND (
        linked_row."legacy_id"::text = current_row."legacy_headquarters_id"
        OR linked_row."id"::text = current_row."legacy_headquarters_id"
      );

    ALTER TABLE "region" ALTER COLUMN "id" SET NOT NULL;
    ALTER TABLE "region" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

    SELECT conname INTO pk_name FROM pg_constraint WHERE conrelid = 'public.region'::regclass AND contype = 'p' LIMIT 1;
    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE "region" DROP CONSTRAINT %I', pk_name);
    END IF;

    ALTER TABLE "region" ADD CONSTRAINT "region_pkey" PRIMARY KEY ("id");
    CREATE UNIQUE INDEX IF NOT EXISTS "region_legacy_id_key" ON "region" ("legacy_id");
  END IF;
END $$;

DO $$
DECLARE
  pk_name TEXT;
BEGIN
  IF to_regclass('public.field') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'field' AND column_name = 'id' AND data_type <> 'uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'field' AND column_name = 'legacy_id') THEN
      ALTER TABLE "field" RENAME COLUMN "id" TO "legacy_id";
    END IF;

    ALTER TABLE "field" ADD COLUMN IF NOT EXISTS "id" UUID;
    UPDATE "field" SET "id" = gen_random_uuid() WHERE "id" IS NULL;
    ALTER TABLE "field" ALTER COLUMN "id" SET NOT NULL;
    ALTER TABLE "field" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

    SELECT conname INTO pk_name FROM pg_constraint WHERE conrelid = 'public.field'::regclass AND contype = 'p' LIMIT 1;
    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE "field" DROP CONSTRAINT %I', pk_name);
    END IF;

    ALTER TABLE "field" ADD CONSTRAINT "field_pkey" PRIMARY KEY ("id");
    CREATE UNIQUE INDEX IF NOT EXISTS "field_legacy_id_key" ON "field" ("legacy_id");
  END IF;
END $$;

DO $$
DECLARE
  pk_name TEXT;
BEGIN
  IF to_regclass('public.church') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'id' AND data_type <> 'uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'legacy_id') THEN
      ALTER TABLE "church" RENAME COLUMN "id" TO "legacy_id";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'region_id' AND data_type <> 'uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'legacy_region_id') THEN
      ALTER TABLE "church" RENAME COLUMN "region_id" TO "legacy_region_id";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'headquarters_id' AND data_type <> 'uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church' AND column_name = 'legacy_headquarters_id') THEN
      ALTER TABLE "church" RENAME COLUMN "headquarters_id" TO "legacy_headquarters_id";
    END IF;

    ALTER TABLE "church" ADD COLUMN IF NOT EXISTS "id" UUID;
    ALTER TABLE "church" ADD COLUMN IF NOT EXISTS "region_id" UUID;
    ALTER TABLE "church" ADD COLUMN IF NOT EXISTS "headquarters_id" UUID;

    UPDATE "church" SET "id" = gen_random_uuid() WHERE "id" IS NULL;

    UPDATE "church" current_row
    SET "region_id" = linked_row."id"
    FROM "region" linked_row
    WHERE current_row."region_id" IS NULL
      AND current_row."legacy_region_id" IS NOT NULL
      AND (
        linked_row."legacy_id"::text = current_row."legacy_region_id"
        OR linked_row."id"::text = current_row."legacy_region_id"
        OR (
          lower(coalesce(linked_row."name", '')) = lower(coalesce(current_row."region_name", ''))
          AND lower(coalesce(linked_row."field_name", '')) = lower(coalesce(current_row."field_name", ''))
        )
      );

    UPDATE "church"
    SET "headquarters_id" = CASE
      WHEN lower(coalesce("field_name", '')) = 'curitiba' OR lower(coalesce("region_name", '')) LIKE '%curitiba%' OR lower(coalesce("name", '')) LIKE '%curitiba%' THEN 'c1d64cc7-8e02-4b86-9c2c-9019d9a96d03'::uuid
      WHEN lower(coalesce("field_name", '')) = 'aguai' OR lower(coalesce("region_name", '')) LIKE '%aguai%' OR lower(coalesce("name", '')) LIKE '%aguai%' THEN '4d9e9df8-62fe-4b6c-8d5d-9f2a74395c02'::uuid
      ELSE '0d4f2e77-6f4c-4e3a-9a7f-2d0ce9d68f01'::uuid
    END
    WHERE "headquarters_id" IS NULL;

    ALTER TABLE "church" ALTER COLUMN "id" SET NOT NULL;
    ALTER TABLE "church" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

    SELECT conname INTO pk_name FROM pg_constraint WHERE conrelid = 'public.church'::regclass AND contype = 'p' LIMIT 1;
    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE "church" DROP CONSTRAINT %I', pk_name);
    END IF;

    ALTER TABLE "church" ADD CONSTRAINT "church_pkey" PRIMARY KEY ("id");
    CREATE UNIQUE INDEX IF NOT EXISTS "church_legacy_id_key" ON "church" ("legacy_id");
  END IF;
END $$;

DO $$
DECLARE
  pk_name TEXT;
BEGIN
  IF to_regclass('public.church_photo') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_photo' AND column_name = 'id' AND data_type <> 'uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_photo' AND column_name = 'legacy_id') THEN
      ALTER TABLE "church_photo" RENAME COLUMN "id" TO "legacy_id";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_photo' AND column_name = 'church_id' AND data_type <> 'uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_photo' AND column_name = 'legacy_church_id') THEN
      ALTER TABLE "church_photo" RENAME COLUMN "church_id" TO "legacy_church_id";
    END IF;

    ALTER TABLE "church_photo" ADD COLUMN IF NOT EXISTS "id" UUID;
    ALTER TABLE "church_photo" ADD COLUMN IF NOT EXISTS "church_id" UUID;

    UPDATE "church_photo" SET "id" = gen_random_uuid() WHERE "id" IS NULL;

    UPDATE "church_photo" current_row
    SET "church_id" = linked_row."id"
    FROM "church" linked_row
    WHERE current_row."church_id" IS NULL
      AND current_row."legacy_church_id" IS NOT NULL
      AND linked_row."legacy_id" = current_row."legacy_church_id";

    ALTER TABLE "church_photo" ALTER COLUMN "id" SET NOT NULL;
    ALTER TABLE "church_photo" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

    SELECT conname INTO pk_name FROM pg_constraint WHERE conrelid = 'public.church_photo'::regclass AND contype = 'p' LIMIT 1;
    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE "church_photo" DROP CONSTRAINT %I', pk_name);
    END IF;

    ALTER TABLE "church_photo" ADD CONSTRAINT "church_photo_pkey" PRIMARY KEY ("id");
    CREATE UNIQUE INDEX IF NOT EXISTS "church_photo_legacy_id_key" ON "church_photo" ("legacy_id");
  END IF;
END $$;

DO $$
DECLARE
  pk_name TEXT;
BEGIN
  IF to_regclass('public.church_function_catalog') IS NOT NULL THEN
    ALTER TABLE IF EXISTS "church_function_history" DROP CONSTRAINT IF EXISTS "funcoes_igreja_function_id_fkey";
    ALTER TABLE IF EXISTS "church_leader_history" DROP CONSTRAINT IF EXISTS "historico_dirigente_igreja_function_id_fkey";

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'id' AND data_type <> 'uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_catalog' AND column_name = 'legacy_id') THEN
      ALTER TABLE "church_function_catalog" RENAME COLUMN "id" TO "legacy_id";
    END IF;

    ALTER TABLE "church_function_catalog" ADD COLUMN IF NOT EXISTS "id" UUID;
    UPDATE "church_function_catalog" SET "id" = gen_random_uuid() WHERE "id" IS NULL;
    ALTER TABLE "church_function_catalog" ALTER COLUMN "id" SET NOT NULL;
    ALTER TABLE "church_function_catalog" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

    SELECT conname INTO pk_name FROM pg_constraint WHERE conrelid = 'public.church_function_catalog'::regclass AND contype = 'p' LIMIT 1;
    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE "church_function_catalog" DROP CONSTRAINT %I', pk_name);
    END IF;

    ALTER TABLE "church_function_catalog" ADD CONSTRAINT "church_function_catalog_pkey" PRIMARY KEY ("id");
    CREATE UNIQUE INDEX IF NOT EXISTS "church_function_catalog_legacy_id_key" ON "church_function_catalog" ("legacy_id");
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.church_function_history') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_history' AND column_name = 'function_id' AND data_type <> 'uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_function_history' AND column_name = 'legacy_function_id') THEN
      ALTER TABLE "church_function_history" RENAME COLUMN "function_id" TO "legacy_function_id";
    END IF;

    ALTER TABLE "church_function_history" ADD COLUMN IF NOT EXISTS "function_id" UUID;

    UPDATE "church_function_history" history_row
    SET "function_id" = catalog_row."id"
    FROM "church_function_catalog" catalog_row
    WHERE history_row."function_id" IS NULL
      AND history_row."legacy_function_id" IS NOT NULL
      AND catalog_row."legacy_id" = history_row."legacy_function_id";
  END IF;

  IF to_regclass('public.church_leader_history') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_leader_history' AND column_name = 'function_id' AND data_type <> 'uuid')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'church_leader_history' AND column_name = 'legacy_function_id') THEN
      ALTER TABLE "church_leader_history" RENAME COLUMN "function_id" TO "legacy_function_id";
    END IF;

    ALTER TABLE "church_leader_history" ADD COLUMN IF NOT EXISTS "function_id" UUID;

    UPDATE "church_leader_history" history_row
    SET "function_id" = catalog_row."id"
    FROM "church_function_catalog" catalog_row
    WHERE history_row."function_id" IS NULL
      AND history_row."legacy_function_id" IS NOT NULL
      AND catalog_row."legacy_id" = history_row."legacy_function_id";
  END IF;
END $$;

ALTER TABLE IF EXISTS "region" DROP CONSTRAINT IF EXISTS "tbregional_pkey";
ALTER TABLE IF EXISTS "headquarters" DROP CONSTRAINT IF EXISTS "tbigrejasede_pkey";
ALTER TABLE IF EXISTS "church" DROP CONSTRAINT IF EXISTS "tbigreja_pkey";
ALTER TABLE IF EXISTS "church" DROP CONSTRAINT IF EXISTS "tbigreja_id_key";
ALTER TABLE IF EXISTS "church_photo" DROP CONSTRAINT IF EXISTS "tbigrejafoto_pkey";
ALTER TABLE IF EXISTS "field" DROP CONSTRAINT IF EXISTS "tbcampo_pkey";

ALTER TABLE IF EXISTS "church_function_history" DROP CONSTRAINT IF EXISTS "funcoes_igreja_function_id_fkey";
ALTER TABLE IF EXISTS "church_leader_history" DROP CONSTRAINT IF EXISTS "historico_dirigente_igreja_function_id_fkey";
ALTER TABLE IF EXISTS "church_function_catalog" DROP CONSTRAINT IF EXISTS "tbfuncoes_pkey";

DO $$
BEGIN
  IF to_regclass('public.region') IS NOT NULL THEN
    ALTER TABLE "region" DROP CONSTRAINT IF EXISTS "region_headquarters_id_fkey";
    ALTER TABLE "region"
      ADD CONSTRAINT "region_headquarters_id_fkey"
      FOREIGN KEY ("headquarters_id") REFERENCES "headquarters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public.church') IS NOT NULL THEN
    ALTER TABLE "church" DROP CONSTRAINT IF EXISTS "church_region_id_fkey";
    ALTER TABLE "church" DROP CONSTRAINT IF EXISTS "church_headquarters_id_fkey";
    ALTER TABLE "church"
      ADD CONSTRAINT "church_region_id_fkey"
      FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ALTER TABLE "church"
      ADD CONSTRAINT "church_headquarters_id_fkey"
      FOREIGN KEY ("headquarters_id") REFERENCES "headquarters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public.church_photo') IS NOT NULL THEN
    ALTER TABLE "church_photo" DROP CONSTRAINT IF EXISTS "church_photo_church_id_fkey";
    ALTER TABLE "church_photo"
      ADD CONSTRAINT "church_photo_church_id_fkey"
      FOREIGN KEY ("church_id") REFERENCES "church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public.church_function_history') IS NOT NULL THEN
    ALTER TABLE "church_function_history"
      ADD CONSTRAINT "church_function_history_function_id_fkey"
      FOREIGN KEY ("function_id") REFERENCES "church_function_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public.church_leader_history') IS NOT NULL THEN
    ALTER TABLE "church_leader_history"
      ADD CONSTRAINT "church_leader_history_function_id_fkey"
      FOREIGN KEY ("function_id") REFERENCES "church_function_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
