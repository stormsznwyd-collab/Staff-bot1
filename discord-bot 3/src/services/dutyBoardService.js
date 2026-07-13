const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../database/db');
const { baseEmbed, field, brandAuthor, COLORS } = require('../utils/embeds');
const { formatHMS } = require('../utils/duration');
const { getAllActiveSessions, getDutyVoiceChannelIds } = require('./dutyService');
const logger = require('../utils/logger');

const REFRESH_MS = 5000;
const boards = new Map(); // guildId -> { interval }

function buildBoardEmbed(guild) {
  const sessions = getAllActiveSessions(guild.id);
  const now = Date.now();

  const onDuty = sessions.filter((s) => !s.on_break);
  const onBreak = sessions.filter((s) => s.on_break);

  const renderList = (list) =>
    list.length
      ? list
          .map((s) => {
            const elapsedSeconds = Math.floor((now - s.clock_in) / 1000);
            return `<@${s.user_id}> · \`${formatHMS(elapsedSeconds)}\``;
          })
          .join('\n')
      : '_None right now._';

  const vcIds = getDutyVoiceChannelIds(guild.id);
  const vcText = vcIds.length ? vcIds.map((id) => `<#${id}>`).join(' ') : '_Not configured_';

  return baseEmbed({
    color: sessions.length ? COLORS.DUTY : COLORS.NEUTRAL,
    author: brandAuthor(guild, 'Duty Board'),
    title: '📋 On-Duty Board',
    description: `Clock in below to start your shift. You must be connected to a staff VC to clock in.\n**Staff VCs:** ${vcText}`,
    thumbnail: guild.iconURL() ?? undefined,
    fields: [
      field(`🟢 On Duty — ${onDuty.length}`, renderList(onDuty), true),
      field(`☕ On Break — ${onBreak.length}`, renderList(onBreak), true),
    ],
    footerExtra: `Live • refreshes every ${REFRESH_MS / 1000}s`,
  });
}

function buildBoardComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('duty_clock_in').setLabel('Clock In').setStyle(ButtonStyle.Success).setEmoji('🟢'),
      new ButtonBuilder().setCustomId('duty_clock_out').setLabel('Clock Out').setStyle(ButtonStyle.Danger).setEmoji('🔴'),
      new ButtonBuilder().setCustomId('duty_break').setLabel('Toggle Break').setStyle(ButtonStyle.Secondary).setEmoji('☕')
    ),
  ];
}

async function renderOnce(client, guildId) {
  const row = db.prepare(`SELECT * FROM duty_board WHERE guild_id = ?`).get(guildId);
  if (!row) return;

  try {
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(row.channel_id);
    const message = await channel.messages.fetch(row.message_id);
    await message.edit({ embeds: [buildBoardEmbed(guild)], components: buildBoardComponents() });
  } catch (err) {
    logger.error('Failed to refresh duty board', { guildId, err: err.message });
  }
}

async function createDutyBoard(client, channel) {
  const guild = channel.guild;
  const message = await channel.send({
    embeds: [buildBoardEmbed(guild)],
    components: buildBoardComponents(),
  });

  db.prepare(
    `INSERT INTO duty_board (guild_id, channel_id, message_id) VALUES (?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id`
  ).run(guild.id, channel.id, message.id);

  startBoardLoop(client, guild.id);
  return message;
}

function startBoardLoop(client, guildId) {
  if (boards.has(guildId)) clearInterval(boards.get(guildId).interval);
  const interval = setInterval(() => renderOnce(client, guildId), REFRESH_MS);
  boards.set(guildId, { interval });
}

async function resumeAllBoards(client) {
  const rows = db.prepare(`SELECT guild_id FROM duty_board`).all();
  for (const row of rows) startBoardLoop(client, row.guild_id);
}

module.exports = { createDutyBoard, resumeAllBoards, renderOnce, REFRESH_MS };
