-- The public /listings query is `WHERE status = ? ORDER BY created_at DESC`.
-- The single-column idx_listings_status (0005) filters by status but still forces
-- a sort for the ORDER BY. A composite (status, created_at DESC) index lets D1
-- satisfy filter + ordering from one index scan with no sort step — important for
-- cache-miss / revalidation latency from the single-region D1 primary.
CREATE INDEX IF NOT EXISTS idx_listings_status_created
  ON listings (status, created_at DESC);
