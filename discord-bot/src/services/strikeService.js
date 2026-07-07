const { db } = require('../database/db');

function addStrike(guildId, userId, strikeNumber, reason, issuedBy) {
  const info = db
    .prepare(
      `INSERT INTO strikes (guild_id, user_id, strike_number, reason, issued_by, issued_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(guildId, userId, strikeNumber, reason, issuedBy, Date.now());
  return info.lastInsertRowid;
}

function getStrikesForUser(guildId, userId) {
  return db
    .prepare(`SELECT * FROM strikes WHERE guild_id = ? AND user_id = ? ORDER BY issued_at DESC`)
    .all(guildId, userId);
}

function getAllStrikedUsers(guildId) {
  return db
    .prepare(
      `SELECT user_id, COUNT(*) as strike_count, MAX(issued_at) as last_issued
       FROM strikes WHERE guild_id = ? GROUP BY user_id ORDER BY strike_count DESC, last_issued DESC`
    )
    .all(guildId);
}

module.exports = { addStrike, getStrikesForUser, getAllStrikedUsers };
