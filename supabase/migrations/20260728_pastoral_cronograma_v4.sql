-- ============================================================================
-- Cronograma v4 — anexos de mídia por mensagem da matriz.
--
-- Cada mensagem (etapa × grupo) pode levar:
--   image_url     → imagem enviada como ANEXO, com o texto virando legenda
--   youtube_url   → link do vídeo do YouTube, acrescentado ao fim do texto
--   instagram_url → link do vídeo/post do Instagram, idem
--   link_url      → link livre (já existia)
-- Tudo opcional. É o que faz a etapa "Conteúdo digital" da semana 2 funcionar
-- de verdade, em vez de só falar do vídeo sem mandar o vídeo.
-- ============================================================================

ALTER TABLE pastoral_journey_messages
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text;

ALTER TABLE pastoral_journey_sends
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text;
