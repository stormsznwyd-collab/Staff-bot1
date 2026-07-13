const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { db, getConfig } = require('../database/db');
const { baseEmbed, field } = require('../utils/embeds');
const cardService = require('./cardService');

// ---------- config keys ----------
const CHANNEL_KEY = 'appeal_channel_id'; // where management panels post
const COOLDOWN_KEY = 'appeal_cooldown_days'; // reapply cooldown after a denial
const PING_ROLE_KEY = 'appeal_ping_role_id'; // optional role pinged on new appeals
const BANNER_KEYS = {
  pending: 'appeal_banner_pending',
  accepted: 'appeal_banner_accepted',
  denied: 'appeal_banner_denied',
  anticheat: 'appeal_banner_anticheat',
};
const DEFAULT_COOLDOWN_DAYS = 7;

// ---------- status metadata (colours + labels matched to the SnoopLife cards) ----------
const STATUS = { PENDING: 'pending', ACCEPTED: 'accepted', DENIED: 'denied', ANTICHEAT: 'anticheat' };

const META = {
  pending: { color: 0xfaa61a, emoji: '📨', dot: '🕒', title: 'Ban Appeal Submitted', statusLabel: 'PENDING REVIEW' },
  accepted: { color: 0x8ce231, emoji: '✅', dot: '🟢', title: 'Ban Appeal Accepted', statusLabel: 'ACCEPTED' },
  denied: { color: 0xed4245, emoji: '⛔', dot: '🔴', title: 'Ban Appeal Denied', statusLabel: 'DENIED' },
  anticheat: { color: 0x3ba55d, emoji: '🛡️', dot: '🟢', title: 'Anti-Cheat Ban', statusLabel: 'ANTI-CHEAT BAN' },
};

const DETECTIONS = {
  aimbot: 'Aimbot',
  triggerbot: 'Trigger Bot',
  esp: 'ESP / Wallhack',
  macro: 'Macros / Scripts',
  speedhack: 'Speed / Movement Hack',
  injection: 'Code Injection',
  menu: 'Mod Menu',
  other: 'Unauthorized Software',
};

// ---------- helpers ----------
function cooldownDays(guildId) {
  const v = parseFloat(getConfig(guildId, COOLDOWN_KEY, String(DEFAULT_COOLDOWN_DAYS)));
  return Number.isFinite(v) ? v : DEFAULT_COOLDOWN_DAYS;
}

function getAppealChannelId(guildId) {
  return getConfig(guildId, CHANNEL_KEY);
}

function getPingRoleId(guildId) {
  return getConfig(guildId, PING_ROLE_KEY);
}

