const { SlashCommandBuilder } = require('discord.js');
const { getLoaHistory } = require('../../services/loaService');
const { goldEmbed, field, userAuthor } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loahistory')
    .setDescription("Shows a member's past LOAs")
    .addUserOption((opt) => opt.setName('user').setDescription('The staff member to look up').setRequired(true)),

  permissionGroup: 'staff',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const rows = getLoaHistory(interaction.guildId, targetUser.id);

    if (!rows.length) {
      return interaction.reply({
        embeds: [
          goldEmbed({
            author: userAuthor(targetUser, 'LOA History'),
            title: '🌴 LOA History',
            description: `${targetUser} has no recorded LOA history.`,
            thumbnail: targetUser.displayAvatarURL(),
          }),
        ],
      });
    }

    const fields = rows.slice(0, 12).map((row, i) => {
      const started = `<t:${Math.floor(row.start_time / 1000)}:D>`;
      let status;
      let dot;
      if (row.active) {
        status = 'Currently active';
        dot = '🟢';
      } else if (!row.ended_at) {
        status = 'Unknown';
        dot = '⚪';
      } else {
        const when = `<t:${Math.floor(row.ended_at / 1000)}:D>`;
        status = row.ended_early ? `Ended early — ${when}` : `Expired — ${when}`;
        dot = row.ended_early ? '🟠' : '🔴';
      }
      return field(`${dot} LOA #${rows.length - i} — started ${started}`, `> **Status:** ${status}\n> **Reason:** ${row.reason}`, false);
    });

    await interaction.reply({
      embeds: [
        goldEmbed({
          author: userAuthor(targetUser, 'LOA History'),
          title: `🌴 LOA History — ${rows.length} total`,
          thumbnail: targetUser.displayAvatarURL(),
          fields,
          footerExtra: rows.length > 12 ? `Showing 12 of ${rows.length}` : undefined,
        }),
      ],
    });
  },
};
