-- Credor pode ser uma IGREJA.
--
-- O cadastro de credor já sabia representar pessoa física, pessoa jurídica e
-- membro (via `member_id`). Faltava a igreja: repasse, ajuda de custo e aluguel
-- entre igrejas são contas a pagar comuns, e sem esta coluna a igreja
-- favorecida era gravada só como texto no livro caixa, sem vínculo nenhum.
--
-- `favorecido_church_id` é o equivalente do `member_id` para esse caso. É a
-- igreja QUE RECEBE — não confundir com `church_id`, que é a igreja DONA do
-- cadastro (quem paga).
--
-- Migration puramente aditiva: coluna nula, sem default, sem backfill. Nenhum
-- credor existente muda de comportamento.

ALTER TABLE "credores"
  ADD COLUMN IF NOT EXISTS "favorecido_church_id" UUID;

-- ON DELETE SET NULL: apagar a igreja não pode derrubar o histórico de contas
-- a pagar que apontavam para ela.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credores_favorecido_church_id_fkey'
  ) THEN
    ALTER TABLE "credores"
      ADD CONSTRAINT "credores_favorecido_church_id_fkey"
      FOREIGN KEY ("favorecido_church_id") REFERENCES "churches"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "credores_favorecido_church_id_idx"
  ON "credores"("favorecido_church_id");
