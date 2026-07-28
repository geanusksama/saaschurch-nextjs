-- ============================================================================
-- Cronograma de Acompanhamento — v3: fechamento do ciclo.
--
-- Quando a última mensagem do mês sai, o acompanhamento se encerra sozinho:
-- o card vai para CONCLUÍDO e a pessoa recebe o Certificado de Acolhimento em
-- PDF. O certificado é gerado sob demanda pela URL pública (nada é gravado em
-- disco — em serverless o arquivo não sobreviveria à próxima invocação).
-- ============================================================================

ALTER TABLE pastoral_journeys
  -- emitir e enviar o certificado ao fim da jornada
  ADD COLUMN IF NOT EXISTS issue_certificate boolean NOT NULL DEFAULT true,
  -- mover o card para a coluna CONCLUÍDO ao fim da jornada
  ADD COLUMN IF NOT EXISTS complete_card_on_finish boolean NOT NULL DEFAULT true,
  -- texto que acompanha o certificado ({{nome}} e {{link}} são substituídos)
  ADD COLUMN IF NOT EXISTS certificate_message text;

ALTER TABLE pastoral_journey_enrollments
  -- carimbo de emissão: garante que o certificado saia UMA vez só, mesmo se
  -- o cron reprocessar a inscrição
  ADD COLUMN IF NOT EXISTS certificate_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
