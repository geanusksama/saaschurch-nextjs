-- Um ministro transferido pode existir em mais de um campo no mesmo banco.
DROP INDEX IF EXISTS "conamad_ministros_conamad_id_key";
DROP INDEX IF EXISTS "conamad_ministros_matricula_key";
DROP INDEX IF EXISTS "conamad_anuidades_conamad_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "conamad_ministros_campo_id_conamad_id_key" ON "conamad_ministros"("campo_id", "conamad_id");
CREATE UNIQUE INDEX IF NOT EXISTS "conamad_ministros_campo_id_matricula_key" ON "conamad_ministros"("campo_id", "matricula");
CREATE UNIQUE INDEX IF NOT EXISTS "conamad_anuidades_campo_id_conamad_id_key" ON "conamad_anuidades"("campo_id", "conamad_id");
