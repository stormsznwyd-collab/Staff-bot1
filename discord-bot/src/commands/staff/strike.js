const { SlashCommandBuilder } = require('discord.js');
const { addStrike } = require('../../services/strikeService');
const { getConfig } = require('../../database/db');
const { errorEmbed, infoEmbed, COLORS, baseEmbed } = require('../../utils/embeds');
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
        embeds: [errorEmbed({ title: 'Member Not Found', description: 'That user is not in this server.' })],
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

    await interaction.reply({
      embeds: [
        baseEmbed({
          title: `⚠️ Strike ${number} Issued`,
          color: COLORS.WARNING,
          description: [
            `**Member:** <@${targetUser.id}>`,
            `**Issued by:** <@${interaction.user.id}>`,
            `**Reason:** ${reason}`,
          ].join('\n'),
        }),
      ],
    });

    member
      .send({
        embeds: [
          infoEmbed({
            title: `You Received Strike ${number}`,
            description: `You've received strike ${number} in **${interaction.guild.name}**.\n**Reason:** ${reason}`,
          }),
        ],
      })
      .catch(() => {});
  },
};
