-- Gestão de Culto — a observação do Pastor Presidente.
--
-- Migration ADITIVA: uma coluna anulável.
--
-- O culto já carrega o recado de cada nível: o tesoureiro e o secretário
-- escrevem em culto_lancamentos.observacao ("a oferta do sábado veio junto"), e
-- o dirigente da congregação e o da hospedeira registram o porquê da decisão em
-- culto_aprovacoes.motivo. Faltava o topo da árvore: o presidente do campo lê
-- tudo isso e não tinha onde deixar a palavra dele, que é justamente a que
-- fecha o assunto nos relatórios.
--
-- Fica no registro, e não numa aprovação, porque o presidente não é um nível de
-- aprovação do fluxo (só existem LOCAL e HOSPEDEIRA) — ele comenta o culto,
-- aprovado ou não.

ALTER TABLE "culto_registros"
    ADD COLUMN IF NOT EXISTS "observacao_presidente" TEXT;
