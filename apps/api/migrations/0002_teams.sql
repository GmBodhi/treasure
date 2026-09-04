-- Shared team state.
--
-- A team is several phones, not one. Before this, progress lived in one
-- device's localStorage and a teammate's phone knew nothing about it — which
-- is fine for a solo run and useless the moment two people split up to cover
-- more ground. These two tables are what the phones agree through.
--
-- Progress is deliberately NOT a column. It is derived from `completions` as
-- MAX(level) + 1, so there is exactly one place a level can be recorded and no
-- way for a cached counter to drift from the rows it was counted from. Two
-- teammates scanning the same marker within a second of each other both write
-- the same primary key; the second is a no-op instead of a double-increment.

CREATE TABLE IF NOT EXISTS teams (
  code       TEXT PRIMARY KEY,  -- normalised: uppercase, alphanumeric only
  name       TEXT NOT NULL,
  -- Stored as typed. This is a wristband number handed out at registration to
  -- stop team BC-03 opening team BC-04's run, not a credential — the organiser
  -- has to be able to read it back out to a team that lost their slip, and
  -- hashing it would only make that impossible while protecting nothing.
  pin        TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS completions (
  team_code  TEXT NOT NULL,
  level      INTEGER NOT NULL,
  -- Which of the level's two stations they actually found, and which phone
  -- reported it. Audit only: both come from the client, so they are for an
  -- organiser reading the table after a dispute, never for a decision the
  -- server makes.
  station_id TEXT,
  device_id  TEXT,
  at         TEXT NOT NULL,
  PRIMARY KEY (team_code, level),
  FOREIGN KEY (team_code) REFERENCES teams(code) ON DELETE CASCADE
);

-- The leaderboard groups by team and takes the latest time in each group.
CREATE INDEX IF NOT EXISTS completions_by_team_at ON completions (team_code, at);
