const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createDutyBoard } = require('../../services/dutyBoardService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dutyboard')
    .setDescription('Posts the live on-duty board in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  permissionGroup: 'admin',

  async execute(interaction) {
    await interaction.reply({ content: 'Setting up the duty board...', ephemeral: true });
    await createDutyBoard(interaction.client, interaction.channel);
  },
};
