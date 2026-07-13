const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { clockOut } = require('../../services/dutyService');
const { renderOnce } = require('../../services/dutyBoardService');
const { successEmbed, errorEmbed, field, brandAuthor } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forceclockout')
    .setDescription("Force-clock-out a staff member whose duty session is stuck")
    .addUserOption((o) => o.setName('user').setDescription('The staff member to clock out').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  permissionGroup: 'admin',

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const result = await clockOut(interaction.guild, user.id);
    if (!result.ok) {
      return interaction.reply({
        embeds: [errorEmbed({ title: '⛔ Not Clocked In', description: `${user} is not currently clocked in.` })],
        ephemeral: true,
      });
    }

    await interaction.reply({
      embeds: [
        successEmbed({
          author: brandAuthor(interaction.guild, 'Duty System'),
          title: '⏏️ Force Clocked Out',
          description: `${user}'s duty session has been closed and saved.`,
          fields: [field('🛡️ Actioned By', `${interaction.user}`, true)],
        }),
      ],
    });
    await renderOnce(interaction.client, interaction.guildId);

    interaction.guild.members
      .fetch(user.id)
      .then((m) =>
        m.send({
          embeds: [
            successEmbed({
              author: brandAuthor(interaction.guild, 'Duty System'),
              title: '⏏️ You Were Clocked Out',
              description: `A staff lead clocked you out in **${interaction.guild.name}**. Your shift time was saved.`,
            }),
          ],
        })
      )
      .catch(() => {});
  },
};
