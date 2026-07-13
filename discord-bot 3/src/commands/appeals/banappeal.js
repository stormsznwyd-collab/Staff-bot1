const { SlashCommandBuilder } = require('discord.js');
const {
  STATUS,
  DETECTIONS,
  createAppeal,
  getLatestForUser,
  getPendingAppeals,
  getAppealChannelId,
  getPingRoleId,
  setMessageRef,
  setStatus,
  buildAppealEmbed,
  buildManagementEmbed,
  buildStatusSelect,
  appealNoticePayload,
  META,
} = require('../../services/appealService');
const { errorEmbed, successEmbed, baseEmbed, field, COLORS } = require('../../utils/embeds');
const logger = require('../../utils/logger');

/** Posts (or reuses) the management panel with the status dropdown. */
async function postManagementPanel(interaction, appeal) {
  const targetChannelId = getAppealChannelId(interaction.guildId);
  let channel = interaction.channel;
  if (targetChannelId) {
    channel = await interaction.guild.channels.fetch(targetChannelId).catch(() => interaction.channel);
  }
  const pingRole = getPingRoleId(interaction.guildId);
  const msg = await channel.send({
    content: pingRole ? `<@&${pingRole}>` : undefined,
    embeds: [buildManagementEmbed(interaction.guild, appeal)],
    components: [buildStatusSelect(appeal.id, appeal.status)],
  });
  setMessageRef(appeal.id, channel.id, msg.id);
  return { channel, msg };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banappeal')
    .setDescription('Manage ban appeals')
    .addSubcommand((sub) =>
      sub
        .setName('open')
        .setDescription('Open a ban appeal and post the status dropdown for staff to decide')
        .addUserOption((o) => o.setName('user').setDescription('The user appealing').setRequired(true))
        .addStringOption((o) => o.setName('ban_reason').setDescription('What they were originally banned for').setRequired(false))
        .addStringOption((o) => o.setName('appeal').setDescription("The user's appeal / their side").setRequired(false))
        .addStringOption((o) => o.setName('evidence').setDescription('Evidence link(s)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('anticheat')
        .setDescription('Issue an anti-cheat ban and notify the user')
        .addUserOption((o) => o.setName('user').setDescription('The banned user').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('detection')
            .setDescription('What was detected')
            .setRequired(false)
            .addChoices(...Object.entries(DETECTIONS).map(([value, name]) => ({ name, value })))
        )
        .addBooleanOption((o) => o.setName('appealable').setDescription('Can this ban be appealed? (default: yes)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription("Check a user's latest ban appeal status")
        .addUserOption((o) => o.setName('user').setDescription('The user to look up').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List all pending ban appeals')),

  permissionGroup: 'staff',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // -------- open --------
    if (sub === 'open') {
      const user = interaction.options.getUser('user');
      const { getLatestBan } = require('../../services/banLogService');
      const latestBan = getLatestBan(interaction.guildId, user.id);
      const appeal = createAppeal(interaction.guildId, user.id, {
        banReason: interaction.options.getString('ban_reason') || latestBan?.reason || null,
        appealText: interaction.options.getString('appeal'),
        evidence: interaction.options.getString('evidence'),
        status: STATUS.PENDING,
      });

      await interaction.deferReply({ ephemeral: true });
      const { channel } = await postManagementPanel(interaction, appeal);

      // Let the user know it's under review.
      const payload = await appealNoticePayload(STATUS.PENDING, interaction.guild, appeal, { username: user.username });
      user.send(payload).catch(() => logger.warn('Could not DM appeal-opened notice', { userId: user.id }));

      return interaction.editReply({
        embeds: [
          successEmbed({
            title: '✅ Appeal Opened',
            description: `Opened **Case #${appeal.id}** for ${user} in ${channel}. Use the dropdown there to set the outcome.`,
          }),
        ],
      });
    }

    // -------- anticheat --------
    if (sub === 'anticheat') {
      const user = interaction.options.getUser('user');
      const detection = interaction.options.getString('detection') || 'other';
      const appealable = interaction.options.getBoolean('appealable');
      const appeal = createAppeal(interaction.guildId, user.id, {
        status: STATUS.ANTICHEAT,
        detection,
        appealable: appealable === false ? 0 : 1,
        banReason: `Anti-Cheat: ${DETECTIONS[detection] || detection}`,
      });
      setStatus(appeal.id, STATUS.ANTICHEAT, { reviewedBy: interaction.user.id, guildId: interaction.guildId });
      const fresh = { ...appeal, reviewed_by: interaction.user.id };

      await interaction.deferReply({ ephemeral: true });
      await postManagementPanel(interaction, fresh);

      const acPayload = await appealNoticePayload(STATUS.ANTICHEAT, interaction.guild, fresh, {
        reviewer: interaction.user.id,
        username: user.username,
      });
      user.send(acPayload).catch(() => logger.warn('Could not DM anti-cheat notice', { userId: user.id }));

      return interaction.editReply({
        embeds: [
          baseEmbed({
            color: COLORS.DUTY,
            title: '🛡️ Anti-Cheat Ban Issued',
            description: `Logged **Case #${appeal.id}** for ${user} and notified them via DM.`,
            fields: [field('🔎 Detection', DETECTIONS[detection] || detection, true), field('📩 Appealable', appealable === false ? 'No' : 'Yes', true)],
          }),
        ],
      });
    }

    // -------- status --------
    if (sub === 'status') {
      const user = interaction.options.getUser('user');
      const appeal = getLatestForUser(interaction.guildId, user.id);
      if (!appeal) {
        return interaction.reply({
          embeds: [errorEmbed({ title: '📁 No Appeal Found', description: `${user} has no ban appeals on record.` })],
          ephemeral: true,
        });
      }
      const meta = META[appeal.status] || META.pending;
      return interaction.reply({
        embeds: [
          baseEmbed({
            color: meta.color,
            author: { name: `${interaction.guild.name} • Ban Appeals`, iconURL: interaction.guild.iconURL() ?? undefined },
            title: `📁 Ban Appeal #${appeal.id}`,
            thumbnail: user.displayAvatarURL(),
            fields: [
              field('👤 Member', `${user}`, true),
              field('📊 Status', `${meta.dot} **${meta.statusLabel}**`, true),
              field('🕒 Submitted', `<t:${Math.floor(appeal.created_at / 1000)}:R>`, true),
              appeal.reviewed_by ? field('🛡️ Reviewed By', `<@${appeal.reviewed_by}>`, true) : null,
              appeal.cooldown_until && appeal.status === STATUS.DENIED
                ? field('🔁 May Reapply', `<t:${Math.floor(appeal.cooldown_until / 1000)}:R>`, true)
                : null,
            ].filter(Boolean),
          }),
        ],
        ephemeral: true,
      });
    }

    // -------- list --------
    if (sub === 'list') {
      const rows = getPendingAppeals(interaction.guildId);
      if (!rows.length) {
        return interaction.reply({
          embeds: [successEmbed({ title: '📁 Pending Appeals', description: 'No appeals are pending review. All caught up! ✅' })],
          ephemeral: true,
        });
      }
      const description = rows
        .map((r) => `🕒 **#${r.id}** — <@${r.user_id}> — submitted <t:${Math.floor(r.created_at / 1000)}:R>`)
        .join('\n');
      return interaction.reply({
        embeds: [
          baseEmbed({
            color: META.pending.color,
            author: { name: `${interaction.guild.name} • Ban Appeals`, iconURL: interaction.guild.iconURL() ?? undefined },
            title: `📁 Pending Appeals — ${rows.length}`,
            description,
          }),
        ],
        ephemeral: true,
      });
    }
  },
};
