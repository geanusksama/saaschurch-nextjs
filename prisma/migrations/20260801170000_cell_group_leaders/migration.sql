-- Líderes do GF: quase sempre é um casal, e um campo só (cell_groups.leader_id)
-- não comportava. Migration ADITIVA — `leader_id` continua existindo e passa a
-- valer como o líder PRINCIPAL (position 0), que é quem recebe a mensagem.

CREATE TABLE IF NOT EXISTS "cell_group_leaders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cell_group_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cell_group_leaders_pkey" PRIMARY KEY ("id")
);

-- a mesma pessoa não entra duas vezes como líder do mesmo GF
CREATE UNIQUE INDEX IF NOT EXISTS "cell_group_leaders_cell_group_id_member_id_key"
    ON "cell_group_leaders" ("cell_group_id", "member_id");

CREATE INDEX IF NOT EXISTS "cell_group_leaders_cell_group_id_idx"
    ON "cell_group_leaders" ("cell_group_id");

ALTER TABLE "cell_group_leaders"
    ADD CONSTRAINT "cell_group_leaders_cell_group_id_fkey"
    FOREIGN KEY ("cell_group_id") REFERENCES "cell_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cell_group_leaders"
    ADD CONSTRAINT "cell_group_leaders_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: quem já era líder no campo antigo vira o líder principal na tabela
-- nova, para nenhum GF existente aparecer sem líder na tela.
INSERT INTO "cell_group_leaders" ("cell_group_id", "member_id", "position")
SELECT "id", "leader_id", 0
FROM "cell_groups"
WHERE "leader_id" IS NOT NULL
ON CONFLICT ("cell_group_id", "member_id") DO NOTHING;
