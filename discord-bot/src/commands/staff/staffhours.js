const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setRequirement, getRequirement, runStaffHoursReport } = require('../../services/staffHoursService');
const { successEmbed, infoEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staffhours')
    .setDescription('Manage and run staff hour requirement reports')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('setrequirement')
        .setDescription('Set the required hours per period for a rank/role')
        .addRoleOption((opt) => opt.setName('role').setDescription('The rank/role').setRequired(true))
        .addNumberOption((opt) => opt.setName('hours').setDescription('Required hours per period').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('getrequirement').setDescription('Check the required hours for a rank/role').addRoleOption((opt) =>
        opt.setName('role').setDescription('The rank/role').setRequired(true)
      )
    )
    .addSubcommand((sub) => sub.setName('run').setDescription('Manually run the staff hours report now')),

  permissionGroup: 'admin',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setrequirement') {
      const role = interaction.options.getRole('role');
      const hours = interaction.options.getNumber('hours');
      setRequirement(interaction.guildId, role.id, hours);
      return interaction.reply({
        embeds: [successEmbed({ title: 'Requirement Set', description: `${role} now requires **${hours} hours** per period.` })],
        ephemeral: true,
      });
    }

    if (sub === 'getrequirement') {
      const role = interaction.options.getRole('role');
      const hours = getRequirement(interaction.guildId, role.id);
      return interaction.reply({
        embeds: [
          infoEmbed({
            title: 'Requirement',
            description: hours === null ? `${role} has no requirement configured.` : `${role} requires **${hours} hours** per period.`,
          }),
        ],
        ephemeral: true,
      });
    }

    if (sub === 'run') {
      await interaction.reply({ content: 'Running staff hours report...', ephemeral: true });
      await runStaffHoursReport(interaction.client, interaction.guild);
      await interaction.followUp({
        embeds: [successEmbed({ title: 'Done', description: 'Staff hours report posted.' })],
        ephemeral: true,
      });
    }
  },
};
