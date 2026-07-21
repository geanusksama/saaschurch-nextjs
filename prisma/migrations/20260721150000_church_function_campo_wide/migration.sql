-- Alcance da função: por padrão vale só para a igreja em church_id.
-- Quando is_campo_wide = true, a função abrange todo o campo da igreja.
-- Usado pelo switch "Abrange todo o campo" no cadastro de função pelo perfil do membro.
ALTER TABLE "church_function_history"
  ADD COLUMN IF NOT EXISTS "is_campo_wide" BOOLEAN NOT NULL DEFAULT false;
