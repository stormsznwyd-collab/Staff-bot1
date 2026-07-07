const { SlashCommandBuilder } = require('discord.js');
const { getAllStrikedUsers, getStrikesForUser } = require('../../services/strikeService');
const { baseEmbed, COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strikeboard')
    .setDescription('Shows staff strike information')
    .addSubcommand((sub) => sub.setName('all').setDescription('Shows everyone who has a strike'))
    .addSubcommand((sub) =>
      sub
        .setName('user')
        .setDescription("Shows one member's strike history")
        .addUserOption((opt) => opt.setName('user').setDescription('The staff member to look up').setRequired(true))
    ),

  permissionGroup: 'staff',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'all') {
      const rows = getAllStrikedUsers(interaction.guildId);
      if (!rows.length) {
        return interaction.reply({
          embeds: [baseEmbed({ title: 'Strike Board', color: COLORS.WARNING, description: 'No staff members have strikes.' })],
        });
      }

      const description = rows
        .map((r) => `• <@${r.user_id}> — **${r.strike_count}** strike(s) — last: <t:${Math.floor(r.last_issued / 1000)}:R>`)
        .join('\n');

      return interaction.reply({
        embeds: [baseEmbed({ title: `Strike Board (${rows.length})`, color: COLORS.WARNING, description })],
      });
    }

    if (sub === 'user') {
      const targetUser = interaction.options.getUser('user');
      const rows = getStrikesForUser(interaction.guildId, targetUser.id);

      if (!rows.length) {
        return interaction.reply({
          embeds: [
            baseEmbed({
              title: 'Strike History',
              color: COLORS.WARNING,
              description: `<@${targetUser.id}> has no strikes.`,
            }),
          ],
        });
      }

      const description = rows
        .map(
          (r) =>
            `**Strike ${r.strike_number}** — <t:${Math.floor(r.issued_at / 1000)}:f>\n> Reason: ${r.reason}\n> Issued by: <@${r.issued_by}>`
        )
        .join('\n\n');

      return interaction.reply({
        embeds: [
          baseEmbed({ title: `Strike History for ${targetUser.tag}`, color: COLORS.WARNING, description }),
        ],
      });
    }
  },
};
