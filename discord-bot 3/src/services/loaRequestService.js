const { db } = require('../database/db');

function createRequest(guildId, userId, durationMs, reason) {
  const info = db
    .prepare(`INSERT INTO loa_requests (guild_id, user_id, duration_ms, reason, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(guildId, userId, durationMs ?? null, reason || null, Date.now());
  return getRequest(info.lastInsertRowid);
}

function getRequest(id) {
  return db.prepare(`SELECT * FROM loa_requests WHERE id = ?`).get(id);
}

function getPendingForUser(guildId, userId) {
  return db
    .prepare(`SELECT * FROM loa_requests WHERE guild_id = ? AND user_id = ? AND status = 'pending' ORDER BY created_at DESC`)
    .get(guildId, userId);
}

function setMessageRef(id, channelId, messageId) {
  db.prepare(`UPDATE loa_requests SET channel_id = ?, message_id = ? WHERE id = ?`).run(channelId, messageId, id);
}

function decide(id, status, decidedBy) {
  db.prepare(`UPDATE loa_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?`).run(status, decidedBy, Date.now(), id);
  return getRequest(id);
}

module.exports = { createRequest, getRequest, getPendingForUser, setMessageRef, decide };
