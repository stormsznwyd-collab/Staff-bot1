const { SlashCommandBuilder } = require('discord.js');
const { endLoa, getActiveLoaForUser } = require('../../services/loaService');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loaend')
    .setDescription("End a staff member's LOA early")
    .addUserOption((opt) => opt.setName('user').setDescription('The staff member to end LOA for').setRequired(true)),

  permissionGroup: 'staff',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const active = getActiveLoaForUser(interaction.guildId, targetUser.id);

    if (!active) {
      return interaction.reply({
        embeds: [errorEmbed({ title: 'No Active LOA', description: `<@${targetUser.id}> is not currently on LOA.` })],
        ephemeral: true,
      });
    }

    const result = await endLoa(interaction.guild, targetUser.id, interaction.user.id, { early: true });

    await interaction.reply({
      embeds: [
        successEmbed({
          title: 'LOA Ended Early',
          description: `<@${targetUser.id}>'s leave of absence has been ended early by <@${interaction.user.id}>.`,
        }),
      ],
    });

    result?.member
      ?.send({
        embeds: [
          infoEmbed({
            title: 'Your LOA Has Been Ended Early',
            description: `Your leave of absence in **${interaction.guild.name}** was ended early by staff. Welcome back!`,
          }),
        ],
      })
      .catch(() => {});
  },
};
