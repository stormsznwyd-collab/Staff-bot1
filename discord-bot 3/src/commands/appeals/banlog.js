const { SlashCommandBuilder } = require('discord.js');
const { addBan, getBansForUser } = require('../../services/banLogService');
const { successEmbed, baseEmbed, field, userAuthor, brandAuthor, COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banlog')
    .setDescription('Record and review bans (so appeals can reference them)')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Log a ban')
        .addUserOption((o) => o.setName('user').setDescription('The banned user').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Ban reason').setRequired(true))
        .addStringOption((o) => o.setName('evidence').setDescription('Evidence link(s)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription("View a user's ban history")
        .addUserOption((o) => o.setName('user').setDescription('The user to look up').setRequired(true))
    ),

  permissionGroup: 'staff',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');

    if (sub === 'add') {
      const reason = interaction.options.getString('reason');
      const evidence = interaction.options.getString('evidence');
      const id = addBan(interaction.guildId, user.id, reason, evidence, interaction.user.id);
      return interaction.reply({
        embeds: [
          successEmbed({
            author: brandAuthor(interaction.guild, 'Ban Log'),
            title: '🚫 Ban Logged',
            description: `Recorded ban **#${id}** for ${user}.`,
            thumbnail: user.displayAvatarURL(),
            fields: [
              field('📝 Reason', reason, false),
              evidence ? field('📎 Evidence', evidence, false) : null,
              field('🛡️ Banned By', `${interaction.user}`, true),
            ].filter(Boolean),
          }),
        ],
      });
    }

    // view
    const bans = getBansForUser(interaction.guildId, user.id);
    if (!bans.length) {
      return interaction.reply({
        embeds: [baseEmbed({ color: COLORS.INFO, author: userAuthor(user, 'Ban Log'), title: '🚫 Ban Log', description: `${user} has no logged bans.`, thumbnail: user.displayAvatarURL() })],
        ephemeral: true,
      });
    }
    const fields = bans.slice(0, 15).map((b) =>
      field(
        `${b.active ? '🔴' : '⚪'} #${b.id} — <t:${Math.floor(b.created_at / 1000)}:D>`,
        `> **Reason:** ${b.reason}\n> **By:** <@${b.banned_by}>${b.evidence ? `\n> **Evidence:** ${b.evidence}` : ''}`,
        false
      )
    );
    return interaction.reply({
      embeds: [baseEmbed({ color: COLORS.ERROR, author: userAuthor(user, 'Ban Log'), title: `🚫 Ban Log — ${bans.length}`, thumbnail: user.displayAvatarURL(), fields })],
      ephemeral: true,
    });
  },
};
