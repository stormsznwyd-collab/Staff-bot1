const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { baseEmbed, field, COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('appealpanel')
    .setDescription('Post the public "Submit a Ban Appeal" panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  permissionGroup: 'admin',

  async execute(interaction) {
    const embed = baseEmbed({
      color: COLORS.INFO,
      author: { name: `${interaction.guild.name} • Ban Appeals`, iconURL: interaction.guild.iconURL() ?? undefined },
      title: '📨 Submit a Ban Appeal',
      description: [
        'Were you banned and believe it was a mistake, or want your case reviewed?',
        '',
        'Click the button below to open the appeal form. Be honest and include any evidence — appeals with detail and proof are reviewed fastest.',
      ].join('\n'),
      thumbnail: interaction.guild.iconURL() ?? undefined,
      fields: [
        field('📝 What to include', '• The reason you were banned\n• Your side of the story\n• Any evidence (clips, screenshots)', false),
        field('⏱️ After submitting', "You'll get a confirmation, and a decision by DM once staff review it.", false),
      ],
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('appeal_submit').setLabel('Submit Ban Appeal').setStyle(ButtonStyle.Success).setEmoji('📝')
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({
      embeds: [baseEmbed({ color: COLORS.SUCCESS, title: '✅ Appeal Panel Posted', description: 'The submit-appeal panel is now live in this channel.' })],
      ephemeral: true,
    });
  },
};
