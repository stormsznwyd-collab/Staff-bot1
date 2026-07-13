const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'bot.sqlite'));
db.pragma('journal_mode = WAL');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);
logger.success('Database initialized');

// ---------- Config helpers ----------
function setConfig(guildId, key, value) {
  db.prepare(
    `INSERT INTO config (guild_id, key, value) VALUES (?, ?, ?)
     ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value`
  ).run(guildId, key, String(value));
}

function getConfig(guildId, key, fallback = null) {
  const row = db.prepare(`SELECT value FROM config WHERE guild_id = ? AND key = ?`).get(guildId, key);
  return row ? row.value : fallback;
}

function getAllConfig(guildId) {
  return db.prepare(`SELECT key, value FROM config WHERE guild_id = ?`).all(guildId);
}

// ---------- Permission helpers ----------
function addCommandPermission(guildId, commandName, roleId) {
  db.prepare(
    `INSERT OR IGNORE INTO command_permissions (guild_id, command_name, role_id) VALUES (?, ?, ?)`
  ).run(guildId, commandName, roleId);
}

function removeCommandPermission(guildId, commandName, roleId) {
  db.prepare(
    `DELETE FROM command_permissions WHERE guild_id = ? AND command_name = ? AND role_id = ?`
  ).run(guildId, commandName, roleId);
}

function getCommandPermissions(guildId, commandName) {
  return db
    .prepare(`SELECT role_id FROM command_permissions WHERE guild_id = ? AND command_name = ?`)
    .all(guildId, commandName)
    .map((r) => r.role_id);
}

module.exports = {
  db,
  setConfig,
  getConfig,
  getAllConfig,
  addCommandPermission,
  removeCommandPermission,
  getCommandPermissions,
};
