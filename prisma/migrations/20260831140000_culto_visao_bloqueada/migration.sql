-- Gestão de Culto — cadeado de visão por nó do organograma.
--
-- Migration ADITIVA: cria uma tabela nova, nada é alterado.
--
-- A hierarquia do módulo é uma árvore: tesoureiro e secretário lançam, o
-- dirigente da congregação vê o que eles mandaram, o dirigente da hospedeira vê
-- os dirigentes abaixo dele e, no topo, o presidente do campo vê tudo. Até aqui
-- cada nó enxergava os valores de todos os nós abaixo, sem exceção — ver os
-- números vinha colado no papel (ver cultoScope.ts).
--
-- Nem toda igreja quer isso: o dízimo de uma congregação não é necessariamente
-- assunto da hospedeira. Esta tabela é o interruptor: uma linha aqui significa
-- "o dirigente DESTE nó não vê os valores lançados abaixo dele". Ele continua
-- enxergando os cultos, o status, o que falta enviar e continua aprovando — o
-- que some são os números, podados no servidor por podarLancamentos().
--
-- O cadeado é do presidente do campo (e do master): é quem enxerga a árvore
-- inteira no organograma e tem como decidir.

CREATE TABLE IF NOT EXISTS "culto_visao_bloqueada" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "campo_id"   UUID,
    -- O nó bloqueado. É sempre uma igreja: hospedeira ou congregação.
    "church_id"  UUID NOT NULL,
    /* Quais blocos ficam escondidos. Guardado como texto para o dia em que
       alguém quiser esconder só o financeiro e deixar a presença à vista. */
    "blocos"     VARCHAR(20)[] NOT NULL DEFAULT ARRAY['FINANCEIRO','PRESENCA','EXTRA']::VARCHAR(20)[],
    "motivo"     TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "culto_visao_bloqueada_pkey" PRIMARY KEY ("id")
);

-- Um nó só pode estar bloqueado uma vez.
CREATE UNIQUE INDEX IF NOT EXISTS "culto_visao_bloqueada_church_unico"
    ON "culto_visao_bloqueada" ("church_id");
CREATE INDEX IF NOT EXISTS "culto_visao_bloqueada_campo_idx"
    ON "culto_visao_bloqueada" ("campo_id");

ALTER TABLE "culto_visao_bloqueada"
    ADD CONSTRAINT "culto_visao_bloqueada_church_fkey" FOREIGN KEY ("church_id")
    REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "culto_visao_bloqueada"
    ADD CONSTRAINT "culto_visao_bloqueada_campo_fkey" FOREIGN KEY ("campo_id")
    REFERENCES "campos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "culto_visao_bloqueada"
    ADD CONSTRAINT "culto_visao_bloqueada_user_fkey" FOREIGN KEY ("created_by")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
