-- AlterTable
ALTER TABLE "churches" ADD COLUMN     "current_leader_name" VARCHAR(255),
ADD COLUMN     "current_leader_role" VARCHAR(255),
ADD COLUMN     "current_leader_role_date" DATE,
ADD COLUMN     "document_number" VARCHAR(50),
ADD COLUMN     "document_type" VARCHAR(30),
ADD COLUMN     "entry_date" DATE,
ADD COLUMN     "exit_date" DATE,
ADD COLUMN     "has_own_temple" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hash" VARCHAR(100),
ADD COLUMN     "leader_roll" VARCHAR(50),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "parent_church_id" UUID,
ADD COLUMN     "plate_name" VARCHAR(255),
ADD COLUMN     "whatsapp" VARCHAR(20);

-- AddForeignKey
ALTER TABLE "churches" ADD CONSTRAINT "churches_parent_church_id_fkey" FOREIGN KEY ("parent_church_id") REFERENCES "churches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
