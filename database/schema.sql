CREATE TABLE IF NOT EXISTS guild_configs (
  guild_id TEXT PRIMARY KEY,

  -- Ticket system
  ticket_category TEXT,
  ticket_log_channel TEXT,
  transcript_channel TEXT,

  -- Temp VC system
  temp_vc_category TEXT,
  create_vc_channel TEXT,
  create_duo_channel TEXT,

  -- General
  prefix TEXT DEFAULT '!',

  -- Metadata
  setup_by TEXT,
  setup_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ticket_count (
  guild_id TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS noprefix_users (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  added_by TEXT,
  added_at TEXT,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS bot_owners (
  user_id TEXT PRIMARY KEY,
  added_by TEXT,
  added_at TEXT
);

CREATE TABLE IF NOT EXISTS afk_users (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT DEFAULT 'AFK',
  set_at TEXT NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS command_roles (
  guild_id TEXT NOT NULL,
  command TEXT NOT NULL,
  role_id TEXT NOT NULL,
  added_by TEXT,
  added_at TEXT,
  PRIMARY KEY (guild_id, command, role_id)
);
