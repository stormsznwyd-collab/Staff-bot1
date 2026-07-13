-- Generic per-guild key/value config store.
-- Used for channel IDs, category IDs, role IDs, etc. that get set later via /config.
CREATE TABLE IF NOT EXISTS config (
  guild_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (guild_id, key)
);

-- Per-command role whitelist. A command can have multiple allowed roles.
CREATE TABLE IF NOT EXISTS command_permissions (
  guild_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, command_name, role_id)
);

-- LOA records. active = 1 means currently on leave. History = rows where active = 0.
CREATE TABLE IF NOT EXISTS loa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  accepted_by TEXT NOT NULL,
  reason TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER,              -- NULL = indefinite
  active INTEGER NOT NULL DEFAULT 1,
  ended_at INTEGER,
  ended_by TEXT,                 -- user id who ended it early, or 'SYSTEM' for natural expiry / 'CLEAR_ALL'
  ended_early INTEGER DEFAULT 0
);

-- Staff strikes.
CREATE TABLE IF NOT EXISTS strikes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  strike_number INTEGER NOT NULL, -- 1 or 2 (or more, if you extend it)
  reason TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  issued_at INTEGER NOT NULL
);

-- Duty (clock in/out) sessions.
CREATE TABLE IF NOT EXISTS duty_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  clock_in INTEGER NOT NULL,
  clock_out INTEGER,             -- NULL = currently clocked in
  break_seconds INTEGER NOT NULL DEFAULT 0,
  on_break INTEGER NOT NULL DEFAULT 0,
  break_started_at INTEGER,
  auto_clocked_out INTEGER NOT NULL DEFAULT 0
);

-- Promotion / demotion history.
CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,          -- 'promote' or 'demote'
  roles_added TEXT,              -- comma separated role IDs
  roles_removed TEXT,            -- comma separated role IDs
  reason TEXT,
  actioned_by TEXT NOT NULL,
  actioned_at INTEGER NOT NULL
);

-- Persistent status panel message location, so it survives restarts.
CREATE TABLE IF NOT EXISTS status_panel (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL
);

-- Persistent duty board message location.
CREATE TABLE IF NOT EXISTS duty_board (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL
);

-- Ban appeals. status is one of: pending | accepted | denied | anticheat.
CREATE TABLE IF NOT EXISTS ban_appeals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ban_reason TEXT,
  appeal_text TEXT,
  evidence TEXT,
  detection TEXT,               -- anti-cheat detection type, if applicable
  appealable INTEGER DEFAULT 1, -- for anti-cheat: can it be appealed
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  reviewed_by TEXT,             -- staff user id of last decision
  decided_at INTEGER,
  decision_reason TEXT,
  cooldown_until INTEGER,       -- when the user may reapply (denied)
  channel_id TEXT,              -- management/review message location
  message_id TEXT
);

-- Informal staff notes (below the strike threshold).
CREATE TABLE IF NOT EXISTS staff_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  note TEXT NOT NULL,
  added_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Ban log. Records the original ban so appeals can reference it.
CREATE TABLE IF NOT EXISTS ban_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence TEXT,
  banned_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1  -- set 0 when lifted
);

-- Persistent blacklist registry.
CREATE TABLE IF NOT EXISTS blacklist (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT,
  added_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

-- Self-service LOA requests awaiting lead approval.
CREATE TABLE IF NOT EXISTS loa_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  duration_ms INTEGER,           -- NULL = indefinite
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | denied
  created_at INTEGER NOT NULL,
  decided_by TEXT,
  decided_at INTEGER,
  channel_id TEXT,
  message_id TEXT
);