// ---------- DB ----------
function createAppeal(guildId, userId, { banReason, appealText, evidence, status = STATUS.PENDING, detection, appealable = 1 } = {}) {
  const now = Date.now();
  const info = db
    .prepare(
      `INSERT INTO ban_appeals
        (guild_id, user_id, status, ban_reason, appeal_text, evidence, detection, appealable, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(guildId, userId, status, banReason || null, appealText || null, evidence || null, detection || null, appealable ? 1 : 0, now, now);
  return getAppeal(info.lastInsertRowid);
}

function getAppeal(id) {
  return db.prepare(`SELECT * FROM ban_appeals WHERE id = ?`).get(id);
}

function getPendingForUser(guildId, userId) {
  return db
    .prepare(`SELECT * FROM ban_appeals WHERE guild_id = ? AND user_id = ? AND status = 'pending' ORDER BY created_at DESC`)
    .get(guildId, userId);
}

function getLatestForUser(guildId, userId) {
  return db
    .prepare(`SELECT * FROM ban_appeals WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC`)
    .get(guildId, userId);
}

function getPendingAppeals(guildId) {
  return db.prepare(`SELECT * FROM ban_appeals WHERE guild_id = ? AND status = 'pending' ORDER BY created_at ASC`).all(guildId);
}

function getAppealsForUser(guildId, userId) {
  return db.prepare(`SELECT * FROM ban_appeals WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC`).all(guildId, userId);
}

/** Returns a future cooldown timestamp if the user is still blocked from reapplying, else null. */
function activeCooldown(guildId, userId) {
  const latest = getLatestForUser(guildId, userId);
  if (latest && latest.status === STATUS.DENIED && latest.cooldown_until && latest.cooldown_until > Date.now()) {
    return latest.cooldown_until;
  }
  return null;
}

function setMessageRef(id, channelId, messageId) {
  db.prepare(`UPDATE ban_appeals SET channel_id = ?, message_id = ? WHERE id = ?`).run(channelId, messageId, id);
}

/** Applies a new status. On denial, stamps the reapply cooldown. Returns the fresh row. */
function setStatus(id, status, { reviewedBy, decisionReason, guildId } = {}) {
  const now = Date.now();
  const terminal = status !== STATUS.PENDING;
  let cooldownUntil = null;
  if (status === STATUS.DENIED) {
    const gid = guildId || getAppeal(id)?.guild_id;
    cooldownUntil = now + cooldownDays(gid) * 24 * 60 * 60 * 1000;
  }
  db.prepare(
    `UPDATE ban_appeals
     SET status = ?, updated_at = ?, reviewed_by = COALESCE(?, reviewed_by),
         decided_at = ?, decision_reason = COALESCE(?, decision_reason), cooldown_until = ?
     WHERE id = ?`
  ).run(status, now, reviewedBy || null, terminal ? now : null, decisionReason || null, cooldownUntil, id);
  return getAppeal(id);
}

// ---------- embeds ----------
/**
 * The user-facing themed embed (Accepted / Denied / Anti-Cheat / Submitted),
 * matching the four SnoopLife cards. Send this to the user (DM or channel).
 */
function buildAppealEmbed(kind, guild, appeal, { reviewer } = {}) {
  const meta = META[kind];
  const server = guild.name;
  const uid = appeal.user_id;
  const banner = getConfig(guild.id, BANNER_KEYS[kind]); // optional card art

  let description;
  const fields = [];

  if (kind === STATUS.PENDING) {
    description = [
      `Hello <@${uid}>,`,
      '',
      'Your ban appeal has been **successfully received**.',
      '',
      `A member of the **${server} Staff Team** will review your appeal as soon as possible.`,
      '',
      'Please be patient while your appeal is under review. Creating multiple appeals or contacting staff repeatedly regarding the same appeal may delay the review process.',
      '',
      "You'll be notified once a final decision has been made.",
    ].join('\n');
    fields.push(field('🆔 Case ID', `\`#${appeal.id}\``, true), field('🕒 Submitted', `<t:${Math.floor(appeal.created_at / 1000)}:R>`, true));
  } else if (kind === STATUS.ACCEPTED) {
    description = [
      `Hello <@${uid}>,`,
      '',
      `After reviewing your ban appeal, the **${server} Staff Team** has decided to **accept** your appeal.`,
      '',
      'Your ban has been **lifted**, and you are now welcome back to the server.',
      '',
      'Please take this opportunity to review our server rules and ensure all future interactions follow our community guidelines. Any further rule violations may result in another ban that may not be eligible for appeal.',
      '',
      `**Welcome back to ${server}.** 🎉`,
    ].join('\n');
    fields.push(field('🆔 Case ID', `\`#${appeal.id}\``, true));
    if (reviewer) fields.push(field('🛡️ Reviewed By', `<@${reviewer}>`, true));
    fields.push(field('📅 Decision', `<t:${Math.floor((appeal.decided_at || Date.now()) / 1000)}:f>`, true));
  } else if (kind === STATUS.DENIED) {
    description = [
      `Hello <@${uid}>,`,
      '',
      `After carefully reviewing your appeal and the evidence available, the **${server} Staff Team** has decided to **deny** your ban appeal.`,
      '',
      'Your ban will **remain in effect**.',
      '',
      'Please do not submit repeated appeals unless you have new evidence or significant information that was not included in your previous appeal.',
      '',
      'Thank you for your understanding.',
    ].join('\n');
    fields.push(field('🆔 Case ID', `\`#${appeal.id}\``, true));
    if (reviewer) fields.push(field('🛡️ Reviewed By', `<@${reviewer}>`, true));
    if (appeal.cooldown_until) fields.push(field('🔁 May Reapply', `<t:${Math.floor(appeal.cooldown_until / 1000)}:R>`, true));
  } else if (kind === STATUS.ANTICHEAT) {
    description = [
      `Hello <@${uid}>,`,
      '',
      'Our automated **Anti-Cheat** system has detected unauthorized software, modifications, or suspicious activity associated with your account.',
      '',
      `As a result, you have been **permanently banned** from **${server}**.`,
      '',
      'If you believe this action was made in error, you may submit a Ban Appeal through the appropriate appeal channel. Appeals without sufficient evidence may be denied.',
      '',
      `Thank you for helping us keep ${server} fair for everyone.`,
    ].join('\n');
    const det = appeal.detection ? DETECTIONS[appeal.detection] || appeal.detection : 'Unauthorized Software';
    fields.push(field('🔎 Detection', det, true), field('📩 Appealable', appeal.appealable ? 'Yes' : 'No', true));
  }

  // Prominent status "bar" like the cards' bottom banner.
  fields.push(field('📋 Status', `${meta.dot} **${meta.statusLabel}**`, false));

  return baseEmbed({
    color: meta.color,
    author: { name: `${server} • Ban Appeals`, iconURL: guild.iconURL() ?? undefined },
    title: `${meta.emoji} ${meta.title}`,
    description,
    thumbnail: guild.iconURL() ?? undefined,
    image: banner || undefined,
    fields,
    footerExtra: `Case #${appeal.id}`,
  });
}

