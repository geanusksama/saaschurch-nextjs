-- Localidade do membro e distância até a igreja na troca de dirigente.
--
-- O membro passa a ter coordenadas próprias, no mesmo formato já usado em
-- `churches` (Decimal 10,8 / 11,8) — assim o cálculo de distância compara
-- grandezas iguais e o mapa aceita os dois lados sem conversão.
--
-- `church_leader_history.distance_km` guarda a distância CONGELADA no momento
-- da posse, não recalculada na hora de ler o relatório: o membro muda de
-- endereço, a igreja muda de sede, e o relatório de uma posse de 2019 tem que
-- continuar mostrando a distância daquela época.
--
-- Tudo aditivo e com IF NOT EXISTS: pode rodar em produção com o sistema no ar.

ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "latitude"  DECIMAL(10, 8);
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(11, 8);

ALTER TABLE "church_leader_history" ADD COLUMN IF NOT EXISTS "distance_km" DECIMAL(8, 2);

-- Consulta típica do mapa: "quem tem coordenada nesta igreja".
CREATE INDEX IF NOT EXISTS "members_church_coords_idx"
  ON "members" ("church_id")
  WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
