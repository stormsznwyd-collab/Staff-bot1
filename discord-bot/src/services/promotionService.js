const { db } = require('../database/db');

function recordAction(guildId, userId, action, rolesAdded, rolesRemoved, reason, actionedBy) {
  const info = db
    .prepare(
      `INSERT INTO promotions (guild_id, user_id, action, roles_added, roles_removed, reason, actioned_by, actioned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      guildId,
      userId,
      action,
      rolesAdded.join(','),
      rolesRemoved.join(','),
      reason || 'No reason provided',
      actionedBy,
      Date.now()
    );
  return info.lastInsertRowid;
}

function getHistory(guildId, userId) {
  return db
    .prepare(`SELECT * FROM promotions WHERE guild_id = ? AND user_id = ? ORDER BY actioned_at DESC`)
    .all(guildId, userId);
}

module.exports = { recordAction, getHistory };
