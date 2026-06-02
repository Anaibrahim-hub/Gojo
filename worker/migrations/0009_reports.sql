CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK(target_type IN ('listing', 'user')),
  target_id TEXT NOT NULL,
  reporter_uid TEXT NOT NULL,
  reporter_email TEXT,
  reason TEXT NOT NULL CHECK(reason IN ('spam', 'misleading', 'unavailable', 'copyright')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'resolved', 'dismissed')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
