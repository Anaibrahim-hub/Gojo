-- Migrate favorites to use string listing IDs directly instead of a 32-bit hash.
-- Existing rows are dropped because the hash is one-way and cannot be remapped.
CREATE TABLE favorites_new (
  user_id     TEXT NOT NULL,
  property_id TEXT NOT NULL,
  PRIMARY KEY (user_id, property_id)
);

DROP TABLE favorites;
ALTER TABLE favorites_new RENAME TO favorites;

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_id);
