-- Gestão de Culto — o culto passa a ter HORA, não só data.
--
-- Sem hora não dá para consolidar por período de verdade ("cultos da manhã",
-- "o que entrou entre 19h e 22h") nem para separar dois cultos do mesmo dia.
--
-- Consequência importante: a chave única era (church_id, data_culto,
-- tipo_culto), o que IMPEDIA registrar o culto da manhã e o da noite do mesmo
-- domingo com o mesmo tipo. A hora entra na chave e destrava isso.
--
-- Migration ADITIVA nas colunas; a única troca é o índice de unicidade.
-- Os 340 registros existentes ficam com hora NULL de propósito: carimbar um
-- horário inventado em cima deles seria fabricar informação. A UI mostra
-- "não informada" e o filtro por hora simplesmente não os alcança.

ALTER TABLE "culto_registros" ADD COLUMN IF NOT EXISTS "hora_inicio" TIME;
ALTER TABLE "culto_registros" ADD COLUMN IF NOT EXISTS "hora_fim"    TIME;

-- Índice do filtro por hora e da consolidação por faixa de horário.
CREATE INDEX IF NOT EXISTS "culto_registros_data_hora_idx"
    ON "culto_registros" ("data_culto", "hora_inicio");

-- Troca da unicidade: a hora passa a fazer parte da identidade do culto.
-- COALESCE mantém o comportamento antigo para as linhas sem hora (duas linhas
-- sem hora, mesma igreja/data/tipo, continuam sendo duplicata).
DROP INDEX IF EXISTS "culto_registros_church_id_data_culto_tipo_culto_key";

CREATE UNIQUE INDEX IF NOT EXISTS "culto_registros_church_data_tipo_hora_key"
    ON "culto_registros" (
        "church_id",
        "data_culto",
        "tipo_culto",
        (COALESCE("hora_inicio", TIME '00:00'))
    )
    WHERE "deleted_at" IS NULL;
