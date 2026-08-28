-- Gerado por scripts/dump-baseline.mjs em 2026-08-28T05:01:11.765Z
-- Origem: saaschurch (estrutura apenas, sem dados de igreja)
-- Baseline 03e71297af6eae49

-- Views e materialized views
create or replace view "public"."pastoral_timeline" as
 SELECT pastoral_visits.id,
    pastoral_visits.church_id,
    pastoral_visits.member_id,
    'visit'::text AS type,
    pastoral_visits.title,
    COALESCE(pastoral_visits.notes, pastoral_visits.reason) AS description,
    COALESCE(pastoral_visits.scheduled_at, pastoral_visits.created_at) AS event_date,
    pastoral_visits.responsible_id::text AS responsible_name,
    pastoral_visits.status,
    jsonb_build_object('visit_type', pastoral_visits.visit_type, 'priority', pastoral_visits.priority) AS metadata
   FROM pastoral_visits
  WHERE pastoral_visits.deleted_at IS NULL
UNION ALL
 SELECT pastoral_counselings.id,
    pastoral_counselings.church_id,
    pastoral_counselings.member_id,
    'counseling'::text AS type,
    pastoral_counselings.title,
    COALESCE(pastoral_counselings.current_summary, pastoral_counselings.description) AS description,
    COALESCE(pastoral_counselings.started_at, pastoral_counselings.created_at) AS event_date,
    pastoral_counselings.counselor_id::text AS responsible_name,
    pastoral_counselings.status,
    jsonb_build_object('counseling_type', pastoral_counselings.counseling_type, 'priority', pastoral_counselings.priority) AS metadata
   FROM pastoral_counselings
  WHERE pastoral_counselings.deleted_at IS NULL
UNION ALL
 SELECT prayer_requests.id,
    prayer_requests.church_id,
    prayer_requests.member_id,
    'prayer_request'::text AS type,
    prayer_requests.title,
    prayer_requests.description,
    prayer_requests.created_at AS event_date,
    prayer_requests.created_by::text AS responsible_name,
    prayer_requests.status,
    jsonb_build_object('category', prayer_requests.category, 'priority', prayer_requests.priority) AS metadata
   FROM prayer_requests
  WHERE prayer_requests.deleted_at IS NULL
UNION ALL
 SELECT discipleships.id,
    discipleships.church_id,
    discipleships.member_id,
    'discipleship'::text AS type,
    COALESCE('Discipulado'::text, 'Discipulado'::text) AS title,
    discipleships.notes AS description,
    COALESCE(discipleships.started_at, discipleships.created_at) AS event_date,
    discipleships.discipler_id::text AS responsible_name,
    discipleships.status,
    jsonb_build_object('program_id', discipleships.program_id, 'progress_percent', discipleships.progress_percent) AS metadata
   FROM discipleships
  WHERE discipleships.deleted_at IS NULL;

