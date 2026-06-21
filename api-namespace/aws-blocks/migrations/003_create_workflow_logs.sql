-- 003_create_workflow_logs.sql
CREATE TABLE workflow_logs (
  id            TEXT PRIMARY KEY,
  ticket_id     TEXT NOT NULL,
  execution_arn TEXT,
  status        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
