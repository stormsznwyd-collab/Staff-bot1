const { SlashCommandBuilder } = require('discord.js');
const { getAllActiveLoa } = require('../../services/loaService');
const { goldEmbed } = require('../../utils/embeds');
const { formatDuration } = require('../../utils/duration');

module.exports = {
  data: new SlashCommandBuilder().setName('loalist').setDescription('Shows everyone currently on LOA'),

  permissionGroup: 'staff',

  async execute(interaction) {
    const rows = getAllActiveLoa(interaction.guildId);

    if (!rows.length) {
      return interaction.reply({
        embeds: [goldEmbed({ title: 'Staff LOA List', description: 'Nobody is currently on LOA.' })],
      });
    }

    const now = Date.now();
    const description = rows
      .map((row) => {
        const elapsed = formatDuration(now - row.start_time);
        const expires = row.end_time
          ? `<t:${Math.floor(row.end_time / 1000)}:R>`
          : 'Indefinite';
        return [
          `**<@${row.user_id}>**`,
          `> Time on LOA: ${elapsed}`,
          `> Expires: ${expires}`,
          `> Reason: ${row.reason}`,
        ].join('\n');
      })
      .join('\n\n');

    await interaction.reply({
      embeds: [
        goldEmbed({
          title: `Staff LOA List (${rows.length})`,
          description,
        }),
      ],
    });
  },
};
