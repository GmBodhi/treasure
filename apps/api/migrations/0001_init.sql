-- Treasure AR schema.
--
-- Two shapes of data with genuinely different needs:
--
--   experiences  a handful of documents, read whole, edited rarely. The marker
--                list is arbitrary nested JSON (overlay trees), so it stays a
--                JSON column rather than being shredded into tables nothing
--                would ever query across.
--   scans        append-only, unbounded, and the only thing anyone aggregates.
--                Real columns, so the summary is a GROUP BY on the database
--                instead of every scan ever recorded being pulled into memory.

CREATE TABLE IF NOT EXISTS experiences (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tracking    TEXT NOT NULL DEFAULT '{}',  -- JSON object
  markers     TEXT NOT NULL DEFAULT '[]',  -- JSON array
  target_file TEXT,
  updated_at  TEXT NOT NULL
);

-- Compiled .mind bundles, split across rows.
--
-- D1 caps a single BLOB at 2 MB and the app accepts uploads up to 10 MB, so a
-- target cannot be one row. Chunks are fixed-size and ordered by `seq`; the
-- reader concatenates them back into the original bytes.
CREATE TABLE IF NOT EXISTS target_chunks (
  experience_id TEXT NOT NULL,
  seq           INTEGER NOT NULL,
  bytes         BLOB NOT NULL,
  PRIMARY KEY (experience_id, seq),
  FOREIGN KEY (experience_id) REFERENCES experiences(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scans (
  id            TEXT PRIMARY KEY,
  experience_id TEXT NOT NULL,
  marker_id     TEXT,
  target_index  INTEGER,
  session_id    TEXT,
  dwell_ms      INTEGER,
  user_agent    TEXT,
  at            TEXT NOT NULL
);

-- Every scan query filters by experience and orders by time.
CREATE INDEX IF NOT EXISTS scans_by_experience_at ON scans (experience_id, at DESC);
