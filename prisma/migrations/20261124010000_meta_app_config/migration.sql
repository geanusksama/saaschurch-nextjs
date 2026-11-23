-- WhatsApp Oficial (Meta): configuração central do app, linha única. Aditivo.
CREATE TABLE IF NOT EXISTS "meta_app_config" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "app_id" TEXT,
  "es_config_id" TEXT,
  "graph_version" TEXT,
  "webhook_verify_token" TEXT,
  "app_secret_cifrado" TEXT,
  "conexao_liberada" BOOLEAN NOT NULL DEFAULT false,
  "atualizado_por" UUID,
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "meta_app_config_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meta_app_config_linha_unica" CHECK ("id" = 1)
);

-- RLS sem política: só o servidor (service role) acessa.
ALTER TABLE "meta_app_config" ENABLE ROW LEVEL SECURITY;
