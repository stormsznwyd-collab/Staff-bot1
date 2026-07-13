const { SlashCommandBuilder } = require('discord.js');
const { computeHoursSince, findMemberRequirement, PERIOD_DAYS_KEY } = require('../../services/staffHoursService');
const { getStrikesForUser } = require('../../services/strikeService');
const { getActiveLoaForUser, getLoaHistory } = require('../../services/loaService');
const { getHistory } = require('../../services/promotionService');
const { getConfig } = require('../../database/db');
const { baseEmbed, field, progressBar, userAuthor, COLORS } = require('../../utils/embeds');
const { formatDuration } = require('../../utils/duration');

module.exports = {
  data: new SlashCommandBuilder().setName('mystats').setDescription('View your own staff stats: hours, strikes, LOA and rank history'),

  permissionGroup: 'staff',

  async execute(interaction) {
    const uid = interaction.user.id;
    const periodDays = parseFloat(getConfig(interaction.guildId, PERIOD_DAYS_KEY, '7'));
    const since = Date.now() - periodDays * 24 * 60 * 60 * 1000;

    const seconds = computeHoursSince(interaction.guildId, since).get(uid) || 0;
    const hours = seconds / 3600;
    const requirement = findMemberRequirement(interaction.guildId, interaction.member);

    const strikes = getStrikesForUser(interaction.guildId, uid);
    const activeLoa = getActiveLoaForUser(interaction.guildId, uid);
    const loaCount = getLoaHistory(interaction.guildId, uid).length;
    const promos = getHistory(interaction.guildId, uid);
    const lastPromo = promos.find((p) => p.action === 'promote');

    const hoursValue = requirement
      ? `${progressBar(hours, requirement, 10)}\n**${hours.toFixed(1)}h** / ${requirement}h required`
      : `**${hours.toFixed(1)}h** in the last ${periodDays}d`;

    const strikeDots = `${'🔴'.repeat(Math.min(strikes.length, 2))}${'⚪'.repeat(Math.max(0, 2 - strikes.length))}`;

    await interaction.reply({
      embeds: [
        baseEmbed({
          color: COLORS.INFO,
          author: userAuthor(interaction.user, 'My Stats'),
          title: '📊 Your Staff Stats',
          thumbnail: interaction.user.displayAvatarURL(),
          fields: [
            field(`⏱️ Hours (last ${periodDays}d)`, hoursValue, false),
            field('⚠️ Strikes', `${strikeDots} **${strikes.length}/2**`, true),
            field('🌴 LOA', activeLoa ? '🟢 On LOA now' : `${loaCount} past`, true),
            field('📜 Promotions', `**${promos.filter((p) => p.action === 'promote').length}**`, true),
            lastPromo ? field('⬆️ Last Promotion', `<t:${Math.floor(lastPromo.actioned_at / 1000)}:R>`, false) : null,
          ].filter(Boolean),
        }),
      ],
      ephemeral: true,
    });
  },
};
