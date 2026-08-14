-- Matriz de decisão: restaurar o título eclesiástico anterior do membro.
--
-- Motivo: na readmissão, a regra colocava um título FIXO (READMEM col2 = MEMBRO,
-- col3 = CONGREGADO). Quem já tinha sido pastor voltava como congregado, como se
-- nunca tivesse pertencido à igreja — foi o que aconteceu com um obreiro
-- readmitido em 12/08/2026.
--
-- Com a flag ligada, o título não vem de `new_title`: vem do MAIOR título que o
-- membro já teve, lido do histórico. `new_title` continua servindo de rede de
-- segurança para quem não tem histórico nenhum.
--
-- É uma flag na regra, não uma regra fixa por sigla de serviço: a igreja liga
-- onde fizer sentido sem depender de deploy.

ALTER TABLE "kan_matrix_rules"
    ADD COLUMN IF NOT EXISTS "restore_previous_title" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "kan_matrix_rules"."restore_previous_title" IS
    'Quando true e change_title também true, o novo título vem do maior título do histórico do membro; new_title vira apenas o fallback.';
