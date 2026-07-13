const { SlashCommandBuilder } = require('discord.js');
const { getStrikesForUser } = require('../../services/strikeService');
const { getNotes } = require('../../services/notesService');
const { getActiveLoaForUser, getLoaHistory } = require('../../services/loaService');
const { getHistory } = require('../../services/promotionService');
const { computeHoursSince } = require('../../services/staffHoursService');
const { baseEmbed, field, userAuthor, COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('record')
    .setDescription("View a staff member's full file: strikes, notes, LOA, promotions and hours")
    .addUserOption((o) => o.setName('user').setDescription('The staff member').setRequired(true)),

  permissionGroup: 'staff',

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const uid = user.id;

    const strikes = getStrikesForUser(interaction.guildId, uid);
    const notes = getNotes(interaction.guildId, uid);
    const activeLoa = getActiveLoaForUser(interaction.guildId, uid);
    const loaCount = getLoaHistory(interaction.guildId, uid).length;
    const promos = getHistory(interaction.guildId, uid);
    const promoCount = promos.filter((p) => p.action === 'promote').length;
    const demoCount = promos.filter((p) => p.action === 'demote').length;
    const hours30 = (computeHoursSince(interaction.guildId, Date.now() - 30 * 864e5).get(uid) || 0) / 3600;

    const strikeDots = `${'🔴'.repeat(Math.min(strikes.length, 2))}${'⚪'.repeat(Math.max(0, 2 - strikes.length))}`;
    const strikeText = strikes.length
      ? strikes.map((s) => `• **#${s.strike_number}** ${s.reason} — <t:${Math.floor(s.issued_at / 1000)}:R>`).join('\n')
      : '_Clean record_';
    const noteText = notes.length ? notes.slice(0, 3).map((n) => `• ${n.note}`).join('\n') + (notes.length > 3 ? `\n_+${notes.length - 3} more_` : '') : '_None_';

    await interaction.reply({
      embeds: [
        baseEmbed({
          color: strikes.length >= 2 ? COLORS.ERROR : COLORS.INFO,
          author: userAuthor(user, 'Staff File'),
          title: '🗂️ Staff Record',
          thumbnail: user.displayAvatarURL(),
          fields: [
            field('⚠️ Strikes', `${strikeDots} **${strikes.length}/2**`, true),
            field('🌴 LOA', activeLoa ? '🟢 On LOA' : `${loaCount} past`, true),
            field('⏱️ Hours (30d)', `**${hours30.toFixed(1)}h**`, true),
            field('📜 Promotions', `⬆️ ${promoCount} · ⬇️ ${demoCount}`, true),
            field('🗒️ Notes', `**${notes.length}**`, true),
            field('\u200b', '\u200b', true),
            field('Strike Detail', strikeText, false),
            field('Recent Notes', noteText, false),
          ],
        }),
      ],
      ephemeral: true,
    });
  },
};
