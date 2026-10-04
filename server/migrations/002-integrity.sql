CREATE SEQUENCE content_version_seq AS INTEGER MAXVALUE 2147483647 NO CYCLE;
ALTER TABLE categories ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;
DO $$
DECLARE content_table TEXT;
BEGIN
  FOREACH content_table IN ARRAY ARRAY['products','categories','tasks','banners','site_settings'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN version INTEGER NOT NULL DEFAULT nextval(''content_version_seq''), ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), ADD COLUMN updated_by UUID REFERENCES admin_users(id)', content_table);
  END LOOP;
END $$;
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES admin_users(id),
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update','delete')),
  changes JSONB NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX audit_log_entity_idx ON audit_log(entity, entity_id, id DESC);
CREATE INDEX audit_log_actor_idx ON audit_log(actor_id, id DESC);
CREATE INDEX audit_log_created_idx ON audit_log(created_at);
