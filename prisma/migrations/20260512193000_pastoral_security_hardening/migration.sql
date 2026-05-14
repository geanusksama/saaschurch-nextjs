CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_claims jsonb;
BEGIN
  BEGIN
    v_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'user';
  END;

  RETURN lower(COALESCE(v_claims->>'app_role', v_claims->>'role', 'user'));
END;
$$;

CREATE OR REPLACE FUNCTION app.is_leadership()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app.current_user_role() IN ('admin', 'pastor', 'leader', 'lider');
$$;

CREATE OR REPLACE FUNCTION app.log_pastoral_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_church_id uuid;
  v_user_id uuid;
  v_entity_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_church_id := OLD.church_id;
    v_entity_id := OLD.id;
  ELSE
    v_church_id := NEW.church_id;
    v_entity_id := NEW.id;
  END IF;

  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  INSERT INTO pastoral_audit_logs (
    church_id,
    entity_type,
    entity_id,
    action,
    old_data,
    new_data,
    user_id,
    created_by,
    updated_by
  ) VALUES (
    v_church_id,
    TG_TABLE_NAME,
    v_entity_id,
    lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    v_user_id,
    v_user_id,
    v_user_id
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS counseling_granular_select ON pastoral_counselings;
CREATE POLICY counseling_granular_select
ON pastoral_counselings
FOR SELECT
USING (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND (
    app.is_leadership()
    OR counselor_id = auth.uid()
    OR created_by = auth.uid()
    OR (NOT is_confidential)
  )
);

DROP POLICY IF EXISTS counseling_granular_write ON pastoral_counselings;
CREATE POLICY counseling_granular_write
ON pastoral_counselings
FOR ALL
USING (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND (
    app.is_leadership()
    OR counselor_id = auth.uid()
    OR created_by = auth.uid()
  )
)
WITH CHECK (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND (
    app.is_leadership()
    OR counselor_id = auth.uid()
    OR created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS counseling_sessions_granular_select ON pastoral_counseling_sessions;
CREATE POLICY counseling_sessions_granular_select
ON pastoral_counseling_sessions
FOR SELECT
USING (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND EXISTS (
    SELECT 1
    FROM pastoral_counselings c
    WHERE c.id = counseling_id
      AND c.deleted_at IS NULL
      AND (
        app.is_leadership()
        OR c.counselor_id = auth.uid()
        OR c.created_by = auth.uid()
        OR (NOT c.is_confidential)
      )
  )
);

DROP POLICY IF EXISTS counseling_sessions_granular_write ON pastoral_counseling_sessions;
CREATE POLICY counseling_sessions_granular_write
ON pastoral_counseling_sessions
FOR ALL
USING (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND EXISTS (
    SELECT 1
    FROM pastoral_counselings c
    WHERE c.id = counseling_id
      AND c.deleted_at IS NULL
      AND (
        app.is_leadership()
        OR c.counselor_id = auth.uid()
        OR c.created_by = auth.uid()
      )
  )
)
WITH CHECK (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND EXISTS (
    SELECT 1
    FROM pastoral_counselings c
    WHERE c.id = counseling_id
      AND c.deleted_at IS NULL
      AND (
        app.is_leadership()
        OR c.counselor_id = auth.uid()
        OR c.created_by = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS prayer_visibility_select ON prayer_requests;
CREATE POLICY prayer_visibility_select
ON prayer_requests
FOR SELECT
USING (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND (
    visibility = 'public'
    OR app.is_leadership()
    OR created_by = auth.uid()
    OR member_id = auth.uid()
  )
);

DROP POLICY IF EXISTS prayer_visibility_write ON prayer_requests;
CREATE POLICY prayer_visibility_write
ON prayer_requests
FOR ALL
USING (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND (
    app.is_leadership()
    OR created_by = auth.uid()
  )
)
WITH CHECK (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND (
    app.is_leadership()
    OR created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS discipleship_granular_select ON discipleships;
CREATE POLICY discipleship_granular_select
ON discipleships
FOR SELECT
USING (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND (
    app.is_leadership()
    OR discipler_id = auth.uid()
    OR created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS discipleship_granular_write ON discipleships;
CREATE POLICY discipleship_granular_write
ON discipleships
FOR ALL
USING (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND (
    app.is_leadership()
    OR discipler_id = auth.uid()
    OR created_by = auth.uid()
  )
)
WITH CHECK (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND (
    app.is_leadership()
    OR discipler_id = auth.uid()
    OR created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS visits_granular_select ON pastoral_visits;
CREATE POLICY visits_granular_select
ON pastoral_visits
FOR SELECT
USING (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND (
    app.is_leadership()
    OR responsible_id = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM pastoral_visit_participants p
      WHERE p.visit_id = id
        AND p.user_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  )
);

DROP POLICY IF EXISTS visits_granular_write ON pastoral_visits;
CREATE POLICY visits_granular_write
ON pastoral_visits
FOR ALL
USING (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND (
    app.is_leadership()
    OR responsible_id = auth.uid()
    OR created_by = auth.uid()
  )
)
WITH CHECK (
  (app.current_church_id() IS NULL OR church_id = app.current_church_id())
  AND (
    app.is_leadership()
    OR responsible_id = auth.uid()
    OR created_by = auth.uid()
  )
);

DROP TRIGGER IF EXISTS trg_audit_pastoral_visits ON pastoral_visits;
CREATE TRIGGER trg_audit_pastoral_visits
AFTER INSERT OR UPDATE OR DELETE ON pastoral_visits
FOR EACH ROW EXECUTE FUNCTION app.log_pastoral_audit();

DROP TRIGGER IF EXISTS trg_audit_pastoral_counselings ON pastoral_counselings;
CREATE TRIGGER trg_audit_pastoral_counselings
AFTER INSERT OR UPDATE OR DELETE ON pastoral_counselings
FOR EACH ROW EXECUTE FUNCTION app.log_pastoral_audit();

DROP TRIGGER IF EXISTS trg_audit_pastoral_counseling_sessions ON pastoral_counseling_sessions;
CREATE TRIGGER trg_audit_pastoral_counseling_sessions
AFTER INSERT OR UPDATE OR DELETE ON pastoral_counseling_sessions
FOR EACH ROW EXECUTE FUNCTION app.log_pastoral_audit();

DROP TRIGGER IF EXISTS trg_audit_prayer_requests ON prayer_requests;
CREATE TRIGGER trg_audit_prayer_requests
AFTER INSERT OR UPDATE OR DELETE ON prayer_requests
FOR EACH ROW EXECUTE FUNCTION app.log_pastoral_audit();

DROP TRIGGER IF EXISTS trg_audit_discipleships ON discipleships;
CREATE TRIGGER trg_audit_discipleships
AFTER INSERT OR UPDATE OR DELETE ON discipleships
FOR EACH ROW EXECUTE FUNCTION app.log_pastoral_audit();

DROP TRIGGER IF EXISTS trg_audit_discipleship_programs ON discipleship_programs;
CREATE TRIGGER trg_audit_discipleship_programs
AFTER INSERT OR UPDATE OR DELETE ON discipleship_programs
FOR EACH ROW EXECUTE FUNCTION app.log_pastoral_audit();

DROP TRIGGER IF EXISTS trg_audit_discipleship_meetings ON discipleship_meetings;
CREATE TRIGGER trg_audit_discipleship_meetings
AFTER INSERT OR UPDATE OR DELETE ON discipleship_meetings
FOR EACH ROW EXECUTE FUNCTION app.log_pastoral_audit();
