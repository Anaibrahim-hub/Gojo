CREATE TABLE IF NOT EXISTS favorites (
  user_id     TEXT    NOT NULL,
  property_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, property_id)
);
