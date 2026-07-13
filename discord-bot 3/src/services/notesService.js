const { db } = require('../database/db');

function addNote(guildId, userId, note, addedBy) {
  const info = db
    .prepare(`INSERT INTO staff_notes (guild_id, user_id, note, added_by, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(guildId, userId, note, addedBy, Date.now());
  return info.lastInsertRowid;
}

function getNotes(guildId, userId) {
  return db.prepare(`SELECT * FROM staff_notes WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC`).all(guildId, userId);
}

function removeNote(guildId, id) {
  const info = db.prepare(`DELETE FROM staff_notes WHERE guild_id = ? AND id = ?`).run(guildId, id);
  return info.changes > 0;
}

module.exports = { addNote, getNotes, removeNote };
