CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL,
  voter TEXT NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 0, 1)),
  UNIQUE (post_id, voter)
);
CREATE INDEX IF NOT EXISTS votes_post ON votes(post_id);
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS comments (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  post_id TEXT NOT NULL,
  parent_id TEXT,
  voter TEXT NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  language TEXT NOT NULL CHECK(language IN ('fa', 'en')),
  created_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1))
);
CREATE INDEX IF NOT EXISTS comments_threads ON comments(post_id, parent_id, seq);
CREATE INDEX IF NOT EXISTS comments_replies ON comments(parent_id, seq);
