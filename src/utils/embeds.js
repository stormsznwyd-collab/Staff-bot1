const { EmbedBuilder } = require('discord.js');

/**
 * ------------------------------------------------------------------
 *  Embed factory
 * ------------------------------------------------------------------
 *  Every embed built here carries the "Made by Foot Tickler" footer
 *  (bottom-left watermark). This module also gives you a consistent
 *  brand palette, author/thumbnail helpers, field shortcuts, section
 *  dividers and a progress-bar helper so every embed in the bot looks
 *  like it belongs to the same polished set.
 * ------------------------------------------------------------------
 */

const WATERMARK = 'Made by Foot Tickler';

// Brand palette — tuned to a green/red server theme (accept = neon green,
// deny/error = red), with supporting accent colours for other systems.
const COLORS = {
  SUCCESS: 0x8ce231, // neon green  – accepts, clock-in, promotions
  ERROR: 0xed4245, // red         – denials, errors
  DANGER: 0xed4245, // alias
  WARNING: 0xfaa61a, // amber       – strikes, cautions
  INFO: 0x5865f2, // blurple     – neutral info, DMs
  GOLD: 0xf1c40f, // gold        – LOA system
  DUTY: 0x3ba55d, // green       – duty board
  DEMOTE: 0xe67e22, // orange      – demotions
  NEUTRAL: 0x2b2d31, // dark        – fallback
};

// A thin divider you can drop into a description to separate sections.
const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━';

/** Shorthand for building a field object. */
function field(name, value, inline = false) {
  return { name, value: value === undefined || value === null || value === '' ? '\u200b' : String(value), inline };
}

/** An empty inline field, handy for padding a 2-column grid into alignment. */
function blankField(inline = true) {
  return { name: '\u200b', value: '\u200b', inline };
}

/**
 * A text progress bar, e.g. progressBar(5.2, 8) -> "▰▰▰▰▰▱▱▱ 65%".
 * Great for the staff-hours report.
 */
function progressBar(current, total, size = 10) {
  if (!total || total <= 0) return '▱'.repeat(size) + ' 0%';
  const ratio = Math.max(0, Math.min(1, current / total));
  const filled = Math.round(ratio * size);
  return `${'▰'.repeat(filled)}${'▱'.repeat(size - filled)} ${Math.round(ratio * 100)}%`;
}

/** Author block from a Discord user (name + avatar). */
function userAuthor(user, suffix) {
  if (!user) return undefined;
  return {
    name: suffix ? `${user.tag ?? user.username} • ${suffix}` : user.tag ?? user.username,
    iconURL: typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL() : undefined,
  };
}

/** Branded author block using the server name + icon and a category label. */
function brandAuthor(guild, category) {
  if (!guild) return category ? { name: category } : undefined;
  return {
    name: category ? `${guild.name} • ${category}` : guild.name,
    iconURL: typeof guild.iconURL === 'function' ? guild.iconURL() ?? undefined : undefined,
  };
}

/**
 * Core builder. Accepts:
 *   title, description, color, footerExtra, thumbnail, image, url,
 *   author  -> { name, iconURL, url }
 *   fields  -> [{ name, value, inline }]
 *   timestamp -> set false to omit
 */
function baseEmbed({
  title,
  description,
  color,
  footerExtra,
  thumbnail,
  image,
  url,
  author,
  fields,
  timestamp = true,
} = {}) {
  const embed = new EmbedBuilder()
    .setColor(color ?? COLORS.NEUTRAL)
    .setFooter({ text: footerExtra ? `${WATERMARK} • ${footerExtra}` : WATERMARK });

  if (timestamp) embed.setTimestamp();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  if (url) embed.setURL(url);
  if (author) embed.setAuthor(author);
  if (Array.isArray(fields) && fields.length) embed.addFields(fields.filter(Boolean));

  return embed;
}

const successEmbed = (opts) => baseEmbed({ color: COLORS.SUCCESS, ...opts });
const errorEmbed = (opts) => baseEmbed({ color: COLORS.ERROR, ...opts });
const infoEmbed = (opts) => baseEmbed({ color: COLORS.INFO, ...opts });
const warnEmbed = (opts) => baseEmbed({ color: COLORS.WARNING, ...opts });
const goldEmbed = (opts) => baseEmbed({ color: COLORS.GOLD, ...opts });
const dutyEmbed = (opts) => baseEmbed({ color: COLORS.DUTY, ...opts });

module.exports = {
  baseEmbed,
  successEmbed,
  errorEmbed,
  infoEmbed,
  warnEmbed,
  goldEmbed,
  dutyEmbed,
  field,
  blankField,
  progressBar,
  userAuthor,
  brandAuthor,
  COLORS,
  DIVIDER,
  WATERMARK,
};
