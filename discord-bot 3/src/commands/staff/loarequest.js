const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { parseDuration, formatDuration } = require('../../utils/duration');
const { createRequest, getPendingForUser, setMessageRef } = require('../../services/loaRequestService');
const { getActiveLoaForUser } = require('../../services/loaService');
const { getConfig } = require('../../database/db');
const { errorEmbed, successEmbed, goldEmbed, field, brandAuthor } = require('../../utils/embeds');

const CHANNEL_KEY = 'loa_request_channel_id';
const PING_KEY = 'loa_request_ping_role_id';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loarequest')
    .setDescription('Request a leave of absence for a lead to approve')
    .addStringOption((o) => o.setName('duration').setDescription('e.g. 7d, 12h, 2w. Leave blank for indefinite').setRequired(false))
    .addStringOption((o) => o.setName('reason').setDescription('Why you need the leave').setRequired(false)),

  permissionGroup: 'staff',

  async execute(interaction) {
    if (getActiveLoaForUser(interaction.guildId, interaction.user.id)) {
      return interaction.reply({ embeds: [errorEmbed({ title: '⛔ Already on LOA', description: "You're already on LOA." })], ephemeral: true });
    }
    if (getPendingForUser(interaction.guildId, interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed({ title: '⛔ Request Pending', description: 'You already have an LOA request awaiting a decision.' })],
        ephemeral: true,
      });
    }

    const durationInput = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    let durationMs = null;
    if (durationInput) {
      durationMs = parseDuration(durationInput);
      if (durationMs === null) {
        return interaction.reply({
          embeds: [errorEmbed({ title: '⛔ Invalid Duration', description: 'Try formats like `7d`, `12h`, `2w`, or `1d12h`.' })],
          ephemeral: true,
        });
      }
    }

    const req = createRequest(interaction.guildId, interaction.user.id, durationMs, reason);

    const targetChannelId = getConfig(interaction.guildId, CHANNEL_KEY);
    let channel = interaction.channel;
    if (targetChannelId) channel = (await interaction.guild.channels.fetch(targetChannelId).catch(() => null)) || interaction.channel;

    const pingRole = getConfig(interaction.guildId, PING_KEY);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`loareq_approve:${req.id}`).setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId(`loareq_deny:${req.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('⛔')
    );

    const msg = await channel.send({
      content: pingRole ? `<@&${pingRole}>` : undefined,
      embeds: [
        goldEmbed({
          author: brandAuthor(interaction.guild, 'LOA Request'),
          title: '🌴 New LOA Request',
          thumbnail: interaction.user.displayAvatarURL(),
          fields: [
            field('👤 Staff', `${interaction.user}`, true),
            field('⏳ Duration', durationMs ? formatDuration(durationMs) : 'Indefinite', true),
            field('📝 Reason', reason, false),
          ],
          footerExtra: `Request #${req.id}`,
        }),
      ],
      components: [row],
    });
    setMessageRef(req.id, channel.id, msg.id);

    await interaction.reply({
      embeds: [successEmbed({ title: '✅ Request Submitted', description: `Your LOA request (**#${req.id}**) was sent to leads for approval.` })],
      ephemeral: true,
    });
  },
};
