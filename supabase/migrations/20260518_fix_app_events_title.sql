-- =============================================================
-- FIX: Sincroniza colunas legadas NOT NULL de app_events com os
-- campos canônicos usados pelo novo app (nome, data_inicio, data_fim)
-- Idempotente — pode ser executado várias vezes com segurança.
-- =============================================================

-- PASSO 0: Diagnóstico — lista todas as colunas NOT NULL sem default
-- (apenas informativo, não afeta execução)
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'app_events' AND is_nullable = 'NO'
-- ORDER BY ordinal_position;

-- =============================================================
-- PASSO 1: Adiciona colunas canônicas caso ainda não existam
-- =============================================================
ALTER TABLE app_events
  ADD COLUMN IF NOT EXISTS nome         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS data_inicio  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_fim     TIMESTAMPTZ;

-- =============================================================
-- PASSO 2: Copia valores das colunas legadas → canônicas (backfill)
-- =============================================================
UPDATE app_events
SET
  nome        = COALESCE(nome, title),
  data_inicio = COALESCE(data_inicio, start_at),
  data_fim    = COALESCE(data_fim,    end_at)
WHERE nome IS NULL OR data_inicio IS NULL OR data_fim IS NULL;

-- Sentido inverso: copia canônicas → legadas onde legadas forem NULL
UPDATE app_events
SET
  title    = COALESCE(title,    nome),
  start_at = COALESCE(start_at, data_inicio),
  end_at   = COALESCE(end_at,   data_fim)
WHERE title IS NULL OR start_at IS NULL OR end_at IS NULL;

-- =============================================================
-- PASSO 3: Torna colunas legadas nullable (eliminando a constraint
-- NOT NULL que causava os erros ao inserir via novo app)
-- Cada bloco usa DO...EXCEPTION para não falhar se coluna não existir.
-- =============================================================
DO $$ BEGIN
  ALTER TABLE app_events ALTER COLUMN title DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE app_events ALTER COLUMN start_at DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE app_events ALTER COLUMN end_at DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- Outras colunas legadas comuns que podem existir como NOT NULL:
DO $$ BEGIN
  ALTER TABLE app_events ALTER COLUMN description DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE app_events ALTER COLUMN location DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE app_events ALTER COLUMN event_type DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- =============================================================
-- PASSO 4: Garante que os campos canônicos do app sejam NOT NULL
-- (após o backfill do passo 2, todos já devem ter valor)
-- =============================================================
UPDATE app_events SET nome = '(sem título)' WHERE nome IS NULL;
ALTER TABLE app_events ALTER COLUMN nome SET NOT NULL;

-- data_inicio e data_fim só recebem NOT NULL se a coluna existir com dados
-- (não forçamos NOT NULL aqui para evitar falha em tabelas novas/vazias)
