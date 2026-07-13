const { SlashCommandBuilder } = require('discord.js');
const { getAppealsForUser, META } = require('../../services/appealService');
const { baseEmbed, field, userAuthor, COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('appealhistory')
    .setDescription("View a user's full ban-appeal history")
    .addUserOption((o) => o.setName('user').setDescription('The user to look up').setRequired(true)),

  permissionGroup: 'staff',

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const rows = getAppealsForUser(interaction.guildId, user.id);

    if (!rows.length) {
      return interaction.reply({
        embeds: [baseEmbed({ color: COLORS.INFO, author: userAuthor(user, 'Appeal History'), title: '📁 Appeal History', description: `${user} has no appeals on record.`, thumbnail: user.displayAvatarURL() })],
        ephemeral: true,
      });
    }

    const fields = rows.slice(0, 15).map((r) => {
      const meta = META[r.status] || META.pending;
      const decided = r.decided_at ? ` · decided <t:${Math.floor(r.decided_at / 1000)}:R>` : '';
      return field(`${meta.dot} #${r.id} — ${meta.statusLabel}`, `> Submitted <t:${Math.floor(r.created_at / 1000)}:D>${decided}${r.reviewed_by ? `\n> By <@${r.reviewed_by}>` : ''}`, false);
    });

    await interaction.reply({
      embeds: [baseEmbed({ color: COLORS.INFO, author: userAuthor(user, 'Appeal History'), title: `📁 Appeal History — ${rows.length}`, thumbnail: user.displayAvatarURL(), fields })],
      ephemeral: true,
    });
  },
};
