-- OPCIONAL — NÃO roda sozinho. Execute só se quiser que as trocas de dirigente
-- JÁ registradas apareçam na aba "Histórico" do perfil dos membros envolvidos.
--
-- A partir do deploy, toda nova troca (e toda edição) grava a ocorrência sozinha.
-- Este script apenas preenche o passado. É idempotente: relê `leaderHistoryId` no
-- metadata e não duplica o que já existe.

BEGIN;

-- Entrada: quem assumiu a dirigência.
INSERT INTO member_event_history (
  id, member_id, church_id, service_group, service_name, action, notes, metadata, created_at
)
SELECT
  gen_random_uuid(),
  h.new_leader_member_id,
  h.church_id,
  'DIRIGENTE',
  'Troca de Dirigente',
  'ASSUMIU A DIRIGENCIA',
  concat_ws(' · ',
    nullif(concat('Função: ', f.name), 'Função: '),
    nullif(concat('Igreja: ', c.name), 'Igreja: '),
    concat('Entrada: ', to_char(h.entry_date, 'DD/MM/YYYY')),
    nullif(concat('Indicado por: ', h.indicated_by), 'Indicado por: '),
    nullif(concat('Motivo: ', h.change_reason), 'Motivo: ')
  ),
  jsonb_build_object(
    'source', 'TROCA_DIRIGENTE',
    'movement', 'ENTRADA',
    'leaderHistoryId', h.id::text,
    'functionName', f.name,
    'entryDate', to_char(h.entry_date, 'YYYY-MM-DD'),
    'backfill', true
  ),
  h.created_at
FROM church_leader_history h
JOIN churches c ON c.id = h.church_id
LEFT JOIN church_function_catalog f ON f.id = h.function_id
WHERE h.new_leader_member_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM member_event_history e
    WHERE e.service_group = 'DIRIGENTE'
      AND e.metadata->>'leaderHistoryId' = h.id::text
      AND e.metadata->>'movement' = 'ENTRADA'
  );

-- Saída: quem deixou a dirigência (só quando há data de saída registrada).
INSERT INTO member_event_history (
  id, member_id, church_id, service_group, service_name, action, notes, metadata, created_at
)
SELECT
  gen_random_uuid(),
  h.previous_leader_member_id,
  h.church_id,
  'DIRIGENTE',
  'Troca de Dirigente',
  'DEIXOU A DIRIGENCIA',
  concat_ws(' · ',
    nullif(concat('Função: ', f.name), 'Função: '),
    nullif(concat('Igreja: ', c.name), 'Igreja: '),
    concat('Saída: ', to_char(h.previous_exit_date, 'DD/MM/YYYY')),
    nullif(concat('Motivo: ', h.change_reason), 'Motivo: ')
  ),
  jsonb_build_object(
    'source', 'TROCA_DIRIGENTE',
    'movement', 'SAIDA',
    'leaderHistoryId', h.id::text,
    'functionName', f.name,
    'exitDate', to_char(h.previous_exit_date, 'YYYY-MM-DD'),
    'backfill', true
  ),
  h.created_at
FROM church_leader_history h
JOIN churches c ON c.id = h.church_id
LEFT JOIN church_function_catalog f ON f.id = h.function_id
WHERE h.previous_leader_member_id IS NOT NULL
  AND h.previous_exit_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM member_event_history e
    WHERE e.service_group = 'DIRIGENTE'
      AND e.metadata->>'leaderHistoryId' = h.id::text
      AND e.metadata->>'movement' = 'SAIDA'
  );

COMMIT;
