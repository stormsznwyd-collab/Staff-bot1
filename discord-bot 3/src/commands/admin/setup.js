const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ensureLoaRole } = require('../../services/loaService');
const { getConfig, setConfig } = require('../../database/db');
const { successEmbed, field, brandAuthor } = require('../../utils/embeds');

const DEFAULT_DUTY_VCS = [
  '1522410107244249108',
  '1522410292544540875',
  '1522411031949873203',
  '1522415002840072332',
].join(',');

const DEFAULT_STAFF_HOURS_CHANNEL = '1523883591317065801';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('One-time setup: creates the Staff LOA role and seeds default channel config')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  permissionGroup: 'admin',

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const role = await ensureLoaRole(interaction.guild);

    if (!getConfig(interaction.guildId, 'duty_vc_ids')) {
      setConfig(interaction.guildId, 'duty_vc_ids', DEFAULT_DUTY_VCS);
    }
    if (!getConfig(interaction.guildId, 'staff_hours_channel_id')) {
      setConfig(interaction.guildId, 'staff_hours_channel_id', DEFAULT_STAFF_HOURS_CHANNEL);
    }

    await interaction.editReply({
      embeds: [
        successEmbed({
          author: brandAuthor(interaction.guild, 'Setup'),
          title: '✅ Setup Complete',
          description: 'Your core staff-management config is ready to go.',
          thumbnail: interaction.guild.iconURL() ?? undefined,
          fields: [
            field('🌴 Staff LOA Role', `${role}`, false),
            field('🎙️ Duty VCs', DEFAULT_DUTY_VCS.split(',').map((id) => `<#${id}>`).join(' '), false),
            field('📊 Staff Hours Channel', `<#${DEFAULT_STAFF_HOURS_CHANNEL}>`, false),
            field(
              '➡️ Next Steps',
              [
                '• `/statuspanel` & `/dutyboard` in their channels',
                '• `/permission add` to whitelist staff roles',
                '• `/config set` for ticket category & top-hours channel',
              ].join('\n'),
              false
            ),
          ],
        }),
      ],
    });
  },
};
