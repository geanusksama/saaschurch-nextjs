-- Horários de culto: a hora de término volta a ser cadastrada.
--
-- Migration ADITIVA: uma coluna anulável.
--
-- Quando o cadastro nasceu, o fim era calculado (início + 1h) para não haver
-- um número a mais para manter. Na prática cada culto tem a sua duração — a
-- EBD da manhã não dura o mesmo que a vigília —, e quem lança repetia a
-- correção toda semana. Agora o cadastro guarda início e fim, o lançamento vem
-- preenchido com os dois, e quem lança só mexe quando aquele culto fugiu do
-- combinado.
--
-- Quem já cadastrou horário fica com o fim em branco: o lançamento continua
-- caindo no início + 1h até alguém preencher.

ALTER TABLE "horario_culto"
    ADD COLUMN IF NOT EXISTS "hora_fim" VARCHAR(5);
