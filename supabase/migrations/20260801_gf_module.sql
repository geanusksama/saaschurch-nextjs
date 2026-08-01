-- Módulo GF (Grupos Familiares): endereço estruturado do GF, tag por GF,
-- vínculo de contato importado com o GF e link público de resumo.
--
-- O GF tinha só `address` em texto livre. Sem os campos separados o
-- LocationPicker (CEP → mapa) não tem onde gravar, e a distância até o membro
-- não sai. `address` continua existindo e passa a guardar o rótulo montado,
-- para não quebrar as telas que já leem esse campo.
--
-- Tudo aditivo e com IF NOT EXISTS: pode rodar em produção com o sistema no ar.

-- ── Endereço estruturado do GF ───────────────────────────────────────────────
ALTER TABLE "cell_groups" ADD COLUMN IF NOT EXISTS "address_street"       VARCHAR(255);
ALTER TABLE "cell_groups" ADD COLUMN IF NOT EXISTS "address_number"       VARCHAR(20);
ALTER TABLE "cell_groups" ADD COLUMN IF NOT EXISTS "address_complement"   VARCHAR(100);
ALTER TABLE "cell_groups" ADD COLUMN IF NOT EXISTS "address_neighborhood" VARCHAR(100);
ALTER TABLE "cell_groups" ADD COLUMN IF NOT EXISTS "address_city"         VARCHAR(100);
ALTER TABLE "cell_groups" ADD COLUMN IF NOT EXISTS "address_state"        VARCHAR(50);
ALTER TABLE "cell_groups" ADD COLUMN IF NOT EXISTS "address_zipcode"      VARCHAR(10);

-- `color` e `photo` já existiam no schema.prisma mas nunca chegaram ao banco:
-- o formulário antigo enviava os dois e a rota descartava, então ninguém viu.
ALTER TABLE "cell_groups" ADD COLUMN IF NOT EXISTS "color" VARCHAR(50);
ALTER TABLE "cell_groups" ADD COLUMN IF NOT EXISTS "photo" TEXT;

-- ── Tag vinculada a um GF ────────────────────────────────────────────────────
-- Tag criada junto com o GF morre junto com ele (CASCADE); tag avulsa da
-- secretaria (Pastor, Diácono...) fica com cell_group_id NULL e sobrevive.
ALTER TABLE "member_tags" ADD COLUMN IF NOT EXISTS "cell_group_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_tags_cell_group_id_fkey'
  ) THEN
    ALTER TABLE "member_tags"
      ADD CONSTRAINT "member_tags_cell_group_id_fkey"
      FOREIGN KEY ("cell_group_id") REFERENCES "cell_groups" ("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "member_tags_cell_group_idx" ON "member_tags" ("cell_group_id");

-- ── Contato importado vinculado a um GF ──────────────────────────────────────
-- É o que impede o mesmo contato de entrar em dois GFs e o que permite
-- filtrar "quem ainda está sem GF" na lista importada.
ALTER TABLE whatsapp_import_rows ADD COLUMN IF NOT EXISTS cell_group_id          uuid;
ALTER TABLE whatsapp_import_rows ADD COLUMN IF NOT EXISTS cell_group_assigned_at timestamptz;
ALTER TABLE whatsapp_import_rows ADD COLUMN IF NOT EXISTS cell_group_assigned_by text;

CREATE INDEX IF NOT EXISTS idx_wa_import_rows_cell_group
  ON whatsapp_import_rows (cell_group_id);
CREATE INDEX IF NOT EXISTS idx_wa_import_rows_sem_gf
  ON whatsapp_import_rows (batch_id)
  WHERE cell_group_id IS NULL;

-- ── Um vínculo ATIVO por pessoa/GF (e não um histórico de um item só) ────────
-- A constraint antiga era UNIQUE (cell_group_id, member_id, is_active). No
-- Postgres o `false` também é valor, então ela permitia apenas UMA saída: quem
-- saísse do GF, voltasse e saísse de novo batia em violação de unicidade. O
-- índice parcial diz o que se queria desde o começo — a trava vale só para o
-- vínculo ativo, e o histórico de entradas e saídas fica livre.
DROP INDEX IF EXISTS "cell_group_members_cell_group_id_member_id_is_active_key";

CREATE UNIQUE INDEX IF NOT EXISTS "cell_group_members_active_unique"
  ON "cell_group_members" ("cell_group_id", "member_id")
  WHERE "is_active";

-- ── Link público do resumo enviado ao líder ──────────────────────────────────
-- Um registro por pessoa anexada. O líder recebe o token no WhatsApp e abre o
-- resumo sem login — por isso o token é aleatório e é a única chave de acesso.
CREATE TABLE IF NOT EXISTS cell_group_share_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token         uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  cell_group_id uuid NOT NULL,
  member_id     text,
  import_row_id uuid,
  contact_name  text,
  contact_phone text NOT NULL,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cell_group_share_links_token
  ON cell_group_share_links (token);
CREATE INDEX IF NOT EXISTS idx_cell_group_share_links_group
  ON cell_group_share_links (cell_group_id, created_at DESC);
