-- CreateTable: member_title_history
CREATE TABLE "member_title_history" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id"      UUID NOT NULL,
    "church_id"      UUID NOT NULL,
    "card_id"        UUID,
    "previous_title" VARCHAR(120),
    "new_title"      VARCHAR(120) NOT NULL,
    "source"         VARCHAR(60),
    "service_group"  VARCHAR(60),
    "service_name"   VARCHAR(255),
    "member_city"    VARCHAR(100),
    "member_country" VARCHAR(100),
    "notes"          TEXT,
    "created_by"     UUID,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_title_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_title_history_member_id_idx" ON "member_title_history"("member_id");
CREATE INDEX "member_title_history_church_id_created_at_idx" ON "member_title_history"("church_id", "created_at");

-- AddForeignKey
ALTER TABLE "member_title_history" ADD CONSTRAINT "member_title_history_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member_title_history" ADD CONSTRAINT "member_title_history_church_id_fkey"
    FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
