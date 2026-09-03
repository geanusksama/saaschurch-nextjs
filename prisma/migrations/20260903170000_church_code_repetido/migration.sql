-- O código da igreja deixa de ser único.
--
-- O número que a secretaria usa se repete de propósito: Sede 1, Sede Brasil 1,
-- Sede UEA 1. É o mesmo caso do `rol` do membro, que já aceita repetição — o
-- número identifica a congregação dentro da relação de onde ela veio, não a
-- linha neste banco. Quem identifica a linha é o id.
--
-- Sai o índice único (a etapa anterior o havia ampliado para incluir o período,
-- o que ainda barrava duas igrejas de mesmo código no mesmo período) e entra um
-- índice comum, que serve à busca por regional + código sem impor regra.
--
-- Remover unicidade nunca invalida dado existente: tudo que passava antes
-- continua passando.

DROP INDEX IF EXISTS "churches_regional_id_code_periodo_key";
DROP INDEX IF EXISTS "churches_regional_id_code_key";

CREATE INDEX IF NOT EXISTS "churches_regional_id_code_idx"
    ON "churches" ("regional_id", "code");
