const { SlashCommandBuilder } = require('discord.js');
const { addToBlacklist, removeFromBlacklist, getBlacklistEntry, getBlacklist } = require('../../services/blacklistService');
const { successEmbed, errorEmbed, baseEmbed, field, userAuthor, brandAuthor, COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Manage the server blacklist')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a user to the blacklist')
        .addUserOption((o) => o.setName('user').setDescription('The user').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a user from the blacklist')
        .addUserOption((o) => o.setName('user').setDescription('The user').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('check')
        .setDescription('Check if a user is blacklisted')
        .addUserOption((o) => o.setName('user').setDescription('The user').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List all blacklisted users')),

  permissionGroup: 'staff',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      addToBlacklist(interaction.guildId, user.id, reason, interaction.user.id);
      return interaction.reply({
        embeds: [
          baseEmbed({
            color: COLORS.ERROR,
            author: brandAuthor(interaction.guild, 'Blacklist'),
            title: '⛔ User Blacklisted',
            description: `${user} has been added to the blacklist.`,
            thumbnail: user.displayAvatarURL(),
            fields: [field('📝 Reason', reason, false), field('🛡️ By', `${interaction.user}`, true)],
          }),
        ],
      });
    }

    if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      const ok = removeFromBlacklist(interaction.guildId, user.id);
      return interaction.reply({
        embeds: ok
          ? [successEmbed({ title: '✅ Removed', description: `${user} was removed from the blacklist.` })]
          : [errorEmbed({ title: '⛔ Not Found', description: `${user} isn't blacklisted.` })],
        ephemeral: true,
      });
    }

    if (sub === 'check') {
      const user = interaction.options.getUser('user');
      const entry = getBlacklistEntry(interaction.guildId, user.id);
      return interaction.reply({
        embeds: [
          baseEmbed({
            color: entry ? COLORS.ERROR : COLORS.SUCCESS,
            author: userAuthor(user, 'Blacklist Check'),
            title: entry ? '⛔ Blacklisted' : '✅ Not Blacklisted',
            thumbnail: user.displayAvatarURL(),
            description: entry
              ? `${user} is blacklisted.`
              : `${user} is not on the blacklist.`,
            fields: entry
              ? [field('📝 Reason', entry.reason || 'No reason', false), field('🕒 Added', `<t:${Math.floor(entry.created_at / 1000)}:R>`, true), field('🛡️ By', `<@${entry.added_by}>`, true)]
              : [],
          }),
        ],
        ephemeral: true,
      });
    }

    // list
    const rows = getBlacklist(interaction.guildId);
    if (!rows.length) {
      return interaction.reply({
        embeds: [successEmbed({ author: brandAuthor(interaction.guild, 'Blacklist'), title: '📋 Blacklist', description: 'The blacklist is empty. ✅' })],
        ephemeral: true,
      });
    }
    const description = rows.slice(0, 30).map((r) => `⛔ <@${r.user_id}> — ${r.reason || 'No reason'}`).join('\n');
    return interaction.reply({
      embeds: [baseEmbed({ color: COLORS.ERROR, author: brandAuthor(interaction.guild, 'Blacklist'), title: `📋 Blacklist — ${rows.length}`, description })],
      ephemeral: true,
    });
  },
};
