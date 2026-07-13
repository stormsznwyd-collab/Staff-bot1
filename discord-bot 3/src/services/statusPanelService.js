const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { db, getConfig } = require('../database/db');
const { baseEmbed, field, brandAuthor, COLORS } = require('../utils/embeds');
const { getAllActiveLoa } = require('./loaService');
const { formatDuration } = require('../utils/duration');
const logger = require('../utils/logger');

const REFRESH_MS = 5000; // Discord-safe "live" refresh interval (see docs: 1s updates get rate-limited)
const panels = new Map(); // guildId -> { interval }

function getTicketCount(guild) {
  const categoryId = getConfig(guild.id, 'ticket_category_id');
  if (!categoryId) return null;
  const category = guild.channels.cache.get(categoryId);
  if (!category) return null;
  return guild.channels.cache.filter((c) => c.parentId === categoryId).size;
}

function buildStatusEmbed(client, guild) {
  const uptimeMs = client.uptime ?? 0;
  const online = client.ws.status === 0; // 0 = READY
  const ping = Math.max(0, Math.round(client.ws.ping));
  const ticketCount = getTicketCount(guild);
  const activeLoa = getAllActiveLoa(guild.id);

  const loaLines = activeLoa.length
    ? activeLoa
        .slice(0, 10)
        .map((row) => {
          const endText = row.end_time ? `<t:${Math.floor(row.end_time / 1000)}:R>` : '`Indefinite`';
          return `• <@${row.user_id}> — ends ${endText}`;
        })
        .join('\n')
    : '_No one is currently on LOA._';

  return baseEmbed({
    color: online ? COLORS.SUCCESS : COLORS.ERROR,
    author: brandAuthor(guild, 'System Status'),
    title: '🖥️ Bot Status Panel',
    description: online ? '> All systems operational. 🟢' : '> The bot is currently unavailable. 🔴',
    thumbnail: client.user?.displayAvatarURL?.(),
    fields: [
      field('📡 Status', online ? '🟢 Online' : '🔴 Down', true),
      field('⏱️ Uptime', online ? formatDuration(uptimeMs) : 'N/A', true),
      field('📶 Latency', online ? `${ping}ms` : 'N/A', true),
      field(
        '🎫 Open Tickets',
        ticketCount === null ? '`Not configured`' : `**${ticketCount}**`,
        true
      ),
      field('🌴 Staff on LOA', `**${activeLoa.length}**`, true),
      field('\u200b', '\u200b', true),
      field(`🌴 Active LOA — ${activeLoa.length}`, loaLines, false),
    ],
    footerExtra: `Live • refreshes every ${REFRESH_MS / 1000}s`,
  });
}

function buildStatusComponents(guild) {
  const activeLoa = getAllActiveLoa(guild.id);

  const controlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('status_restart').setLabel('Restart Bot').setStyle(ButtonStyle.Danger).setEmoji('🔄'),
    new ButtonBuilder().setCustomId('status_clear_loa').setLabel('Clear All LOA').setStyle(ButtonStyle.Secondary).setEmoji('🧹'),
    new ButtonBuilder().setCustomId('status_fix_commands').setLabel('Fix Commands').setStyle(ButtonStyle.Primary).setEmoji('🛠️'),
    new ButtonBuilder().setCustomId('status_fix_all').setLabel('Fix All Commands').setStyle(ButtonStyle.Primary).setEmoji('🧰')
  );

  const rows = [controlRow];

  if (activeLoa.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('status_end_loa_select')
      .setPlaceholder('End an LOA early...')
      .addOptions(
        activeLoa.slice(0, 25).map((row) => ({
          label: `End LOA: ${row.user_id}`,
          description: (row.reason || 'No reason').slice(0, 90),
          value: String(row.user_id),
        }))
      );
    rows.push(new ActionRowBuilder().addComponents(menu));
  }

  return rows;
}

async function renderOnce(client, guildId) {
  const row = db.prepare(`SELECT * FROM status_panel WHERE guild_id = ?`).get(guildId);
  if (!row) return;

  try {
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(row.channel_id);
    const message = await channel.messages.fetch(row.message_id);
    await message.edit({
      embeds: [buildStatusEmbed(client, guild)],
      components: buildStatusComponents(guild),
    });
  } catch (err) {
    logger.error('Failed to refresh status panel', { guildId, err: err.message });
  }
}

async function createStatusPanel(client, channel) {
  const guild = channel.guild;
  const message = await channel.send({
    embeds: [buildStatusEmbed(client, guild)],
    components: buildStatusComponents(guild),
  });

  db.prepare(
    `INSERT INTO status_panel (guild_id, channel_id, message_id) VALUES (?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id`
  ).run(guild.id, channel.id, message.id);

  startPanelLoop(client, guild.id);
  return message;
}

function startPanelLoop(client, guildId) {
  if (panels.has(guildId)) clearInterval(panels.get(guildId).interval);
  const interval = setInterval(() => renderOnce(client, guildId), REFRESH_MS);
  panels.set(guildId, { interval });
}

/** Called on bot startup to resume refreshing any panels that already existed. */
async function resumeAllPanels(client) {
  const rows = db.prepare(`SELECT guild_id FROM status_panel`).all();
  for (const row of rows) {
    startPanelLoop(client, row.guild_id);
  }
}

module.exports = { createStatusPanel, resumeAllPanels, renderOnce, REFRESH_MS };
