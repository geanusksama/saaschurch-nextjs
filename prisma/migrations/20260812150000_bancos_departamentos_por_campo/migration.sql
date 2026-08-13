-- Bancos e Departamentos: código de busca + isolamento por campo.
--
-- Duas mudanças pedidas depois da primeira versão:
--
-- 1. CÓDIGO DE BUSCA. Cada registro ganha um código curto e digitável
--    ("01", "02"), para o operador achar por "01-bradesco" em vez de rolar a
--    lista. É TEXTO, não inteiro: o identificador de verdade continua sendo o
--    UUID, e texto aceita "001", "CX-01" e o que a igreja quiser usar.
--
--    Em `bancos`, a coluna `codigo` era o número FEBRABAN. Ela passa a ser o
--    código de busca, e o FEBRABAN vai para `codigo_febraban` — são coisas
--    diferentes: o FEBRABAN identifica a instituição (341 = Itaú), o código de
--    busca identifica a CONTA dentro da igreja (01 = Itaú c/c 12345).
--
-- 2. ISOLAMENTO POR CAMPO. Banco e departamento de um campo não podem aparecer
--    para outro. Ganham `campo_id` com FK, e o código é único DENTRO do campo —
--    cada campo tem o seu "01".
--
-- Migration aditiva. Só há 1 banco e 1 departamento cadastrados (as sementes),
-- e nenhum lançamento aponta para eles ainda, então a redistribuição por campo
-- abaixo não afeta dado real.

-- ─── 1. Colunas novas ────────────────────────────────────────────────────────

ALTER TABLE "bancos"        ADD COLUMN IF NOT EXISTS "campo_id" UUID;
ALTER TABLE "departamentos" ADD COLUMN IF NOT EXISTS "campo_id" UUID;

-- O FEBRABAN sai de cima de `codigo`, que agora é o código de busca.
ALTER TABLE "bancos" ADD COLUMN IF NOT EXISTS "codigo_febraban" VARCHAR(10);
UPDATE "bancos" SET "codigo_febraban" = "codigo" WHERE "codigo_febraban" IS NULL AND "codigo" IS NOT NULL;
UPDATE "bancos" SET "codigo" = NULL;

DO $$ BEGIN
    ALTER TABLE "bancos"
        ADD CONSTRAINT "bancos_campo_id_fkey"
        FOREIGN KEY ("campo_id") REFERENCES "campos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "departamentos"
        ADD CONSTRAINT "departamentos_campo_id_fkey"
        FOREIGN KEY ("campo_id") REFERENCES "campos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "bancos_campo_id_idx"        ON "bancos" ("campo_id");
CREATE INDEX IF NOT EXISTS "departamentos_campo_id_idx" ON "departamentos" ("campo_id");

-- ─── 2. Sementes por campo ───────────────────────────────────────────────────
-- As duas sementes globais viram uma por campo: cada campo precisa do próprio
-- padrão, senão o lançamento de um campo nasceria apontando para o caixa de
-- outro. Apaga as globais (nenhum lançamento as referencia) e recria.

DELETE FROM "bancos"        WHERE "campo_id" IS NULL AND "is_default" = true;
DELETE FROM "departamentos" WHERE "campo_id" IS NULL AND "is_default" = true;

INSERT INTO "bancos" ("campo_id", "codigo", "nome", "tipo_conta", "ativo", "is_default")
SELECT c."id", '01', 'Caixa (espécie)', 'CAIXA_ESPECIE', true, true
FROM "campos" c
WHERE NOT EXISTS (
    SELECT 1 FROM "bancos" b WHERE b."campo_id" = c."id" AND b."is_default" = true
);

INSERT INTO "departamentos" ("campo_id", "codigo", "nome", "tipo", "ordem", "cor", "ativo", "is_default")
SELECT c."id", '01', 'Geral (Igreja)', 'GERAL', 0, '#64748b', true, true
FROM "campos" c
WHERE NOT EXISTS (
    SELECT 1 FROM "departamentos" d WHERE d."campo_id" = c."id" AND d."is_default" = true
);

-- ─── 3. Código único dentro do campo ─────────────────────────────────────────
-- Cada campo tem o seu "01". Índice parcial porque código é opcional — um
-- registro sem código não deve colidir com outro sem código.

CREATE UNIQUE INDEX IF NOT EXISTS "bancos_campo_codigo_key"
    ON "bancos" ("campo_id", "codigo") WHERE "codigo" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "departamentos_campo_codigo_key"
    ON "departamentos" ("campo_id", "codigo") WHERE "codigo" IS NOT NULL;
