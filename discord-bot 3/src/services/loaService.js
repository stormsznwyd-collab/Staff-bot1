const { db, getConfig, setConfig } = require('../database/db');
const { goldEmbed, infoEmbed, field, brandAuthor } = require('../utils/embeds');
const { formatDuration } = require('../utils/duration');
const logger = require('../utils/logger');

const LOA_ROLE_CONFIG_KEY = 'loa_role_id';

async function ensureLoaRole(guild) {
  const existingId = getConfig(guild.id, LOA_ROLE_CONFIG_KEY);
  if (existingId) {
    const role = guild.roles.cache.get(existingId);
    if (role) return role;
  }

  // Look for one by name in case it exists but wasn't recorded yet.
  let role = guild.roles.cache.find((r) => r.name === 'Staff LOA');

  if (!role) {
    role = await guild.roles.create({
      name: 'Staff LOA',
      color: 0xd4af37, // gold
      hoist: true,
      mentionable: true,
      reason: 'Auto-created Staff LOA role',
    });
    logger.success(`Created Staff LOA role in ${guild.name}`, { roleId: role.id });
  }

  setConfig(guild.id, LOA_ROLE_CONFIG_KEY, role.id);
  return role;
}

function getActiveLoaForUser(guildId, userId) {
  return db
    .prepare(`SELECT * FROM loa WHERE guild_id = ? AND user_id = ? AND active = 1`)
    .get(guildId, userId);
}

function getAllActiveLoa(guildId) {
  return db
    .prepare(`SELECT * FROM loa WHERE guild_id = ? AND active = 1 ORDER BY start_time ASC`)
    .all(guildId);
}

function getLoaHistory(guildId, userId) {
  return db
    .prepare(`SELECT * FROM loa WHERE guild_id = ? AND user_id = ? ORDER BY start_time DESC`)
    .all(guildId, userId);
}

async function acceptLoa(guild, member, acceptedBy, durationMs, reason) {
  const role = await ensureLoaRole(guild);
  await member.roles.add(role, `LOA accepted by ${acceptedBy.tag}`);

  const now = Date.now();
  const endTime = durationMs ? now + durationMs : null;

  const info = db
    .prepare(
      `INSERT INTO loa (guild_id, user_id, accepted_by, reason, start_time, end_time, active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    )
    .run(guild.id, member.id, acceptedBy.id, reason || 'No reason provided', now, endTime);

  return {
    id: info.lastInsertRowid,
    start_time: now,
    end_time: endTime,
    reason: reason || 'No reason provided',
  };
}

/** Ends one active LOA row. `endedBy` is a user id, or 'SYSTEM' for natural expiry. */
async function endLoa(guild, userId, endedBy, { early = false } = {}) {
  const row = getActiveLoaForUser(guild.id, userId);
  if (!row) return null;

  db.prepare(
    `UPDATE loa SET active = 0, ended_at = ?, ended_by = ?, ended_early = ? WHERE id = ?`
  ).run(Date.now(), endedBy, early ? 1 : 0, row.id);

  const role = await ensureLoaRole(guild);
  try {
    const member = await guild.members.fetch(userId);
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, early ? 'LOA ended early' : 'LOA expired');
    }
    return { row, member };
  } catch {
    return { row, member: null };
  }
}

/** Strips the Staff LOA role from everyone who currently has it (the "Clear LOA" action). */
async function clearAllLoa(guild, endedBy) {
  const role = await ensureLoaRole(guild);
  const activeRows = getAllActiveLoa(guild.id);
  const cleared = [];

  for (const row of activeRows) {
    db.prepare(`UPDATE loa SET active = 0, ended_at = ?, ended_by = ?, ended_early = 1 WHERE id = ?`).run(
      Date.now(),
      endedBy,
      row.id
    );
    cleared.push(row.user_id);
  }

  // Also strip the role from anyone who has it but somehow has no active DB row,
  // so "Clear LOA" always fully matches reality.
  await guild.members.fetch();
  const membersWithRole = role.members;
  for (const [id, member] of membersWithRole) {
    try {
      await member.roles.remove(role, 'Clear LOA - bulk clear');
      if (!cleared.includes(id)) cleared.push(id);
    } catch (err) {
      logger.error('Failed to remove LOA role during clearAll', { userId: id, err: err.message });
    }
  }

  return cleared;
}

/** Called on an interval to auto-expire LOAs whose end_time has passed. */
async function checkExpiredLoas(client) {
  const now = Date.now();
  const expired = db
    .prepare(`SELECT * FROM loa WHERE active = 1 AND end_time IS NOT NULL AND end_time <= ?`)
    .all(now);

  for (const row of expired) {
    try {
      const guild = await client.guilds.fetch(row.guild_id);
      const result = await endLoa(guild, row.user_id, 'SYSTEM', { early: false });
      if (result?.member) {
        result.member
          .send({
            embeds: [
              infoEmbed({
                author: brandAuthor(guild, 'Leave of Absence'),
                title: '✅ Your LOA Has Ended',
                description: `Your leave of absence in **${guild.name}** has expired and your **Staff LOA** role has been removed.\n\nWelcome back — we're glad to have you around again. 👋`,
              }),
            ],
          })
          .catch(() => {});
      }
      logger.info('Auto-expired LOA', { userId: row.user_id, guildId: row.guild_id });
    } catch (err) {
      logger.error('Failed to auto-expire LOA', { err: err.message, row });
    }
  }
}

function buildLoaConfirmationEmbed(guild, member, acceptedBy, row) {
  const start = Math.floor(row.start_time / 1000);
  const endText = row.end_time
    ? `<t:${Math.floor(row.end_time / 1000)}:F>\n<t:${Math.floor(row.end_time / 1000)}:R>`
    : '`Indefinite`';
  return goldEmbed({
    author: brandAuthor(guild, 'Leave of Absence'),
    title: '🌴 Leave of Absence Accepted',
    description: `${member} has been placed on leave and given the **Staff LOA** role.`,
    thumbnail: member.user?.displayAvatarURL?.(),
    fields: [
      field('👤 Member', `${member}`, true),
      field('🛡️ Accepted By', `${acceptedBy}`, true),
      field('\u200b', '\u200b', true),
      field('🕒 Started', `<t:${start}:F>`, true),
      field('⏳ Ends', endText, true),
      field('\u200b', '\u200b', true),
      field('📝 Reason', row.reason || 'No reason provided', false),
    ],
    footerExtra: `LOA #${row.id}`,
  });
}

module.exports = {
  ensureLoaRole,
  getActiveLoaForUser,
  getAllActiveLoa,
  getLoaHistory,
  acceptLoa,
  endLoa,
  clearAllLoa,
  checkExpiredLoas,
  buildLoaConfirmationEmbed,
  LOA_ROLE_CONFIG_KEY,
};
