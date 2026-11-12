-- Rastreador do site público (12/11/2026): visitas e cliques das páginas
-- públicas, para o painel "Rastreador do site". Sem IP e sem dado pessoal:
-- visitante_id é um identificador aleatório gerado no navegador.
CREATE TABLE IF NOT EXISTS "site_eventos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campo_id" UUID,
  "visitante_id" VARCHAR(64) NOT NULL,
  "sessao_id" VARCHAR(64) NOT NULL,
  "tipo" VARCHAR(20) NOT NULL,
  "caminho" VARCHAR(500) NOT NULL,
  "titulo" VARCHAR(255),
  "alvo" VARCHAR(255),
  "alvo_url" VARCHAR(500),
  "origem" VARCHAR(40) NOT NULL DEFAULT 'direto',
  "referrer" VARCHAR(500),
  "utm_source" VARCHAR(100),
  "utm_medium" VARCHAR(100),
  "utm_campaign" VARCHAR(100),
  "dispositivo" VARCHAR(20),
  "navegador" VARCHAR(40),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "site_eventos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "site_eventos_created_at_idx" ON "site_eventos" ("created_at");
CREATE INDEX IF NOT EXISTS "site_eventos_campo_id_created_at_idx" ON "site_eventos" ("campo_id", "created_at");
