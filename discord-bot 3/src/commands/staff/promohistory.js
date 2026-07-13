const { SlashCommandBuilder } = require('discord.js');
const { getHistory } = require('../../services/promotionService');
const { baseEmbed, field, userAuthor, COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promohistory')
    .setDescription("Shows a member's promotion/demotion history")
    .addUserOption((opt) => opt.setName('user').setDescription('The staff member to look up').setRequired(true)),

  permissionGroup: 'staff',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const rows = getHistory(interaction.guildId, targetUser.id);

    if (!rows.length) {
      return interaction.reply({
        embeds: [
          baseEmbed({
            color: COLORS.GOLD,
            author: userAuthor(targetUser, 'Rank History'),
            title: '📜 Rank History',
            description: `${targetUser} has no recorded promotion or demotion history.`,
            thumbnail: targetUser.displayAvatarURL(),
          }),
        ],
      });
    }

    const fields = rows.slice(0, 12).map((r) => {
      const promo = r.action === 'promote';
      const icon = promo ? '⬆️' : '⬇️';
      const date = `<t:${Math.floor(r.actioned_at / 1000)}:D>`;
      const rolesText = promo ? r.roles_added : r.roles_removed;
      const roleMentions = rolesText
        ? rolesText
            .split(',')
            .filter(Boolean)
            .map((id) => `<@&${id}>`)
            .join(', ')
        : 'N/A';
      return field(
        `${icon} ${promo ? 'Promoted' : 'Demoted'} — ${date}`,
        `> **Role(s):** ${roleMentions}\n> **By:** <@${r.actioned_by}>\n> **Reason:** ${r.reason}`,
        false
      );
    });

    await interaction.reply({
      embeds: [
        baseEmbed({
          color: COLORS.GOLD,
          author: userAuthor(targetUser, 'Rank History'),
          title: `📜 Rank History — ${rows.length} total`,
          thumbnail: targetUser.displayAvatarURL(),
          fields,
          footerExtra: rows.length > 12 ? `Showing 12 of ${rows.length}` : undefined,
        }),
      ],
    });
  },
};
