const { db } = require('../database/db');

function addBan(guildId, userId, reason, evidence, bannedBy) {
  const info = db
    .prepare(`INSERT INTO ban_log (guild_id, user_id, reason, evidence, banned_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(guildId, userId, reason, evidence || null, bannedBy, Date.now());
  return info.lastInsertRowid;
}

function getBansForUser(guildId, userId) {
  return db.prepare(`SELECT * FROM ban_log WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC`).all(guildId, userId);
}

function getLatestBan(guildId, userId) {
  return db
    .prepare(`SELECT * FROM ban_log WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC`)
    .get(guildId, userId);
}

function liftBan(guildId, id) {
  const info = db.prepare(`UPDATE ban_log SET active = 0 WHERE guild_id = ? AND id = ?`).run(guildId, id);
  return info.changes > 0;
}

module.exports = { addBan, getBansForUser, getLatestBan, liftBan };
