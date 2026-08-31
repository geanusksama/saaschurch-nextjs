-- Gestão de Culto — horários de culto como cadastro real, POR IGREJA.
--
-- Migration ADITIVA: só cria uma tabela nova.
--
-- O culto da manhã e o da noite do mesmo dia já se distinguem por hora_inicio
-- (ver 20260827200000_culto_hora), mas quem lança tinha de digitar "09:00" de
-- memória a cada culto. Este cadastro dá nome ao horário ("Culto da manhã") e
-- guarda a hora, para o dropdown do fechamento preencher início e fim sozinho.
--
-- Isolamento: diferente das outras listas auxiliares, que são por campo, esta é
-- POR IGREJA (church_id) — o horário do culto é da congregação, e uma igreja
-- não pode ver nem editar o cadastro da outra. `campo_id` fica junto só para o
-- filtro de campo continuar valendo para quem administra o campo inteiro.
--
-- hora_inicio é VARCHAR(5) ("19:30") e não TIME de propósito: é o formato que o
-- <input type="time"> manda e lê, e o CRUD genérico das listas grava todo campo
-- não-numérico como texto.
--
-- Só a hora de INÍCIO é cadastrada: o fim do culto é uma hora depois, e quem
-- lança ajusta no formulário quando o culto se estende. Guardar um fim fixo
-- aqui só criaria mais um número para manter desatualizado.

CREATE TABLE IF NOT EXISTS "horario_culto" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "campo_id"    UUID,
    "church_id"   UUID,
    -- Estável; o nome pode ser renomeado depois sem quebrar nada.
    "codigo"      VARCHAR(60) NOT NULL,
    "nome"        VARCHAR(120) NOT NULL,
    "hora_inicio" VARCHAR(5),
    "descricao"   TEXT,
    "ordem"       INTEGER NOT NULL DEFAULT 0,
    "ativo"       BOOLEAN NOT NULL DEFAULT true,
    -- Pré-selecionado no formulário de lançamento daquela igreja.
    "is_default"  BOOLEAN NOT NULL DEFAULT false,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"  TIMESTAMPTZ,

    CONSTRAINT "horario_culto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "horario_culto_campo_id_idx" ON "horario_culto" ("campo_id");
CREATE INDEX IF NOT EXISTS "horario_culto_church_id_idx" ON "horario_culto" ("church_id");
CREATE INDEX IF NOT EXISTS "horario_culto_ativo_idx" ON "horario_culto" ("ativo");
-- Unicidade por IGREJA: duas igrejas podem ter o mesmo código "NOITE".
CREATE UNIQUE INDEX IF NOT EXISTS "horario_culto_codigo_unico"
    ON "horario_culto" ("church_id", "codigo") WHERE "deleted_at" IS NULL;

ALTER TABLE "horario_culto"
    ADD CONSTRAINT "horario_culto_campo_id_fkey" FOREIGN KEY ("campo_id")
    REFERENCES "campos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "horario_culto"
    ADD CONSTRAINT "horario_culto_church_id_fkey" FOREIGN KEY ("church_id")
    REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Semente: os três horários que toda igreja tem, UM CONJUNTO POR IGREJA, para
-- o dropdown do lançamento não nascer vazio. Cada igreja edita os seus depois —
-- as horas aqui são ponto de partida, não regra.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO "horario_culto" ("campo_id", "church_id", "codigo", "nome", "hora_inicio", "ordem", "is_default")
SELECT r."campo_id", ch."id", h.codigo, h.nome, h.hora_inicio, h.ordem, h.is_default
FROM "churches" ch
JOIN "regionais" r ON r."id" = ch."regional_id"
CROSS JOIN (VALUES
    ('MANHA', 'Culto da manhã', '09:00', 1, false),
    ('TARDE', 'Culto da tarde', '15:00', 2, false),
    ('NOITE', 'Culto da noite', '19:00', 3, true)
) AS h(codigo, nome, hora_inicio, ordem, is_default)
WHERE ch."deleted_at" IS NULL
ON CONFLICT DO NOTHING;
