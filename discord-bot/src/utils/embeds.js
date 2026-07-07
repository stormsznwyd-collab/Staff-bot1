const { EmbedBuilder } = require('discord.js');

const WATERMARK = 'Made by Foot Tickler';
const BRAND_COLOR = 0x2b2d31;

/**
 * Base embed builder. Every embed made through this always carries the
 * "Made by Foot Tickler" footer (bottom-left of the embed).
 * Pass `footerExtra` to append additional info after the watermark (e.g. a page count),
 * separated by " • ".
 */
function baseEmbed({ title, description, color, footerExtra, thumbnail, image } = {}) {
  const embed = new EmbedBuilder()
    .setColor(color ?? BRAND_COLOR)
    .setTimestamp()
    .setFooter({ text: footerExtra ? `${WATERMARK} • ${footerExtra}` : WATERMARK });

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);

  return embed;
}

const COLORS = {
  SUCCESS: 0x57f287,
  ERROR: 0xed4245,
  WARNING: 0xfee75c,
  INFO: 0x5865f2,
  GOLD: 0xd4af37,
  NEUTRAL: 0x2b2d31,
};

function successEmbed(opts) {
  return baseEmbed({ color: COLORS.SUCCESS, ...opts });
}
function errorEmbed(opts) {
  return baseEmbed({ color: COLORS.ERROR, ...opts });
}
function infoEmbed(opts) {
  return baseEmbed({ color: COLORS.INFO, ...opts });
}
function goldEmbed(opts) {
  return baseEmbed({ color: COLORS.GOLD, ...opts });
}

module.exports = { baseEmbed, successEmbed, errorEmbed, infoEmbed, goldEmbed, COLORS, WATERMARK };
