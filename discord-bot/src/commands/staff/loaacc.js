const { SlashCommandBuilder } = require('discord.js');
const { acceptLoa, buildLoaConfirmationEmbed } = require('../../services/loaService');
const { parseDuration, formatDuration } = require('../../utils/duration');
const { errorEmbed, infoEmbed } = require('../../utils/embeds');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loaacc')
    .setDescription("Accept a staff member's leave of absence")
    .addUserOption((opt) => opt.setName('user').setDescription('The staff member going on leave').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('duration').setDescription('e.g. 7d, 12h, 2w. Leave blank for indefinite').setRequired(false)
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the leave').setRequired(false)),

  permissionGroup: 'staff',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const durationInput = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason');

    let durationMs = null;
    if (durationInput) {
      durationMs = parseDuration(durationInput);
      if (durationMs === null) {
        return interaction.reply({
          embeds: [
            errorEmbed({
              title: 'Invalid Duration',
              description: 'Could not parse that duration. Try formats like `7d`, `12h`, `30m`, or `2w`.',
            }),
          ],
          ephemeral: true,
        });
      }
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        embeds: [errorEmbed({ title: 'Member Not Found', description: 'That user is not in this server.' })],
        ephemeral: true,
      });
    }

    try {
      const row = await acceptLoa(interaction.guild, member, interaction.user, durationMs, reason);

      await interaction.reply({
        embeds: [buildLoaConfirmationEmbed(interaction.guild, member, interaction.user, row)],
      });

      member
        .send({
          embeds: [
            infoEmbed({
              title: 'Your Leave of Absence Was Accepted',
              description: [
                `Your LOA in **${interaction.guild.name}** has been accepted by ${interaction.user.tag}.`,
                `**Duration:** ${durationMs ? formatDuration(durationMs) : 'Indefinite'}`,
                `**Reason:** ${row.reason}`,
              ].join('\n'),
            }),
          ],
        })
        .catch(() => logger.warn('Could not DM LOA acceptance', { userId: member.id }));
    } catch (err) {
      logger.error('loaacc command failed', { err: err.message });
      await interaction.reply({
        embeds: [errorEmbed({ title: 'Error', description: 'Something went wrong accepting that LOA. Check the bot logs.' })],
        ephemeral: true,
      });
    }
  },
};