/** Staff-facing management panel: shows the appeal details + current status. */
function buildManagementEmbed(guild, appeal) {
  const meta = META[appeal.status] || META.pending;
  const fields = [
    field('👤 Member', `<@${appeal.user_id}>`, true),
    field('📊 Status', `${meta.dot} **${meta.statusLabel}**`, true),
    field('🕒 Submitted', `<t:${Math.floor(appeal.created_at / 1000)}:f>`, true),
  ];
  if (appeal.ban_reason) fields.push(field('🚫 Original Ban Reason', appeal.ban_reason, false));
  if (appeal.appeal_text) fields.push(field('🗣️ Appeal', appeal.appeal_text.slice(0, 1024), false));
  if (appeal.evidence) fields.push(field('📎 Evidence', appeal.evidence.slice(0, 1024), false));
  if (appeal.detection) fields.push(field('🔎 Detection', DETECTIONS[appeal.detection] || appeal.detection, true));
  if (appeal.reviewed_by) fields.push(field('🛡️ Last Updated By', `<@${appeal.reviewed_by}>`, true));

  return baseEmbed({
    color: meta.color,
    author: { name: `${guild.name} • Appeal Management`, iconURL: guild.iconURL() ?? undefined },
    title: `📁 Ban Appeal #${appeal.id}`,
    description: 'Use the dropdown below to set the appeal outcome. The member is notified automatically.',
    fields,
    footerExtra: `Case #${appeal.id}`,
  });
}

/**
 * Builds the message payload to notify a user of their appeal status. Prefers a
 * personalized card image (looks exactly like the SnoopLife art); falls back to
 * the themed embed if cards are disabled/unavailable.
 * @param {string} status  pending | accepted | denied | anticheat
 */
async function appealNoticePayload(status, guild, appeal, { reviewer, username } = {}) {
  const useCards = getConfig(guild.id, 'appeal_use_cards', 'true') !== 'false';
  if (useCards && cardService.ready()) {
    const card = await cardService.buildAppealCard(status, { username });
    if (card) return { files: [card] };
  }
  return { embeds: [buildAppealEmbed(status, guild, appeal, { reviewer })] };
}

/** The status dropdown that drives the whole thing. */
function buildStatusSelect(appealId, current) {
  const options = [
    new StringSelectMenuOptionBuilder().setLabel('In Progress / Pending Review').setValue(STATUS.PENDING).setEmoji('🕒').setDescription('Mark as under review'),
    new StringSelectMenuOptionBuilder().setLabel('Ban Appeal Accepted').setValue(STATUS.ACCEPTED).setEmoji('✅').setDescription('Approve — user is welcomed back'),
    new StringSelectMenuOptionBuilder().setLabel('Ban Appeal Denied').setValue(STATUS.DENIED).setEmoji('⛔').setDescription('Reject — ban stays in effect'),
    new StringSelectMenuOptionBuilder().setLabel('Anti-Cheat Ban').setValue(STATUS.ANTICHEAT).setEmoji('🛡️').setDescription('Flag as an anti-cheat detection'),
  ];
  for (const o of options) if (o.data.value === current) o.setDefault(true);

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`appeal_status:${appealId}`).setPlaceholder('Set appeal status…').addOptions(options)
  );
}

module.exports = {
  STATUS,
  META,
  DETECTIONS,
  CHANNEL_KEY,
  COOLDOWN_KEY,
  PING_ROLE_KEY,
  BANNER_KEYS,
  cooldownDays,
  getAppealChannelId,
  getPingRoleId,
  createAppeal,
  getAppeal,
  getPendingForUser,
  getLatestForUser,
  getPendingAppeals,
  getAppealsForUser,
  activeCooldown,
  setMessageRef,
  setStatus,
  buildAppealEmbed,
  buildManagementEmbed,
  buildStatusSelect,
  appealNoticePayload,
};
