-- Optional walkthrough video per listing, stored in R2.
-- JSON {"url": "...", "key": "listings/<uid>/<uuid>.mp4"} or NULL.
ALTER TABLE listings ADD COLUMN video TEXT;
