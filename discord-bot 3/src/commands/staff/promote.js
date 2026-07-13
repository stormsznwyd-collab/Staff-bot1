const { SlashCommandBuilder } = require('discord.js');
const { recordAction } = require('../../services/promotionService');
const { successEmbed, errorEmbed, field, brandAuthor } = require('../../utils/embeds');
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
        embeds: [errorEmbed({ title: '⛔ Member Not Found', description: 'That user is not in this server.' })],
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

      const fields = [
        field('👤 Member', `${targetUser}`, true),
        field('🛡️ Promoted By', `${interaction.user}`, true),
        field('🎉 New Role(s)', rolesToAdd.map((r) => `${r}`).join(' '), false),
      ];
      if (roleToRemove) fields.push(field('➖ Removed', `${roleToRemove}`, false));
      fields.push(field('📝 Reason', reason || 'No reason provided', false));

      await interaction.reply({
        embeds: [
          successEmbed({
            author: brandAuthor(interaction.guild, 'Promotions'),
            title: '⬆️ Staff Promotion',
            description: `Congratulations ${targetUser} — you've moved up! 🎉`,
            thumbnail: targetUser.displayAvatarURL(),
            fields,
          }),
        ],
      });

      member
        .send({
          embeds: [
            successEmbed({
              author: brandAuthor(interaction.guild, 'Promotions'),
              title: '🎉 You Were Promoted!',
              description: `Great news — you've been promoted in **${interaction.guild.name}**.`,
              thumbnail: interaction.guild.iconURL() ?? undefined,
              fields: [
                field('🎉 New Role(s)', rolesToAdd.map((r) => r.name).join(', '), false),
                field('📝 Reason', reason || 'No reason provided', false),
              ],
            }),
          ],
        })
        .catch(() => {});
    } catch (err) {
      logger.error('promote command failed', { err: err.message });
      await interaction.reply({
        embeds: [
          errorEmbed({
            title: '⛔ Error',
            description:
              "Something went wrong applying those roles. Make sure the bot's role is positioned **above** the roles you're assigning.",
          }),
        ],
        ephemeral: true,
      });
    }
  },
};
