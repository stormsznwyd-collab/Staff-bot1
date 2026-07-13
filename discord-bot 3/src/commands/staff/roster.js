const { SlashCommandBuilder } = require('discord.js');
const { getConfig } = require('../../database/db');
const { getActiveSession } = require('../../services/dutyService');
const { getActiveLoaForUser } = require('../../services/loaService');
const { baseEmbed, field, brandAuthor, COLORS } = require('../../utils/embeds');

const RANK_ROLES_KEY = 'rank_role_ids';

function statusFor(guildId, userId) {
  if (getActiveLoaForUser(guildId, userId)) return '🌴';
  const s = getActiveSession(guildId, userId);
  if (s) return s.on_break ? '☕' : '🟢';
  return '⚪';
}

module.exports = {
  data: new SlashCommandBuilder().setName('roster').setDescription('Show the staff roster grouped by rank, with live duty/LOA status'),

  permissionGroup: 'staff',

  async execute(interaction) {
    await interaction.deferReply();
    const rankIds = (getConfig(interaction.guildId, RANK_ROLES_KEY) || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await interaction.guild.members.fetch();

    if (!rankIds.length) {
      return interaction.editReply({
        embeds: [
          baseEmbed({
            color: COLORS.WARNING,
            author: brandAuthor(interaction.guild, 'Staff Roster'),
            title: '📋 Staff Roster — not configured',
            description:
              'Set your rank roles (highest → lowest) to build the roster:\n`/config set key:rank_role_ids value:<roleId1>,<roleId2>,…`',
          }),
        ],
      });
    }

    const seen = new Set();
    const fields = [];
    for (const roleId of rankIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) continue;
      const members = role.members
        .filter((m) => !seen.has(m.id))
        .map((m) => {
          seen.add(m.id);
          return `${statusFor(interaction.guildId, m.id)} ${m}`;
        });
      fields.push(field(`${role.name} — ${members.length}`, members.length ? members.join('\n') : '_none_', false));
    }

    await interaction.editReply({
      embeds: [
        baseEmbed({
          color: COLORS.INFO,
          author: brandAuthor(interaction.guild, 'Staff Roster'),
          title: '📋 Staff Roster',
          description: 'Legend: 🟢 on duty · ☕ on break · 🌴 on LOA · ⚪ offline',
          thumbnail: interaction.guild.iconURL() ?? undefined,
          fields: fields.slice(0, 25),
        }),
      ],
    });
  },
};
