-- Event-wide settings. Currently one key: when the hunt opens.
--
-- A table rather than a Worker var because it is changed during the event, by
-- a person, from the console — a var means a redeploy, and "start the hunt" is
-- the one action that must not wait on a deploy pipeline.
--
-- Key/value rather than a one-row table with a column per setting: the next
-- thing an organiser wants to flip mid-event is not knowable now, and adding a
-- row is not a migration.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
