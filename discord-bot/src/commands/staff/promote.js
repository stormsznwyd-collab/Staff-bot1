const { SlashCommandBuilder } = require('discord.js');
const { recordAction } = require('../../services/promotionService');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a staff member (supports up to 3 roles to add)')
    .addUserOption((opt) => opt.setName('user').setDescription('The member to promote').setRequired(true))
    .addRoleOption((opt) => opt.setName('role').setDescription('Primary role to add').setRequired(true))
    .addRoleOption((opt) => opt.setName('role2').setDescription('Additional role to add').setRequired(false))
    .addRoleOption((opt) => opt.setName('role3').setDescription('Additional role to add').setRequired(false))
    .addRoleOption((opt) => opt.setName('remove_role').setDescription('Old role to remove, if any').setRequired(false))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the promotion').setRequired(false)),

  permissionGroup: 'staff',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const rolesToAdd = [
      interaction.options.getRole('role'),
      interaction.options.getRole('role2'),
      interaction.options.getRole('role3'),
    ].filter(Boolean);
    const roleToRemove = interaction.options.getRole('remove_role');
    const reason = interaction.options.getString('reason');

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        embeds: [errorEmbed({ title: 'Member Not Found', description: 'That user is not in this server.' })],
        ephemeral: true,
      });
    }

    try {
      await member.roles.add(
        rolesToAdd.map((r) => r.id),
        `Promoted by ${interaction.user.tag}${reason ? `: ${reason}` : ''}`
      );
      if (roleToRemove) {
        await member.roles.remove(roleToRemove.id, `Promotion role cleanup by ${interaction.user.tag}`);
      }

      recordAction(
        interaction.guildId,
        targetUser.id,
        'promote',
        rolesToAdd.map((r) => r.id),
        roleToRemove ? [roleToRemove.id] : [],
        reason,
        interaction.user.id
      );

      await interaction.reply({
        embeds: [
          successEmbed({
            title: '⬆️ Staff Promotion',
            description: [
              `**Member:** <@${targetUser.id}>`,
              `**Promoted by:** <@${interaction.user.id}>`,
              `**Roles added:** ${rolesToAdd.map((r) => r.toString()).join(', ')}`,
              roleToRemove ? `**Role removed:** ${roleToRemove}` : null,
              `**Reason:** ${reason || 'No reason provided'}`,
            ]
              .filter(Boolean)
              .join('\n'),
          }),
        ],
      });

      member
        .send({
          embeds: [
            successEmbed({
              title: 'You Were Promoted!',
              description: `You were promoted in **${interaction.guild.name}** by ${interaction.user.tag}.\n**Reason:** ${
                reason || 'No reason provided'
              }`,
            }),
          ],
        })
        .catch(() => {});
    } catch (err) {
      logger.error('promote command failed', { err: err.message });
      await interaction.reply({
        embeds: [
          errorEmbed({
            title: 'Error',
            description:
              "Something went wrong applying those roles. Make sure the bot's role is positioned above the roles you're assigning.",
          }),
        ],
        ephemeral: true,
      });
    }
  },
};
