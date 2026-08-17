-- ============================================================================
-- "Quero ser Membro" — separa a igreja QUE AVALIA da igreja EM QUE O MEMBRO ENTRA.
--
-- Regra do negócio: a pessoa escolhe a igreja em que quer se membrar (ex.:
-- Barão Geraldo). O pedido, porém, é analisado pela igreja SEDE do campo
-- daquela igreja (Campinas, no exemplo) — é a sede que entrevista e decide.
-- Aprovado, o membro é cadastrado na igreja que ELA escolheu, não na sede.
--
-- Antes desta coluna só havia `target_church_id`, e ele acumulava os dois
-- papéis: quem avalia e onde o membro nasce. Com uma escolha livre de igreja no
-- portal público, isso passaria a criar membro na congregação errada (ou a
-- mandar o pedido para a igreja que não faz entrevista).
--
--  - church_id / target_church_id → igreja SEDE, que avalia (e dona do card)
--  - desired_church_id            → igreja escolhida, onde o membro é criado
--
-- Aditiva: pedidos antigos ficam com desired_church_id nulo e continuam
-- entrando pela própria target_church_id, exatamente como antes.
-- ============================================================================

ALTER TABLE new_member_requests
  ADD COLUMN IF NOT EXISTS desired_church_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'new_member_requests_desired_church_id_fkey'
  ) THEN
    ALTER TABLE new_member_requests
      ADD CONSTRAINT new_member_requests_desired_church_id_fkey
      FOREIGN KEY (desired_church_id) REFERENCES churches (id);
  END IF;
END $$;

COMMENT ON COLUMN new_member_requests.desired_church_id IS
  'Igreja escolhida pela pessoa no portal público. A avaliação é da sede do campo (church_id/target_church_id); a aprovação cria o membro AQUI.';
