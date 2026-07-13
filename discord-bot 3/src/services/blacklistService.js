const { db } = require('../database/db');

function addToBlacklist(guildId, userId, reason, addedBy) {
  db.prepare(
    `INSERT INTO blacklist (guild_id, user_id, reason, added_by, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET reason = excluded.reason, added_by = excluded.added_by, created_at = excluded.created_at`
  ).run(guildId, userId, reason || null, addedBy, Date.now());
}

function removeFromBlacklist(guildId, userId) {
  const info = db.prepare(`DELETE FROM blacklist WHERE guild_id = ? AND user_id = ?`).run(guildId, userId);
  return info.changes > 0;
}

function getBlacklistEntry(guildId, userId) {
  return db.prepare(`SELECT * FROM blacklist WHERE guild_id = ? AND user_id = ?`).get(guildId, userId);
}

function isBlacklisted(guildId, userId) {
  return Boolean(getBlacklistEntry(guildId, userId));
}

function getBlacklist(guildId) {
  return db.prepare(`SELECT * FROM blacklist WHERE guild_id = ? ORDER BY created_at DESC`).all(guildId);
}

module.exports = { addToBlacklist, removeFromBlacklist, getBlacklistEntry, isBlacklisted, getBlacklist };
