const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { addCommandPermission, removeCommandPermission, getCommandPermissions } = require('../../database/db');
const { successEmbed, infoEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('permission')
    .setDescription('Whitelist which roles can use a given command')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Allow a role to use a command')
        .addStringOption((opt) => opt.setName('command').setDescription('Command name, e.g. loaacc').setRequired(true))
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to whitelist').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a role from a command whitelist')
        .addStringOption((opt) => opt.setName('command').setDescription('Command name').setRequired(true))
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List whitelisted roles for a command')
        .addStringOption((opt) => opt.setName('command').setDescription('Command name').setRequired(true))
    ),

  permissionGroup: 'admin',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const commandName = interaction.options.getString('command')?.toLowerCase();

    if (sub === 'add') {
      const role = interaction.options.getRole('role');
      addCommandPermission(interaction.guildId, commandName, role.id);
      return interaction.reply({
        embeds: [successEmbed({ title: 'Permission Added', description: `${role} can now use \`/${commandName}\`` })],
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role');
      removeCommandPermission(interaction.guildId, commandName, role.id);
      return interaction.reply({
        embeds: [successEmbed({ title: 'Permission Removed', description: `${role} can no longer use \`/${commandName}\`` })],
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const roleIds = getCommandPermissions(interaction.guildId, commandName);
      const description = roleIds.length
        ? roleIds.map((id) => `<@&${id}>`).join('\n')
        : 'No roles whitelisted (Administrator-only by default).';
      return interaction.reply({
        embeds: [infoEmbed({ title: `Whitelisted Roles for /${commandName}`, description })],
        ephemeral: true,
      });
    }
  },
};
