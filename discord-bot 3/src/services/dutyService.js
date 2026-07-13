const { db, getConfig } = require('../database/db');
const { errorEmbed, warnEmbed, brandAuthor } = require('../utils/embeds');
const logger = require('../utils/logger');

const DUTY_VC_CONFIG_KEY = 'duty_vc_ids';
const GRACE_PERIOD_MS = 2 * 60 * 1000; // 2 minutes

// In-memory map of userId -> Timeout, for the "rejoin within 2 minutes or get
// auto clocked out" grace period. Lives in memory only: if the bot restarts
// mid-grace-period, the member simply keeps their session (safer than
// accidentally clocking someone out on a deploy).
const graceTimers = new Map();

function getDutyVoiceChannelIds(guildId) {
  const raw = getConfig(guildId, DUTY_VC_CONFIG_KEY, '');
  return raw ? raw.split(',').filter(Boolean) : [];
}

function isInDutyVC(member) {
  const vcId = member.voice?.channelId;
  if (!vcId) return false;
  const validIds = getDutyVoiceChannelIds(member.guild.id);
  return validIds.includes(vcId);
}

function isInDutyVCById(guildId, channelId) {
  if (!channelId) return false;
  return getDutyVoiceChannelIds(guildId).includes(channelId);
}

function getActiveSession(guildId, userId) {
  return db
    .prepare(`SELECT * FROM duty_sessions WHERE guild_id = ? AND user_id = ? AND clock_out IS NULL`)
    .get(guildId, userId);
}

function getAllActiveSessions(guildId) {
  return db
    .prepare(`SELECT * FROM duty_sessions WHERE guild_id = ? AND clock_out IS NULL ORDER BY clock_in ASC`)
    .all(guildId);
}

function getSessionsSince(guildId, sinceTimestamp) {
  return db.prepare(`SELECT * FROM duty_sessions WHERE guild_id = ? AND clock_in >= ?`).all(guildId, sinceTimestamp);
}

function getRecentSessions(guildId, userId, limit = 10) {
  return db
    .prepare(`SELECT * FROM duty_sessions WHERE guild_id = ? AND user_id = ? ORDER BY clock_in DESC LIMIT ?`)
    .all(guildId, userId, limit);
}

async function clockIn(member) {
  if (getActiveSession(member.guild.id, member.id)) {
    return { ok: false, reason: 'already_clocked_in' };
  }
  if (!isInDutyVC(member)) {
    return { ok: false, reason: 'not_in_vc' };
  }

  db.prepare(`INSERT INTO duty_sessions (guild_id, user_id, clock_in) VALUES (?, ?, ?)`).run(
    member.guild.id,
    member.id,
    Date.now()
  );

  clearGraceTimer(member.id);
  return { ok: true };
}

async function clockOut(guild, userId, { auto = false } = {}) {
  const session = getActiveSession(guild.id, userId);
  if (!session) return { ok: false, reason: 'not_clocked_in' };

  let breakSeconds = session.break_seconds;
  if (session.on_break && session.break_started_at) {
    breakSeconds += Math.floor((Date.now() - session.break_started_at) / 1000);
  }

  db.prepare(
    `UPDATE duty_sessions SET clock_out = ?, on_break = 0, break_seconds = ?, auto_clocked_out = ? WHERE id = ?`
  ).run(Date.now(), breakSeconds, auto ? 1 : 0, session.id);

  clearGraceTimer(userId);
  return { ok: true, session };
}

function startBreak(guildId, userId) {
  const session = getActiveSession(guildId, userId);
  if (!session) return { ok: false, reason: 'not_clocked_in' };
  if (session.on_break) return { ok: false, reason: 'already_on_break' };

  db.prepare(`UPDATE duty_sessions SET on_break = 1, break_started_at = ? WHERE id = ?`).run(Date.now(), session.id);
  return { ok: true };
}

function endBreak(guildId, userId) {
  const session = getActiveSession(guildId, userId);
  if (!session) return { ok: false, reason: 'not_clocked_in' };
  if (!session.on_break) return { ok: false, reason: 'not_on_break' };

  const elapsed = Math.floor((Date.now() - session.break_started_at) / 1000);
  db.prepare(
    `UPDATE duty_sessions SET on_break = 0, break_started_at = NULL, break_seconds = break_seconds + ? WHERE id = ?`
  ).run(elapsed, session.id);
  return { ok: true };
}

function clearGraceTimer(userId) {
  const timer = graceTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    graceTimers.delete(userId);
  }
}

/**
 * Call this from the voiceStateUpdate event. Handles:
 *  - Starting the 2-minute grace period + DM warning when a clocked-in member
 *    leaves all duty VCs.
 *  - Cancelling the grace period if they rejoin a duty VC in time.
 */
async function handleVoiceStateChange(oldState, newState) {
  const member = newState.member ?? oldState.member;
  const guildId = member.guild.id;
  const session = getActiveSession(guildId, member.id);
  if (!session) return; // not clocked in, nothing to do

  const nowInDutyVC = isInDutyVCById(guildId, newState.channelId);

  if (nowInDutyVC) {
    clearGraceTimer(member.id);
    return;
  }

  // Left all duty VCs while clocked in. Start the grace timer if not already running.
  if (graceTimers.has(member.id)) return;

  try {
    await member.send({
      embeds: [
        warnEmbed({
          author: brandAuthor(member.guild, 'Duty System'),
          title: '⚠️ You Left the Staff VC',
          description:
            "You're still clocked in but left the staff voice channel.\n\n**Rejoin within 2 minutes** or you'll be automatically clocked out. ⏳",
        }),
      ],
    });
  } catch {
    logger.warn('Could not DM duty VC warning (DMs closed?)', { userId: member.id });
  }

  const timer = setTimeout(async () => {
    graceTimers.delete(member.id);
    const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
    if (freshMember && isInDutyVC(freshMember)) return;

    const result = await clockOut(member.guild, member.id, { auto: true });
    if (result.ok) {
      logger.info('Auto clocked out member for leaving duty VC', { userId: member.id });
      member
        .send({
          embeds: [
            errorEmbed({
              author: brandAuthor(member.guild, 'Duty System'),
              title: '🔴 Automatically Clocked Out',
              description: "You didn't rejoin the staff voice channel in time, so you've been automatically clocked out. Your shift time has been saved.",
            }),
          ],
        })
        .catch(() => {});
    }
  }, GRACE_PERIOD_MS);

  graceTimers.set(member.id, timer);
}

module.exports = {
  DUTY_VC_CONFIG_KEY,
  getDutyVoiceChannelIds,
  isInDutyVC,
  isInDutyVCById,
  getActiveSession,
  getAllActiveSessions,
  getSessionsSince,
  getRecentSessions,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  handleVoiceStateChange,
};
