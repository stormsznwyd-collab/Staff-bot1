const { SlashCommandBuilder } = require('discord.js');
const { addStrike, getStrikesForUser } = require('../../services/strikeService');
const { getConfig } = require('../../database/db');
const { errorEmbed, warnEmbed, baseEmbed, field, brandAuthor, COLORS } = require('../../utils/embeds');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strike')
    .setDescription('Issue a staff strike')
    .addUserOption((opt) => opt.setName('user').setDescription('The staff member to strike').setRequired(true))
    .addIntegerOption((opt) =>
      opt
        .setName('number')
        .setDescription('Which strike is this?')
        .setRequired(true)
        .addChoices({ name: 'Strike 1', value: 1 }, { name: 'Strike 2', value: 2 })
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the strike').setRequired(true)),

  permissionGroup: 'staff',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const number = interaction.options.getInteger('number');
    const reason = interaction.options.getString('reason');

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        embeds: [errorEmbed({ title: '⛔ Member Not Found', description: 'That user is not in this server.' })],
        ephemeral: true,
      });
    }

    // Optional configured strike roles: strike_role_1 / strike_role_2
    const roleId = getConfig(interaction.guildId, `strike_role_${number}`);
    if (roleId) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role) {
        await member.roles.add(role, `Strike ${number} issued by ${interaction.user.tag}`).catch((err) => {
          logger.error('Failed to add strike role', { err: err.message });
        });
      }
    }

    addStrike(interaction.guildId, targetUser.id, number, reason, interaction.user.id);
    const total = getStrikesForUser(interaction.guildId, targetUser.id).length;

    // Strike 2 is more severe -> red; strike 1 -> amber.
    const color = number >= 2 ? COLORS.ERROR : COLORS.WARNING;
    const dots = `${'🔴'.repeat(Math.min(total, 2))}${'⚪'.repeat(Math.max(0, 2 - total))}`;

    await interaction.reply({
      embeds: [
        baseEmbed({
          color,
          author: brandAuthor(interaction.guild, 'Staff Strikes'),
          title: `⚠️ Strike ${number} Issued`,
          description: `A strike has been recorded against ${targetUser}.`,
          thumbnail: targetUser.displayAvatarURL(),
          fields: [
            field('👤 Member', `${targetUser}`, true),
            field('🛡️ Issued By', `${interaction.user}`, true),
            field('📊 Total Strikes', `${dots} **${total}/2**`, true),
            field('📝 Reason', reason, false),
          ],
          footerExtra: total >= 2 ? 'Max strikes reached' : undefined,
        }),
      ],
    });

    member
      .send({
        embeds: [
          warnEmbed({
            author: brandAuthor(interaction.guild, 'Staff Strikes'),
            title: `⚠️ You Received Strike ${number}`,
            description: `You've received a staff strike in **${interaction.guild.name}**. Please review the reason below and reach out to a lead if you have questions.`,
            fields: [
              field('📊 Your Strikes', `${dots} **${total}/2**`, true),
              field('📝 Reason', reason, false),
            ],
          }),
        ],
      })
      .catch(() => {});
  },
};
