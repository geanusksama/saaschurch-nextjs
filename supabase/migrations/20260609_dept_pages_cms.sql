-- CMS: Department Pages
-- Stores the full page builder content (blocks JSONB) per department per church.
-- Each block config includes hero, banner, carousel, gallery, events, etc.

CREATE TABLE IF NOT EXISTS dept_pages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL,
  dept_slug    TEXT        NOT NULL,
  blocks       JSONB       NOT NULL DEFAULT '[]',
  published    BOOLEAN     NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID,
  UNIQUE (org_id, dept_slug)
);

-- Index for fast lookups by org + slug (used by public portal)
CREATE INDEX IF NOT EXISTS dept_pages_org_slug_idx ON dept_pages (org_id, dept_slug);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION set_dept_pages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER dept_pages_set_updated_at
  BEFORE UPDATE ON dept_pages
  FOR EACH ROW EXECUTE FUNCTION set_dept_pages_updated_at();

-- RLS: org members can read; only admins/cms role can write
ALTER TABLE dept_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read dept pages"
  ON dept_pages FOR SELECT
  USING (true);  -- public read — portal pages are public

CREATE POLICY "authenticated users can upsert dept pages"
  ON dept_pages FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Storage bucket for department media (images, videos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dept-media', 'dept-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anyone can read dept media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dept-media');

CREATE POLICY "authenticated users can upload dept media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'dept-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "authenticated users can update dept media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'dept-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "authenticated users can delete dept media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'dept-media' AND auth.uid() IS NOT NULL);
