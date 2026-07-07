const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createStatusPanel } = require('../../services/statusPanelService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statuspanel')
    .setDescription('Posts the live bot status panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  permissionGroup: 'admin',

  async execute(interaction) {
    await interaction.reply({ content: 'Setting up the status panel...', ephemeral: true });
    await createStatusPanel(interaction.client, interaction.channel);
  },
};
