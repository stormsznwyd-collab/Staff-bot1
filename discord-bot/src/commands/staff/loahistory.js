const { SlashCommandBuilder } = require('discord.js');
const { getLoaHistory } = require('../../services/loaService');
const { goldEmbed } = require('../../utils/embeds');

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
        embeds: [goldEmbed({ title: 'LOA History', description: `<@${targetUser.id}> has no LOA history.` })],
      });
    }

    const description = rows
      .slice(0, 15)
      .map((row) => {
        const started = `<t:${Math.floor(row.start_time / 1000)}:f>`;
        let endedText;
        if (row.active) {
          endedText = 'Currently active';
        } else if (!row.ended_at) {
          endedText = 'Unknown';
        } else {
          const method = row.ended_early ? 'Ended early' : 'Expired naturally';
          endedText = `${method} — <t:${Math.floor(row.ended_at / 1000)}:f>`;
        }
        return [`**Started:** ${started}`, `**Status:** ${endedText}`, `**Reason:** ${row.reason}`].join('\n');
      })
      .join('\n\n');

    await interaction.reply({
      embeds: [
        goldEmbed({
          title: `LOA History for ${targetUser.tag}`,
          description,
          footerExtra: rows.length > 15 ? `Showing 15 of ${rows.length}` : undefined,
        }),
      ],
    });
  },
};
