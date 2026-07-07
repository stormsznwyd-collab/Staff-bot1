const { SlashCommandBuilder } = require('discord.js');
const { recordAction } = require('../../services/promotionService');
const { errorEmbed, baseEmbed, COLORS } = require('../../utils/embeds');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Demote a staff member (supports up to 3 roles to remove)')
    .addUserOption((opt) => opt.setName('user').setDescription('The member to demote').setRequired(true))
    .addRoleOption((opt) => opt.setName('role').setDescription('Primary role to remove').setRequired(true))
    .addRoleOption((opt) => opt.setName('role2').setDescription('Additional role to remove').setRequired(false))
    .addRoleOption((opt) => opt.setName('role3').setDescription('Additional role to remove').setRequired(false))
    .addRoleOption((opt) => opt.setName('add_role').setDescription('New (lower) role to add, if any').setRequired(false))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the demotion').setRequired(false)),

  permissionGroup: 'staff',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const rolesToRemove = [
      interaction.options.getRole('role'),
      interaction.options.getRole('role2'),
      interaction.options.getRole('role3'),
    ].filter(Boolean);
    const roleToAdd = interaction.options.getRole('add_role');
    const reason = interaction.options.getString('reason');

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        embeds: [errorEmbed({ title: 'Member Not Found', description: 'That user is not in this server.' })],
        ephemeral: true,
      });
    }

    try {
      await member.roles.remove(
        rolesToRemove.map((r) => r.id),
        `Demoted by ${interaction.user.tag}${reason ? `: ${reason}` : ''}`
      );
      if (roleToAdd) {
        await member.roles.add(roleToAdd.id, `Demotion role adjustment by ${interaction.user.tag}`);
      }

      recordAction(
        interaction.guildId,
        targetUser.id,
        'demote',
        roleToAdd ? [roleToAdd.id] : [],
        rolesToRemove.map((r) => r.id),
        reason,
        interaction.user.id
      );

      await interaction.reply({
        embeds: [
          baseEmbed({
            title: '⬇️ Staff Demotion',
            color: COLORS.ERROR,
            description: [
              `**Member:** <@${targetUser.id}>`,
              `**Demoted by:** <@${interaction.user.id}>`,
              `**Roles removed:** ${rolesToRemove.map((r) => r.toString()).join(', ')}`,
              roleToAdd ? `**Role added:** ${roleToAdd}` : null,
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
            baseEmbed({
              title: 'Staff Update',
              color: COLORS.ERROR,
              description: `Your roles were changed in **${interaction.guild.name}** by staff.\n**Reason:** ${
                reason || 'No reason provided'
              }`,
            }),
          ],
        })
        .catch(() => {});
    } catch (err) {
      logger.error('demote command failed', { err: err.message });
      await interaction.reply({
        embeds: [
          errorEmbed({
            title: 'Error',
            description:
              "Something went wrong changing those roles. Make sure the bot's role is positioned above the roles you're assigning.",
          }),
        ],
        ephemeral: true,
      });
    }
  },
};
