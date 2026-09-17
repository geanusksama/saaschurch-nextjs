-- Numeração de dízimo por bloco de recibo.
--
-- Migration ADITIVA: três tabelas novas e uma coluna anulável no plano de
-- contas. Nada existente muda de forma, então a igreja que ainda não usa o
-- recurso não sente o deploy.
--
-- O PROBLEMA QUE ISTO RESOLVE
-- A igreja recebe talões de recibo físicos e o tesoureiro precisa amarrar cada
-- dízimo lançado ao número do recibo que entregou. Até aqui o `num_doc` do
-- livro caixa era texto livre e opcional: nada impedia dois lançamentos com o
-- mesmo recibo, nem o uso de um número que aquela igreja nunca recebeu.
--
-- POR QUE UMA LINHA POR NÚMERO, E NÃO SÓ A FAIXA
-- Guardar "bloco 100, do 1 ao 100" em uma linha deixaria a pergunta do dia a
-- dia ("quais sobraram?") sem resposta direta: seria varrer o livro caixa
-- inteiro atrás dos num_doc já gastos e subtrair em JavaScript — o mesmo
-- padrão que já derrubou o board da Secretaria. Materializando a cartela, a
-- pergunta vira um count por status, e gastar um número vira
-- `UPDATE ... WHERE status = 'LIVRE'`, que é atômico: dois tesoureiros salvando
-- no mesmo segundo não levam o mesmo recibo.
--
-- POR QUE church_id DESCE ATÉ dizimo_numeros
-- É a razão de existir do módulo: o número 100 da Sede e o 100 de uma
-- congregação são recibos diferentes, e nenhuma das duas pode ver ou gastar o
-- número da outra. O unique (church_id, numero) é o que garante isso no banco
-- — e, de quebra, impede que dois blocos da mesma igreja tenham faixas
-- sobrepostas.

CREATE TABLE IF NOT EXISTS "dizimo_blocos" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "church_id"      UUID         NOT NULL,
    "numero_bloco"   INTEGER      NOT NULL,
    "numero_inicial" INTEGER      NOT NULL,
    "numero_final"   INTEGER      NOT NULL,
    "observacao"     TEXT,
    "ativo"          BOOLEAN      NOT NULL DEFAULT true,
    "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "created_by"     UUID,
    "deleted_at"     TIMESTAMPTZ(6),
    CONSTRAINT "dizimo_blocos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "dizimo_numeros" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "bloco_id"       UUID         NOT NULL,
    -- Repetido do bloco de propósito: é a coluna do unique que isola a igreja.
    "church_id"      UUID         NOT NULL,
    "numero"         INTEGER      NOT NULL,
    -- LIVRE | RESERVADO | USADO. RESERVADO é o estado curto entre "mandou
    -- salvar" e "entrou no livro caixa"; a rota de liberar desfaz.
    "status"         VARCHAR(20)  NOT NULL DEFAULT 'LIVRE',
    "livro_caixa_id" UUID,
    "usado_em"       TIMESTAMPTZ(6),
    "usado_por"      UUID,
    "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "dizimo_numeros_pkey" PRIMARY KEY ("id")
);

-- Liga/desliga a exigência igreja por igreja. Nasce desligada porque os talões
-- chegam aos poucos: travar todo mundo no dia do deploy pararia a tesouraria
-- de quem ainda não recebeu bloco.
CREATE TABLE IF NOT EXISTS "dizimo_numeracao_config" (
    "church_id"  UUID         NOT NULL,
    "exige"      BOOLEAN      NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_by" UUID,
    CONSTRAINT "dizimo_numeracao_config_pkey" PRIMARY KEY ("church_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dizimo_blocos_church_id_numero_bloco_key"
    ON "dizimo_blocos" ("church_id", "numero_bloco");
CREATE INDEX IF NOT EXISTS "dizimo_blocos_church_id_numero_inicial_idx"
    ON "dizimo_blocos" ("church_id", "numero_inicial");

CREATE UNIQUE INDEX IF NOT EXISTS "dizimo_numeros_church_id_numero_key"
    ON "dizimo_numeros" ("church_id", "numero");
-- Um lançamento carrega no máximo um recibo. Sem isto, um erro de confirmação
-- poderia pendurar dois números no mesmo dízimo.
CREATE UNIQUE INDEX IF NOT EXISTS "dizimo_numeros_livro_caixa_id_key"
    ON "dizimo_numeros" ("livro_caixa_id");
CREATE INDEX IF NOT EXISTS "dizimo_numeros_bloco_id_status_idx"
    ON "dizimo_numeros" ("bloco_id", "status");
CREATE INDEX IF NOT EXISTS "dizimo_numeros_church_id_status_idx"
    ON "dizimo_numeros" ("church_id", "status");

ALTER TABLE "dizimo_blocos"
    DROP CONSTRAINT IF EXISTS "dizimo_blocos_church_id_fkey";
ALTER TABLE "dizimo_blocos"
    ADD CONSTRAINT "dizimo_blocos_church_id_fkey" FOREIGN KEY ("church_id")
    REFERENCES "churches" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dizimo_numeros"
    DROP CONSTRAINT IF EXISTS "dizimo_numeros_bloco_id_fkey";
ALTER TABLE "dizimo_numeros"
    ADD CONSTRAINT "dizimo_numeros_bloco_id_fkey" FOREIGN KEY ("bloco_id")
    REFERENCES "dizimo_blocos" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dizimo_numeros"
    DROP CONSTRAINT IF EXISTS "dizimo_numeros_church_id_fkey";
ALTER TABLE "dizimo_numeros"
    ADD CONSTRAINT "dizimo_numeros_church_id_fkey" FOREIGN KEY ("church_id")
    REFERENCES "churches" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, não CASCADE: lançamento excluído devolve o número para a cartela
-- em vez de apagar o número junto — o talão físico continua existindo.
ALTER TABLE "dizimo_numeros"
    DROP CONSTRAINT IF EXISTS "dizimo_numeros_livro_caixa_id_fkey";
ALTER TABLE "dizimo_numeros"
    ADD CONSTRAINT "dizimo_numeros_livro_caixa_id_fkey" FOREIGN KEY ("livro_caixa_id")
    REFERENCES "livro_caixa" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dizimo_numeracao_config"
    DROP CONSTRAINT IF EXISTS "dizimo_numeracao_config_church_id_fkey";
ALTER TABLE "dizimo_numeracao_config"
    ADD CONSTRAINT "dizimo_numeracao_config_church_id_fkey" FOREIGN KEY ("church_id")
    REFERENCES "churches" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Qual plano de contas exige o número.
--
-- NÃO dá para reaproveitar `considera_dizimo`: na base de origem essa coluna
-- está true também em "01.211 - OFERTAS", porque ela responde "entra no
-- relatório de dizimistas", que é outra pergunta. Fica anulável de propósito:
-- NULL significa "ninguém opinou" e o código cai na regra pelo nome do plano
-- (dízimo sim, oferta não), senão a função nasceria desligada em toda igreja
-- que nunca abrir a tela de Plano de Contas.
ALTER TABLE "plano_de_contas"
    ADD COLUMN IF NOT EXISTS "exige_numeracao_bloco" BOOLEAN;
