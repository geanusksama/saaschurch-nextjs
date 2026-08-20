-- Remove o unique antigo do nucleo familiar que sobrou no banco.
--
-- A migration 20260721160000_member_family_non_member tentou remove-lo com
-- ALTER TABLE ... DROP CONSTRAINT IF EXISTS "member_family_relationships_member_id_related_member_id_rela_key"
-- mas o Prisma cria @@unique como INDICE, nao como constraint de tabela, e o
-- nome real ficou truncado em "_rel_key". O comando nao encontrou nada, saiu
-- sem erro, e o indice unico continuou valendo — divergindo do schema, que ja
-- nao declara mais esse @@unique.
--
-- Sem isto, o par (member_id, related_member_id, relationship_type) segue
-- bloqueado no banco. Nao afeta familiar sem cadastro (related_member_id NULL
-- nao e deduplicado pelo Postgres), mas impede regravar um vinculo entre os
-- mesmos dois membros — e o schema diz que isso e permitido.
--
-- Os dois nomes estao aqui porque bancos criados em momentos diferentes podem
-- ter qualquer um dos dois truncamentos.
DROP INDEX IF EXISTS "member_family_relationships_member_id_related_member_id_rel_key";
DROP INDEX IF EXISTS "member_family_relationships_member_id_related_member_id_rela_key";
