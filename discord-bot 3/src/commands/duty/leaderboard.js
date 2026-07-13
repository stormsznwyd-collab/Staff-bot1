const { SlashCommandBuilder } = require('discord.js');
const { computeHoursSince } = require('../../services/staffHoursService');
const { baseEmbed, brandAuthor, COLORS } = require('../../utils/embeds');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Staff duty-hours leaderboard')
    .addIntegerOption((o) =>
      o
        .setName('period')
        .setDescription('Time window')
        .setRequired(false)
        .addChoices({ name: 'Last 7 days', value: 7 }, { name: 'Last 14 days', value: 14 }, { name: 'Last 30 days', value: 30 })
    ),

  permissionGroup: 'staff',

  async execute(interaction) {
    const periodDays = interaction.options.getInteger('period') || 7;
    const since = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    const totals = [...computeHoursSince(interaction.guildId, since).entries()]
      .map(([userId, seconds]) => ({ userId, hours: seconds / 3600 }))
      .filter((r) => r.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 15);

    if (!totals.length) {
      return interaction.reply({
        embeds: [
          baseEmbed({
            color: COLORS.INFO,
            author: brandAuthor(interaction.guild, 'Hours Leaderboard'),
            title: `🏆 Hours Leaderboard — Last ${periodDays}d`,
            description: 'No duty hours recorded in this period yet.',
          }),
        ],
      });
    }

    const description = totals
      .map((r, i) => `${MEDALS[i] || `**${i + 1}.**`} <@${r.userId}> — **${r.hours.toFixed(1)}h**`)
      .join('\n');

    await interaction.reply({
      embeds: [
        baseEmbed({
          color: COLORS.GOLD,
          author: brandAuthor(interaction.guild, 'Hours Leaderboard'),
          title: `🏆 Hours Leaderboard — Last ${periodDays}d`,
          description,
          thumbnail: interaction.guild.iconURL() ?? undefined,
        }),
      ],
    });
  },
};
