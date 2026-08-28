-- Home pública configurável por igreja.
--
-- A home ("REINAR") era escrita para uma igreja só: logo, favicon, título da
-- aba, textos, cores, os oito ícones, os links do YouTube/Instagram/rádio, o
-- endereço da sede e os dias de culto estavam todos cravados no JSX. Como cada
-- igreja do SaaS roda contra o seu próprio banco, essa personalização passa a
-- morar aqui.
--
-- Migration ADITIVA: só cria tabelas novas, nenhuma coluna existente é tocada.
-- Tudo IF NOT EXISTS para conviver com o baseline idempotente do migrate-self.
--
-- Sem linha em home_configs a home renderiza o default do código
-- (src/lib/homeConfig.ts) — ausência de configuração é estado válido, por isso
-- não há seed.

CREATE TABLE IF NOT EXISTS "home_configs" (
    "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "campo_id"          UUID NOT NULL,

    -- Identidade: aba do navegador, favicon, logo e app instalado
    "site_title"        VARCHAR(120),
    "site_description"  VARCHAR(300),
    "favicon_url"       VARCHAR(500),
    "logo_url"          VARCHAR(500),
    "watermark_url"     VARCHAR(500),
    "pwa_name"          VARCHAR(120),
    "pwa_short_name"    VARCHAR(60),
    "pwa_icon_192"      VARCHAR(500),
    "pwa_icon_512"      VARCHAR(500),
    "pwa_icon_maskable" VARCHAR(500),

    -- Hero
    "hero_eyebrow"      VARCHAR(120),
    "hero_title"        VARCHAR(120),
    "hero_text"         TEXT,
    "verse_ref"         VARCHAR(80),
    "verse_label"       VARCHAR(40),
    "verse_text"        TEXT,
    "show_verse"        BOOLEAN NOT NULL DEFAULT TRUE,

    -- Aparência
    "bg_dark"           VARCHAR(7) NOT NULL DEFAULT '#0a0a0a',
    "bg_light"          VARCHAR(7) NOT NULL DEFAULT '#f5f4f0',
    "accent_color"      VARCHAR(7) NOT NULL DEFAULT '#d4af37',
    "default_dark"      BOOLEAN NOT NULL DEFAULT TRUE,
    "show_symbols"      BOOLEAN NOT NULL DEFAULT TRUE,
    "show_spotlights"   BOOLEAN NOT NULL DEFAULT TRUE,
    "watermark_opacity" DECIMAL(4,3) NOT NULL DEFAULT 0.05,
    "symbol_colors"     JSONB,

    -- Botão flutuante de atendimento da secretaria.
    -- Endereço, telefone, redes sociais e programação de culto NÃO ficam aqui:
    -- já vivem em headquarters / church_schedule, editados em Informações da
    -- Igreja. A home lê de lá para não existirem duas verdades.
    "services_config"   JSONB,

    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Uma home por campo. É o mesmo chaveamento do Peniel (peniel_configs).
CREATE UNIQUE INDEX IF NOT EXISTS "home_configs_campo_id_key"
    ON "home_configs" ("campo_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'home_configs_campo_id_fkey'
    ) THEN
        ALTER TABLE "home_configs"
            ADD CONSTRAINT "home_configs_campo_id_fkey"
            FOREIGN KEY ("campo_id") REFERENCES "campos"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Cada ícone da home é uma linha: reordenável, ocultável, com título, ícone,
-- cor e destino próprios.
CREATE TABLE IF NOT EXISTS "home_cards" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "config_id"   UUID NOT NULL,
    "key"         VARCHAR(60) NOT NULL,

    -- membro | peniel | gf | pwa | link | maps | agenda | verse
    "action"      VARCHAR(20) NOT NULL DEFAULT 'link',
    "title"       VARCHAR(160) NOT NULL,
    "subtitle"    TEXT,
    "url"         VARCHAR(500),

    "icon"        VARCHAR(40) NOT NULL DEFAULT 'Circle',
    "icon_color"  VARCHAR(7),
    "hover_color" VARCHAR(7),

    "visible"     BOOLEAN NOT NULL DEFAULT TRUE,
    "pulse"       BOOLEAN NOT NULL DEFAULT FALSE,
    "live_dot"    BOOLEAN NOT NULL DEFAULT FALSE,
    "full_width"  BOOLEAN NOT NULL DEFAULT FALSE,
    "sort_order"  INTEGER NOT NULL DEFAULT 0,

    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "home_cards_config_id_key_key"
    ON "home_cards" ("config_id", "key");

CREATE INDEX IF NOT EXISTS "home_cards_config_id_sort_order_idx"
    ON "home_cards" ("config_id", "sort_order");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'home_cards_config_id_fkey'
    ) THEN
        ALTER TABLE "home_cards"
            ADD CONSTRAINT "home_cards_config_id_fkey"
            FOREIGN KEY ("config_id") REFERENCES "home_configs"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
