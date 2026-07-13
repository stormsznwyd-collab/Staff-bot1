const { SlashCommandBuilder } = require('discord.js');
const { removeStrike, getStrikesForUser } = require('../../services/strikeService');
const { getConfig } = require('../../database/db');
const { successEmbed, errorEmbed, field, brandAuthor } = require('../../utils/embeds');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strikeremove')
    .setDescription('Remove a strike from a staff member')
    .addUserOption((o) => o.setName('user').setDescription('The staff member').setRequired(true))
    .addIntegerOption((o) =>
      o
        .setName('number')
        .setDescription('Which strike to remove (defaults to most recent)')
        .setRequired(false)
        .addChoices({ name: 'Strike 1', value: 1 }, { name: 'Strike 2', value: 2 })
    ),

  permissionGroup: 'staff',

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const number = interaction.options.getInteger('number');
    const removed = removeStrike(interaction.guildId, user.id, number ?? null);

    if (!removed) {
      return interaction.reply({
        embeds: [errorEmbed({ title: '⛔ No Strike Found', description: `${user} has no matching strike to remove.` })],
        ephemeral: true,
      });
    }

    // Remove the strike role if one was configured for that number.
    const roleId = getConfig(interaction.guildId, `strike_role_${removed.strike_number}`);
    if (roleId) {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (member) await member.roles.remove(roleId, `Strike removed by ${interaction.user.tag}`).catch((e) => logger.warn('role remove failed', { e: e.message }));
    }

    const total = getStrikesForUser(interaction.guildId, user.id).length;
    const dots = `${'🔴'.repeat(Math.min(total, 2))}${'⚪'.repeat(Math.max(0, 2 - total))}`;

    await interaction.reply({
      embeds: [
        successEmbed({
          author: brandAuthor(interaction.guild, 'Staff Strikes'),
          title: '✅ Strike Removed',
          description: `Removed **Strike ${removed.strike_number}** from ${user}.`,
          thumbnail: user.displayAvatarURL(),
          fields: [
            field('📊 Remaining', `${dots} **${total}/2**`, true),
            field('🛡️ Removed By', `${interaction.user}`, true),
          ],
        }),
      ],
    });
  },
};
