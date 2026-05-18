CREATE TABLE IF NOT EXISTS contact_info (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  office_hours TEXT,
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

INSERT OR IGNORE INTO contact_info (id) VALUES (1);
