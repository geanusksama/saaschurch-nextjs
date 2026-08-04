-- Distribuição inteligente de contatos importados para o GF mais próximo.
--
-- A análise (achar o endereço, geocodificar, escolher o GF) é cara: depende de
-- IA para ler a conversa e de serviços externos (ViaCEP e Nominatim, este
-- limitado a ~1 req/s). Por isso o resultado fica GRAVADO na própria linha da
-- lista importada — reabrir a tela não refaz o trabalho, e o botão "Analisar"
-- só cuida de quem ainda não foi analisado.
--
-- Aditiva: nenhuma coluna existente muda de tipo ou some.

ALTER TABLE whatsapp_import_rows
  -- endereço encontrado, já em texto pronto para mostrar na tela
  ADD COLUMN IF NOT EXISTS address_text        text,
  ADD COLUMN IF NOT EXISTS address_zipcode     text,
  -- 'arquivo'  = veio nas colunas do CSV importado
  -- 'conversa' = a IA achou no que a pessoa escreveu no WhatsApp
  ADD COLUMN IF NOT EXISTS address_source      text,
  -- mesma precisão de churches/cell_groups, para o Haversine comparar os três
  ADD COLUMN IF NOT EXISTS latitude            numeric(10, 8),
  ADD COLUMN IF NOT EXISTS longitude           numeric(11, 8),
  -- resultado da análise, para a tela montar o par "pessoa → GF"
  ADD COLUMN IF NOT EXISTS suggested_cell_group_id uuid REFERENCES cell_groups (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suggested_distance_km   numeric(8, 3),
  ADD COLUMN IF NOT EXISTS analyzed_at         timestamptz,
  -- por que não deu para sugerir (sem endereço, CEP inválido, sem GF com
  -- coordenada...). Fica visível na tela em vez de a pessoa sumir calada.
  ADD COLUMN IF NOT EXISTS analysis_note       text;

-- A tela lista "quem tem sugestão e ainda não foi conectado" — este é o
-- caminho quente. Índice parcial porque a maioria das linhas não tem sugestão.
CREATE INDEX IF NOT EXISTS idx_import_rows_sugestao
  ON whatsapp_import_rows (suggested_cell_group_id)
  WHERE suggested_cell_group_id IS NOT NULL AND cell_group_id IS NULL;

-- "Quem falta analisar", usado pelo botão Analisar.
CREATE INDEX IF NOT EXISTS idx_import_rows_sem_analise
  ON whatsapp_import_rows (batch_id)
  WHERE analyzed_at IS NULL;
