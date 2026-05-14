-- Secretariat Kanban / Pipeline / Matrix migration
-- 3 levels: kan_pipelines (Secretaria) -> kan_stages (Batismo, Transferência...)
--          -> kan_columns (Pendente, Aprovado, Cancelado...)
-- Plus: kan_services (catalog), kan_matrix_rules (behavior matrix),
--      kan_cards (process instances), member_occurrences (history log)

-- =====================
-- kan_pipelines
-- =====================
CREATE TABLE "kan_pipelines" (
  "id"         SERIAL PRIMARY KEY,
  "name"       VARCHAR(120) NOT NULL,
  "type"       VARCHAR(120),
  "hash"       VARCHAR(60),
  "campo"      VARCHAR(120),
  "is_active"  BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- kan_services (catalog)
-- =====================
CREATE TABLE "kan_services" (
  "id"          INTEGER PRIMARY KEY,
  "sigla"       VARCHAR(50) NOT NULL,
  "description" VARCHAR(255) NOT NULL,
  "servico"     VARCHAR(120),
  "uses_matrix" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_active"   BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "kan_services_sigla_idx" ON "kan_services"("sigla");

-- =====================
-- kan_stages (Batismo, Transferência, Consagração...)
-- =====================
CREATE TABLE "kan_stages" (
  "id"          SERIAL PRIMARY KEY,
  "pipeline_id" INTEGER NOT NULL,
  "service_id"  INTEGER,
  "name"        VARCHAR(120) NOT NULL,
  "description" VARCHAR(255),
  "author"      VARCHAR(120),
  "campo"       VARCHAR(120),
  "hash"        VARCHAR(60),
  "show"        BOOLEAN NOT NULL DEFAULT TRUE,
  "is_active"   BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kan_stages_pipeline_fk" FOREIGN KEY ("pipeline_id") REFERENCES "kan_pipelines"("id") ON DELETE CASCADE,
  CONSTRAINT "kan_stages_service_fk"  FOREIGN KEY ("service_id")  REFERENCES "kan_services"("id")  ON DELETE SET NULL
);
CREATE INDEX "kan_stages_pipeline_id_idx" ON "kan_stages"("pipeline_id");
CREATE INDEX "kan_stages_service_id_idx"  ON "kan_stages"("service_id");

-- =====================
-- kan_columns (Pendente, Aprovado, Cancelado...)
-- =====================
CREATE TABLE "kan_columns" (
  "id"           SERIAL PRIMARY KEY,
  "stage_id"     INTEGER NOT NULL,
  "name"         VARCHAR(120) NOT NULL,
  "column_index" INTEGER NOT NULL,
  "color"        VARCHAR(20) DEFAULT 'blue',
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kan_columns_stage_fk" FOREIGN KEY ("stage_id") REFERENCES "kan_stages"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "kan_columns_stage_id_column_index_key" ON "kan_columns"("stage_id", "column_index");
CREATE INDEX "kan_columns_stage_id_idx" ON "kan_columns"("stage_id");

-- =====================
-- kan_matrix_rules (behavior matrix)
-- =====================
CREATE TABLE "kan_matrix_rules" (
  "id"                   SERIAL PRIMARY KEY,
  "service_id"           INTEGER NOT NULL,
  "column_index"         INTEGER NOT NULL,
  "age_min"              INTEGER NOT NULL DEFAULT 0,
  "age_max"              INTEGER NOT NULL DEFAULT 0,
  "is_active"            BOOLEAN NOT NULL DEFAULT TRUE,
  "change_status"        BOOLEAN NOT NULL DEFAULT FALSE,
  "new_status"           VARCHAR(60),
  "change_title"         BOOLEAN NOT NULL DEFAULT FALSE,
  "new_title"            VARCHAR(60),
  "does_transfer"        BOOLEAN NOT NULL DEFAULT FALSE,
  "insert_occurrence"    BOOLEAN NOT NULL DEFAULT TRUE,
  "occurrence_name"      VARCHAR(120),
  "message"              VARCHAR(255),
  "allow_message"        BOOLEAN NOT NULL DEFAULT FALSE,
  "allow_doc_model"      BOOLEAN NOT NULL DEFAULT FALSE,
  "doc_model"            VARCHAR(120),
  "allow_attachments"    BOOLEAN NOT NULL DEFAULT FALSE,
  "require_document"     BOOLEAN NOT NULL DEFAULT FALSE,
  "generates_credential" BOOLEAN NOT NULL DEFAULT FALSE,
  "credential_kind"      VARCHAR(60),
  "credential_model"     VARCHAR(60),
  "credential_validity"  VARCHAR(60),
  "servico_extra"        VARCHAR(60),
  "description"          VARCHAR(255),
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kan_matrix_rules_service_fk" FOREIGN KEY ("service_id") REFERENCES "kan_services"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "kan_matrix_rules_service_id_column_index_key" ON "kan_matrix_rules"("service_id", "column_index");
CREATE INDEX "kan_matrix_rules_service_id_idx" ON "kan_matrix_rules"("service_id");

-- =====================
-- kan_cards (process instances)
-- =====================
CREATE TABLE "kan_cards" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "protocol"              VARCHAR(60) NOT NULL,
  "stage_id"              INTEGER NOT NULL,
  "service_id"            INTEGER NOT NULL,
  "column_id"             INTEGER,
  "column_index"          INTEGER NOT NULL DEFAULT 1,
  "church_id"             UUID NOT NULL,
  "member_id"             UUID,
  "candidate_name"        VARCHAR(255),
  "status"                VARCHAR(60) NOT NULL DEFAULT 'pendente',
  "status_label"          VARCHAR(120),
  "destination_church_id" UUID,
  "current_title"         VARCHAR(60),
  "intended_title"        VARCHAR(60),
  "justification"         TEXT,
  "metadata"              JSONB,
  "attachments"           JSONB,
  "opened_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at"             TIMESTAMP(3),
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"            UUID,
  "updated_by"            UUID,
  "deleted_at"            TIMESTAMP(3),
  CONSTRAINT "kan_cards_stage_fk"        FOREIGN KEY ("stage_id")             REFERENCES "kan_stages"("id"),
  CONSTRAINT "kan_cards_service_fk"      FOREIGN KEY ("service_id")           REFERENCES "kan_services"("id"),
  CONSTRAINT "kan_cards_column_fk"       FOREIGN KEY ("column_id")            REFERENCES "kan_columns"("id") ON DELETE SET NULL,
  CONSTRAINT "kan_cards_church_fk"       FOREIGN KEY ("church_id")            REFERENCES "churches"("id")    ON DELETE CASCADE,
  CONSTRAINT "kan_cards_destination_fk"  FOREIGN KEY ("destination_church_id") REFERENCES "churches"("id"),
  CONSTRAINT "kan_cards_member_fk"       FOREIGN KEY ("member_id")            REFERENCES "members"("id")     ON DELETE SET NULL
);
CREATE UNIQUE INDEX "kan_cards_protocol_key" ON "kan_cards"("protocol");
CREATE INDEX "kan_cards_church_id_idx"        ON "kan_cards"("church_id");
CREATE INDEX "kan_cards_stage_id_status_idx"  ON "kan_cards"("stage_id", "status");
CREATE INDEX "kan_cards_service_id_idx"       ON "kan_cards"("service_id");
CREATE INDEX "kan_cards_opened_at_idx"        ON "kan_cards"("opened_at");

-- =====================
-- member_occurrences (history)
-- =====================
CREATE TABLE "member_occurrences" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "member_id"     UUID,
  "church_id"     UUID NOT NULL,
  "card_id"       UUID,
  "name"          VARCHAR(160) NOT NULL,
  "message"       VARCHAR(255),
  "service_sigla" VARCHAR(50),
  "column_index"  INTEGER,
  "metadata"      JSONB,
  "occurred_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"    UUID,
  CONSTRAINT "member_occurrences_member_fk" FOREIGN KEY ("member_id") REFERENCES "members"("id")  ON DELETE SET NULL,
  CONSTRAINT "member_occurrences_church_fk" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE,
  CONSTRAINT "member_occurrences_card_fk"   FOREIGN KEY ("card_id")   REFERENCES "kan_cards"("id") ON DELETE SET NULL
);
CREATE INDEX "member_occurrences_member_id_idx"             ON "member_occurrences"("member_id");
CREATE INDEX "member_occurrences_church_id_occurred_at_idx" ON "member_occurrences"("church_id", "occurred_at");
