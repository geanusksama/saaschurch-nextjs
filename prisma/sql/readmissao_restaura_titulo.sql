-- Liga a restauração de título nas 3 readmissões, na coluna "Aprovado".
--
-- Estado anterior (medido em 13/08/2026):
--   READMEM col2  troca=true   fixo=MEMBRO      → quem já foi pastor virava MEMBRO
--   READOBR col2  troca=false  —                → título não mudava; ficava o que
--                                                 estava, em geral CONGREGADO
--   READOMN col2  troca=false  —                → idem
--
-- Agora as três buscam o ÚLTIMO título do histórico do membro. O `new_title`
-- continua gravado como rede de segurança: só é usado quando o membro não tem
-- nenhum título reconhecível no histórico — situação que, na prática, significa
-- que ele nunca foi membro e não deveria estar sendo readmitido.
--
-- A coluna 3 ("Readmissão cancelada") NÃO é tocada de propósito: ali o processo
-- foi recusado, então não há título a restaurar.

UPDATE "kan_matrix_rules" r
SET "change_title"           = true,
    "restore_previous_title" = true,
    "new_title"              = COALESCE(r."new_title", 'CONGREGADO')
FROM "kan_services" s
WHERE s."id" = r."service_id"
  AND s."sigla" IN ('READMEM', 'READOBR', 'READOMN')
  AND r."column_index" = 2;
