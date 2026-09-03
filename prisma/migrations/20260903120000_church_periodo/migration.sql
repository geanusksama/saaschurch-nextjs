-- Congregação passa a guardar o período do culto.
--
-- Migration ADITIVA: uma coluna anulável.
--
-- Na relação de congregações do campo, a mesma congregação pode aparecer mais
-- de uma vez, uma linha por período de culto: a Sede tem tarde, manhã e noite
-- sob o mesmo número, com o mesmo dirigente. Sem esta coluna as três viram
-- linhas indistinguíveis em `churches`, e o unique (regional_id, code) obriga
-- a inventar código diferente sem dizer o porquê.
--
-- Domínio observado na base de origem: T (tarde), M (manhã), N (noite) e 0
-- (congregação sem período próprio). Fica VARCHAR sem CHECK porque a origem é
-- planilha e um valor novo não pode derrubar a importação.

ALTER TABLE "churches"
    ADD COLUMN IF NOT EXISTS "periodo" VARCHAR(10);
