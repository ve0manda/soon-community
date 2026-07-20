const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'app.db'));
db.pragma('journal_mode = WAL');

// ----- Schema -----
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  display_name TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  background_url TEXT DEFAULT '',
  background_type TEXT DEFAULT 'color', -- color | image | video
  audio_url TEXT DEFAULT '',
  bg_color TEXT DEFAULT '#0d0a0c',
  accent_color TEXT DEFAULT '#a01c2c',
  text_color TEXT DEFAULT '#ffffff',
  effect TEXT DEFAULT 'particles', -- none | particles | snow | matrix
  cursor_effect TEXT DEFAULT 'none', -- none | trail | glow
  views INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT DEFAULT 'link',
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

// ----- Migrations: add new columns if the DB already existed before this update -----
const userColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
function addColumnIfMissing(name, ddl) {
  if (!userColumns.includes(name)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${ddl}`);
  }
}
addColumnIfMissing('is_admin', 'is_admin INTEGER DEFAULT 0');
addColumnIfMissing('is_premium', 'is_premium INTEGER DEFAULT 0');
addColumnIfMissing('is_verified', 'is_verified INTEGER DEFAULT 0');
addColumnIfMissing('premium_since', "premium_since TEXT DEFAULT NULL");
addColumnIfMissing('discord_id', 'discord_id TEXT');
addColumnIfMissing('discord_username', "discord_username TEXT DEFAULT ''");
addColumnIfMissing('discord_avatar', "discord_avatar TEXT DEFAULT ''");
addColumnIfMissing('google_id', 'google_id TEXT');
addColumnIfMissing('google_email', "google_email TEXT DEFAULT ''");
addColumnIfMissing('google_avatar', "google_avatar TEXT DEFAULT ''");
addColumnIfMissing('avatar_type', "avatar_type TEXT DEFAULT 'image'");

module.exports = db;
