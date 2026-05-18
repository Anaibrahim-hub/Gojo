-- Recreate listings with UUID primary key (so agents can have multiple rows)
-- and add listing_type / sale_price columns.

ALTER TABLE listings RENAME TO listings_old;

CREATE TABLE listings (
  id                 TEXT    PRIMARY KEY,   -- UUID for agent listings; uid for regular users (backward compat)
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
  listing_type       TEXT    NOT NULL DEFAULT 'rent',  -- 'rent' | 'sale'
  monthly_rent       REAL,
  sale_price         REAL,
  bedrooms           INTEGER,
  bathrooms          INTEGER,
  area_sqm           REAL,
  available_from     TEXT,
  description        TEXT,
  amenities          TEXT    NOT NULL DEFAULT '[]',
  photos             TEXT    NOT NULL DEFAULT '[]',
  status             TEXT    NOT NULL DEFAULT 'pending',
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  view_count         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_listings_owner_id ON listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_status   ON listings(status);

INSERT INTO listings (
  id, owner_id, owner_email, owner_display_name, owner_photo_url,
  city, sub_city, woreda, kebele, landmark,
  lat, lng, property_type,
  listing_type, monthly_rent, sale_price,
  bedrooms, bathrooms, area_sqm, available_from,
  description, amenities, photos, status,
  created_at, updated_at, view_count
)
SELECT
  id, owner_id, owner_email, owner_display_name, owner_photo_url,
  city, sub_city, woreda, kebele, landmark,
  lat, lng, property_type,
  'rent', monthly_rent, NULL,
  bedrooms, bathrooms, area_sqm, available_from,
  description, amenities, photos, status,
  created_at, updated_at, view_count
FROM listings_old;

DROP TABLE listings_old;

-- Agent registry: UIDs in this table get unlimited, auto-published listings.
CREATE TABLE IF NOT EXISTS agents (
  uid        TEXT    PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
