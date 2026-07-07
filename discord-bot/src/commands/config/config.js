const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setConfig, getConfig, getAllConfig } = require('../../database/db');
const { successEmbed, infoEmbed } = require('../../utils/embeds');

const KNOWN_KEYS = [
  'ticket_category_id',
  'staff_hours_channel_id',
  'top_hours_channel_id',
  'duty_vc_ids',
  'hours_period_days',
  'strike_role_1',
  'strike_role_2',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Manage bot configuration (channel IDs, category IDs, etc.)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set a config value')
        .addStringOption((opt) =>
          opt.setName('key').setDescription('Config key').setRequired(true).addChoices(...KNOWN_KEYS.map((k) => ({ name: k, value: k })))
        )
        .addStringOption((opt) => opt.setName('value').setDescription('Value (usually an ID)').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('get')
        .setDescription('Get a config value')
        .addStringOption((opt) => opt.setName('key').setDescription('Config key').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List all configured values')),

  permissionGroup: 'admin',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const key = interaction.options.getString('key');
      const value = interaction.options.getString('value');
      setConfig(interaction.guildId, key, value);
      return interaction.reply({
        embeds: [successEmbed({ title: 'Config Updated', description: `**${key}** set to \`${value}\`` })],
        ephemeral: true,
      });
    }

    if (sub === 'get') {
      const key = interaction.options.getString('key');
      const value = getConfig(interaction.guildId, key, '_not set_');
      return interaction.reply({
        embeds: [infoEmbed({ title: 'Config Value', description: `**${key}**: \`${value}\`` })],
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const rows = getAllConfig(interaction.guildId);
      const description = rows.length
        ? rows.map((r) => `**${r.key}**: \`${r.value}\``).join('\n')
        : 'No config set yet.';
      return interaction.reply({
        embeds: [infoEmbed({ title: 'All Config Values', description })],
        ephemeral: true,
      });
    }
  },
};
