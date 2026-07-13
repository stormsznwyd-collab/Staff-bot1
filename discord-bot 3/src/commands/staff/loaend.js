const { SlashCommandBuilder } = require('discord.js');
const { endLoa, getActiveLoaForUser } = require('../../services/loaService');
const { successEmbed, errorEmbed, infoEmbed, field, brandAuthor } = require('../../utils/embeds');

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
        embeds: [errorEmbed({ title: '⛔ No Active LOA', description: `${targetUser} is not currently on LOA.` })],
        ephemeral: true,
      });
    }

    const result = await endLoa(interaction.guild, targetUser.id, interaction.user.id, { early: true });

    await interaction.reply({
      embeds: [
        successEmbed({
          author: brandAuthor(interaction.guild, 'Leave of Absence'),
          title: '✅ LOA Ended Early',
          description: `${targetUser}'s leave of absence has been ended and their **Staff LOA** role removed.`,
          thumbnail: targetUser.displayAvatarURL(),
          fields: [
            field('👤 Member', `${targetUser}`, true),
            field('🛡️ Ended By', `${interaction.user}`, true),
          ],
        }),
      ],
    });

    result?.member
      ?.send({
        embeds: [
          infoEmbed({
            author: brandAuthor(interaction.guild, 'Leave of Absence'),
            title: '✅ Your LOA Has Been Ended Early',
            description: `Your leave of absence in **${interaction.guild.name}** was ended early by staff.\n\nWelcome back — good to see you! 👋`,
          }),
        ],
      })
      .catch(() => {});
  },
};
