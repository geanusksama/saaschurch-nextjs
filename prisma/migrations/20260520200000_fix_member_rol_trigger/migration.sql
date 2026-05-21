-- Migration: Fix members.rol — replace broken autoincrement sequence with
-- a BEFORE INSERT trigger that always uses MAX(rol)+1 when no value is provided.
-- Manual inserts are preserved as-is; future automatics pick up from the new max.

-- ─── Step 1: Remove the broken nextval default ────────────────────────────────
ALTER TABLE "members" ALTER COLUMN "rol" DROP DEFAULT;

-- ─── Step 2: Sync members_rol_seq to the current highest rol ──────────────────
-- Keeps the sequence object consistent in case any monitoring tool references it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'members_rol_seq'
  ) THEN
    PERFORM setval(
      'members_rol_seq',
      COALESCE((SELECT MAX(rol) FROM members WHERE rol IS NOT NULL), 0)
    );
  END IF;
END $$;

-- ─── Step 3: Trigger function ─────────────────────────────────────────────────
-- Uses a transaction-scoped advisory lock to prevent duplicate ROL values
-- under concurrent inserts (lock is released automatically when the TX ends).
CREATE OR REPLACE FUNCTION members_set_rol_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rol IS NULL THEN
    -- Serialize concurrent inserts that also have rol = NULL
    PERFORM pg_advisory_xact_lock(hashtext('members_rol_autoincrement'));

    SELECT COALESCE(MAX(rol), 0) + 1
      INTO NEW.rol
      FROM members;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Step 4: Attach trigger to members table ──────────────────────────────────
DROP TRIGGER IF EXISTS trg_members_set_rol ON members;

CREATE TRIGGER trg_members_set_rol
  BEFORE INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION members_set_rol_on_insert();

-- ─── Step 5: Índice de performance no rol (sem unicidade) ───────────────────
-- O ROL não é único globalmente nem por campo — membros recadastrados em campos
-- diferentes podem ter o mesmo número. O índice existe apenas para otimizar buscas.
CREATE INDEX IF NOT EXISTS "idx_members_rol"
  ON "members" ("rol");
