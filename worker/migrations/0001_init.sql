CREATE TABLE IF NOT EXISTS listings (
  id                 TEXT    PRIMARY KEY,   -- Firebase UID (one listing per user)
  owner_id           TEXT    NOT NULL,
  owner_email        TEXT,
  owner_display_name TEXT,
  owner_photo_url    TEXT,
  city               TEXT,
  sub_city           TEXT,
  woreda             TEXT,
  kebele             TEXT,
  landmark           TEXT,
  lat                REAL,
  lng                REAL,
  property_type      TEXT,
  monthly_rent       REAL,
  bedrooms           INTEGER,
  bathrooms          INTEGER,
  area_sqm           REAL,
  available_from     TEXT,
  description        TEXT,
  amenities          TEXT    NOT NULL DEFAULT '[]',   -- JSON array
  photos             TEXT    NOT NULL DEFAULT '[]',   -- JSON array [{url,key}]
  status             TEXT    NOT NULL DEFAULT 'pending',
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
