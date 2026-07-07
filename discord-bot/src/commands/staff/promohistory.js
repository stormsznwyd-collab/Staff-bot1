const { SlashCommandBuilder } = require('discord.js');
const { getHistory } = require('../../services/promotionService');
const { baseEmbed, COLORS } = require('../../utils/embeds');

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
        embeds: [baseEmbed({ title: 'Promotion History', description: `<@${targetUser.id}> has no recorded history.` })],
      });
    }

    const description = rows
      .slice(0, 15)
      .map((r) => {
        const icon = r.action === 'promote' ? '⬆️' : '⬇️';
        const date = `<t:${Math.floor(r.actioned_at / 1000)}:f>`;
        const rolesText = r.action === 'promote' ? r.roles_added : r.roles_removed;
        const roleMentions = rolesText
          ? rolesText
              .split(',')
              .filter(Boolean)
              .map((id) => `<@&${id}>`)
              .join(', ')
          : 'N/A';
        return [
          `${icon} **${r.action === 'promote' ? 'Promoted' : 'Demoted'}** — ${date}`,
          `> Roles: ${roleMentions}`,
          `> By: <@${r.actioned_by}>`,
          `> Reason: ${r.reason}`,
        ].join('\n');
      })
      .join('\n\n');

    await interaction.reply({
      embeds: [
        baseEmbed({
          title: `Promotion History for ${targetUser.tag}`,
          color: COLORS.GOLD,
          description,
          footerExtra: rows.length > 15 ? `Showing 15 of ${rows.length}` : undefined,
        }),
      ],
    });
  },
};
