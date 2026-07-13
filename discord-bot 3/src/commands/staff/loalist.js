const { SlashCommandBuilder } = require('discord.js');
const { getAllActiveLoa } = require('../../services/loaService');
const { goldEmbed, field, brandAuthor } = require('../../utils/embeds');
const { formatDuration } = require('../../utils/duration');

module.exports = {
  data: new SlashCommandBuilder().setName('loalist').setDescription('Shows everyone currently on LOA'),

  permissionGroup: 'staff',

  async execute(interaction) {
    const rows = getAllActiveLoa(interaction.guildId);

    if (!rows.length) {
      return interaction.reply({
        embeds: [
          goldEmbed({
            author: brandAuthor(interaction.guild, 'Leave of Absence'),
            title: '🌴 Staff on LOA',
            description: '> Nobody is currently on LOA. Everyone is active. ✅',
          }),
        ],
      });
    }

    const now = Date.now();
    const fields = rows.slice(0, 25).map((row) => {
      const elapsed = formatDuration(now - row.start_time);
      const expires = row.end_time ? `<t:${Math.floor(row.end_time / 1000)}:R>` : '`Indefinite`';
      return field(
        '\u200b',
        [`👤 <@${row.user_id}>`, `> ⏱️ On LOA for **${elapsed}**`, `> ⏳ Expires: ${expires}`, `> 📝 ${row.reason}`].join('\n'),
        false
      );
    });

    await interaction.reply({
      embeds: [
        goldEmbed({
          author: brandAuthor(interaction.guild, 'Leave of Absence'),
          title: `🌴 Staff on LOA — ${rows.length} active`,
          fields,
          footerExtra: rows.length > 25 ? `Showing 25 of ${rows.length}` : undefined,
        }),
      ],
    });
  },
};
