-- Contas a Pagar passa a classificar despesa pelo PLANO DE CONTAS existente.
--
-- Correção de rumo. A primeira versão criou `tipos_despesa` como cadastro
-- próprio, mas `plano_de_contas` já tem 47 entradas de DESPESA em uso —
-- 02.148 LUZ, 02.149 ÁGUA, 02.153 ALUGUEL, 02.210 MISSÕES, 02.169 AJUDA DE
-- CUSTO e por aí vai. Manter os dois obrigaria a tesouraria a cadastrar a
-- mesma coisa duas vezes, e as listas divergiriam: o Livro Caixa gravaria por
-- um critério e o relatório de contas a pagar somaria por outro.
--
-- Seguro apagar: `tipos_despesa` e `contas_pagar` estão com 0 linhas — as duas
-- tabelas foram criadas hoje e nada foi lançado ainda.

ALTER TABLE "contas_pagar" ADD COLUMN IF NOT EXISTS "plano_de_conta_id" UUID;

DO $$ BEGIN
    ALTER TABLE "contas_pagar"
        ADD CONSTRAINT "contas_pagar_plano_de_conta_id_fkey"
        FOREIGN KEY ("plano_de_conta_id") REFERENCES "plano_de_contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "contas_pagar_plano_de_conta_id_idx"
    ON "contas_pagar" ("plano_de_conta_id");

-- Sai o vínculo com o cadastro duplicado.
ALTER TABLE "contas_pagar" DROP CONSTRAINT IF EXISTS "contas_pagar_tipo_despesa_id_fkey";
ALTER TABLE "contas_pagar" DROP COLUMN IF EXISTS "tipo_despesa_id";

DROP TABLE IF EXISTS "tipos_despesa";
