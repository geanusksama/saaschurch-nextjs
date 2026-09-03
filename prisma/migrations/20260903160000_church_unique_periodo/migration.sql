-- A igreja passa a ser identificada por código + período dentro da regional.
--
-- O unique era (regional_id, code). Com ele, a mesma congregação não conseguia
-- aparecer uma vez por período mantendo o número dela: a Sede é a congregação 1
-- de manhã, de tarde e de noite, e as três precisavam de código inventado
-- (01-T, 01-M, 01-N) só para caber na regra. O número da congregação é o que a
-- secretaria usa — ele tem que poder se repetir entre os períodos dela.
--
-- A regra nova é MAIS PERMISSIVA que a antiga: tudo que passava antes continua
-- passando, então nenhum banco existente tem dado que a viole.
--
-- NULLS NOT DISTINCT preserva a proteção de hoje para quem não tem período:
-- sem isso, o Postgres trataria cada NULL como valor distinto e duas igrejas
-- sem período poderiam repetir o mesmo código na mesma regional — exatamente o
-- que o unique antigo impedia.

DROP INDEX IF EXISTS "churches_regional_id_code_key";

CREATE UNIQUE INDEX IF NOT EXISTS "churches_regional_id_code_periodo_key"
    ON "churches" ("regional_id", "code", "periodo") NULLS NOT DISTINCT;
