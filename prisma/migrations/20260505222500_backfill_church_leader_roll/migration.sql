WITH active_leader AS (
  SELECT DISTINCT ON (history.church_id)
    history.church_id,
    member.rol
  FROM church_function_history history
  JOIN church_function_catalog catalog
    ON catalog.id = history.function_id
  JOIN members member
    ON member.id = history.member_id
  WHERE history.deleted_at IS NULL
    AND history.is_active = TRUE
    AND history.end_date IS NULL
    AND COALESCE(catalog.is_leader_role, FALSE) = TRUE
  ORDER BY history.church_id, history.start_date DESC, history.created_at DESC
)
UPDATE churches church
SET leader_roll = active_leader.rol::text
FROM active_leader
WHERE church.id = active_leader.church_id
  AND active_leader.rol IS NOT NULL
  AND (church.leader_roll IS NULL OR BTRIM(church.leader_roll) = '');