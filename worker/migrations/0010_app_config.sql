CREATE TABLE IF NOT EXISTS app_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  min_ios_version TEXT NOT NULL DEFAULT '0.0.0',
  min_android_version TEXT NOT NULL DEFAULT '0.0.0',
  ios_store_url TEXT NOT NULL DEFAULT '',
  android_store_url TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO app_config (id, min_ios_version, min_android_version, ios_store_url, android_store_url, updated_at)
VALUES (1, '0.0.0', '0.0.0', '', '', 0);
