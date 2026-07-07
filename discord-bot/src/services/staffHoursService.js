const { db, getConfig, setConfig } = require('../database/db');
const { baseEmbed, goldEmbed, COLORS } = require('../utils/embeds');
const { formatDuration } = require('../utils/duration');
const { getSessionsSince } = require('./dutyService');
const logger = require('../utils/logger');

const PERIOD_DAYS_KEY = 'hours_period_days';
const LAST_RUN_KEY = 'hours_last_run';
const STAFF_HOURS_CHANNEL_KEY = 'staff_hours_channel_id';
const TOP_HOURS_CHANNEL_KEY = 'top_hours_channel_id';

function requirementKey(roleId) {
  return `hours_requirement:${roleId}`;
}

/** Sets the required hours (as a number of hours) for a given role/rank. */
function setRequirement(guildId, roleId, hours) {
  setConfig(guildId, requirementKey(roleId), hours);
}

function getRequirement(guildId, roleId) {
  const val = getConfig(guildId, requirementKey(roleId));
  return val ? parseFloat(val) : null;
}

/** Returns { userId: totalSecondsWorked } across all sessions since `sinceTimestamp`. */
function computeHoursSince(guildId, sinceTimestamp) {
  const sessions = getSessionsSince(guildId, sinceTimestamp);
  const totals = new Map();
  const now = Date.now();

  for (const s of sessions) {
    const end = s.clock_out ?? now;
    const workedSeconds = Math.max(0, Math.floor((end - s.clock_in) / 1000) - (s.break_seconds || 0));
    totals.set(s.user_id, (totals.get(s.user_id) || 0) + workedSeconds);
  }

  return totals;
}

/**
 * Finds the highest hour requirement among a member's roles (assumes higher
 * hour requirements = higher rank; adjust if your rank order differs).
 */
function findMemberRequirement(guildId, member) {
  let requirement = null;
  for (const [, role] of member.roles.cache) {
    const req = getRequirement(guildId, role.id);
    if (req !== null && (requirement === null || req > requirement)) {
      requirement = req;
    }
  }
  return requirement;
}

async function runStaffHoursReport(client, guild) {
  const periodDays = parseFloat(getConfig(guild.id, PERIOD_DAYS_KEY, '7'));
  const since = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  const totals = computeHoursSince(guild.id, since);

  await guild.members.fetch();
  const met = [];
  const notMet = [];

  for (const [userId, member] of guild.members.cache) {
    if (member.user.bot) continue;
    const requirement = findMemberRequirement(guild.id, member);
    if (requirement === null) continue; // no requirement configured for this member's rank

    const workedSeconds = totals.get(userId) || 0;
    const workedHours = workedSeconds / 3600;

    if (workedHours >= requirement) {
      met.push({ userId, workedHours, requirement });
    } else {
      notMet.push({ userId, workedHours, requirement });
    }
  }

  const channelId = getConfig(guild.id, STAFF_HOURS_CHANNEL_KEY);
  if (!channelId) {
    logger.warn('Staff hours channel not configured, skipping report', { guildId: guild.id });
    return;
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const metText = met.length
    ? met.map((m) => `✅ <@${m.userId}> — ${m.workedHours.toFixed(1)}h / ${m.requirement}h`).join('\n')
    : 'Nobody met their requirement this period.';

  const notMetText = notMet.length
    ? notMet.map((m) => `❌ <@${m.userId}> — ${m.workedHours.toFixed(1)}h / ${m.requirement}h`).join('\n')
    : 'Everyone met their requirement! 🎉';

  const mentionLine = notMet.length ? notMet.map((m) => `<@${m.userId}>`).join(' ') : null;

  await channel.send({
    content: mentionLine ? `${mentionLine}\nYou did not meet your staff hour requirement this period.` : undefined,
    embeds: [
      baseEmbed({
        title: `📊 Staff Hours Report — Last ${periodDays} Day(s)`,
        color: COLORS.INFO,
        description: [`**Completed Requirement:**\n${metText}`, '', `**Did Not Complete:**\n${notMetText}`].join('\n'),
      }),
    ],
  });

  // Top hours announcement
  const topChannelId = getConfig(guild.id, TOP_HOURS_CHANNEL_KEY) || channelId;
  const topChannel = await guild.channels.fetch(topChannelId).catch(() => null);
  const allSorted = [...met, ...notMet].sort((a, b) => b.workedHours - a.workedHours);

  if (topChannel && allSorted.length) {
    const top = allSorted[0];
    await topChannel.send({
      embeds: [
        goldEmbed({
          title: '🏆 Top Staff Hours This Period',
          description: `<@${top.userId}> put in the most hours this period with **${top.workedHours.toFixed(1)} hours** worked!`,
        }),
      ],
    });
  }

  setConfig(guild.id, LAST_RUN_KEY, Date.now());
}

/** Checked on an interval; auto-runs the report when the configured period has elapsed. */
async function checkScheduledReport(client, guild) {
  const periodDays = parseFloat(getConfig(guild.id, PERIOD_DAYS_KEY, '7'));
  const lastRun = parseInt(getConfig(guild.id, LAST_RUN_KEY, '0'), 10);
  const periodMs = periodDays * 24 * 60 * 60 * 1000;

  if (Date.now() - lastRun >= periodMs) {
    await runStaffHoursReport(client, guild);
  }
}

module.exports = {
  setRequirement,
  getRequirement,
  computeHoursSince,
  findMemberRequirement,
  runStaffHoursReport,
  checkScheduledReport,
  PERIOD_DAYS_KEY,
  STAFF_HOURS_CHANNEL_KEY,
  TOP_HOURS_CHANNEL_KEY,
};
