-- Módulo Patrimônio: bens móveis de cada igreja, com QR de identificação, e o
-- inventário físico (conferência item a item pelo leitor de QR).
--
-- Migration ADITIVA — só cria tabelas novas, nenhuma tabela existente é tocada.
--
-- `qr_token` é o valor codificado no QR impresso na etiqueta. É uma coluna
-- separada do `id` de propósito: o QR fica exposto no mundo físico (etiqueta
-- colada no bem), então não vale a pena vazar a chave primária nele.

CREATE TABLE IF NOT EXISTS "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "church_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100),
    "sector" VARCHAR(100),
    "description" TEXT,
    "photo_url" TEXT,
    "qr_token" UUID NOT NULL DEFAULT gen_random_uuid(),
    "location_type" VARCHAR(20) NOT NULL,
    "location_detail" VARCHAR(255),
    "acquisition_type" VARCHAR(20),
    "acquisition_date" DATE,
    "value" DECIMAL(12,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "assets_code_key" ON "assets" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "assets_qr_token_key" ON "assets" ("qr_token");
CREATE INDEX IF NOT EXISTS "assets_church_id_idx" ON "assets" ("church_id");

ALTER TABLE "assets"
    ADD CONSTRAINT "assets_church_id_fkey"
    FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE IF NOT EXISTS "asset_inventories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "church_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "started_by_user_id" UUID NOT NULL,
    "leader_name" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    "observation" TEXT,

    CONSTRAINT "asset_inventories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "asset_inventories_church_id_idx" ON "asset_inventories" ("church_id");

ALTER TABLE "asset_inventories"
    ADD CONSTRAINT "asset_inventories_church_id_fkey"
    FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_inventories"
    ADD CONSTRAINT "asset_inventories_started_by_user_id_fkey"
    FOREIGN KEY ("started_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Uma linha por bem lido durante o inventário. `location_match = false` é a
-- divergência: o bem existe, mas estava em lugar diferente do cadastrado —
-- quem está conferindo informa onde achou em `location_found`.
CREATE TABLE IF NOT EXISTS "asset_inventory_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inventory_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location_match" BOOLEAN NOT NULL DEFAULT true,
    "location_found" VARCHAR(255),
    "observation" TEXT,

    CONSTRAINT "asset_inventory_items_pkey" PRIMARY KEY ("id")
);

-- Reler o mesmo QR duas vezes atualiza a leitura, não cria outra.
CREATE UNIQUE INDEX IF NOT EXISTS "asset_inventory_items_inventory_id_asset_id_key"
    ON "asset_inventory_items" ("inventory_id", "asset_id");

ALTER TABLE "asset_inventory_items"
    ADD CONSTRAINT "asset_inventory_items_inventory_id_fkey"
    FOREIGN KEY ("inventory_id") REFERENCES "asset_inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_inventory_items"
    ADD CONSTRAINT "asset_inventory_items_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
