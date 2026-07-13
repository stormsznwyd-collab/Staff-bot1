const { SlashCommandBuilder } = require('discord.js');
const { getAllStrikedUsers, getStrikesForUser } = require('../../services/strikeService');
const { baseEmbed, warnEmbed, field, userAuthor, brandAuthor, COLORS } = require('../../utils/embeds');

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
          embeds: [
            warnEmbed({
              author: brandAuthor(interaction.guild, 'Staff Strikes'),
              title: '⚠️ Strike Board',
              description: '> No staff members currently have strikes. Clean record all round. ✅',
            }),
          ],
        });
      }

      const description = rows
        .map((r, i) => {
          const dots = `${'🔴'.repeat(Math.min(r.strike_count, 2))}${'⚪'.repeat(Math.max(0, 2 - r.strike_count))}`;
          return `**${i + 1}.** <@${r.user_id}> — ${dots} **${r.strike_count}** • last <t:${Math.floor(r.last_issued / 1000)}:R>`;
        })
        .join('\n');

      return interaction.reply({
        embeds: [
          baseEmbed({
            color: COLORS.WARNING,
            author: brandAuthor(interaction.guild, 'Staff Strikes'),
            title: `⚠️ Strike Board — ${rows.length} flagged`,
            description,
          }),
        ],
      });
    }

    if (sub === 'user') {
      const targetUser = interaction.options.getUser('user');
      const rows = getStrikesForUser(interaction.guildId, targetUser.id);

      if (!rows.length) {
        return interaction.reply({
          embeds: [
            warnEmbed({
              author: userAuthor(targetUser, 'Strike History'),
              title: '⚠️ Strike History',
              description: `${targetUser} has a clean record — no strikes. ✅`,
              thumbnail: targetUser.displayAvatarURL(),
            }),
          ],
        });
      }

      const fields = rows.map((r) =>
        field(
          `🔴 Strike ${r.strike_number} — <t:${Math.floor(r.issued_at / 1000)}:D>`,
          `> **Reason:** ${r.reason}\n> **Issued by:** <@${r.issued_by}>`,
          false
        )
      );

      return interaction.reply({
        embeds: [
          baseEmbed({
            color: rows.length >= 2 ? COLORS.ERROR : COLORS.WARNING,
            author: userAuthor(targetUser, 'Strike History'),
            title: `⚠️ Strike History — ${rows.length}/2`,
            thumbnail: targetUser.displayAvatarURL(),
            fields,
          }),
        ],
      });
    }
  },
};
