-- Adiciona flag de caixa permanentemente aberto por igreja.
-- Quando true, o caixa da igreja fica sempre aberto e nunca é fechado/monitorado.
ALTER TABLE "churches" ADD COLUMN IF NOT EXISTS "cashbook_permanent_open" BOOLEAN NOT NULL DEFAULT false;
