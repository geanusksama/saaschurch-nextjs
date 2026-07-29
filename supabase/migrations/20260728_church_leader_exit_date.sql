-- Troca de dirigente: data de saída do próprio dirigente empossado.
-- `previous_exit_date` já existia (saída do dirigente ANTERIOR); faltava registrar
-- o fim do mandato do dirigente que entrou — manual e opcional, em branco = em exercício.
ALTER TABLE "church_leader_history"
  ADD COLUMN IF NOT EXISTS "exit_date" DATE;
