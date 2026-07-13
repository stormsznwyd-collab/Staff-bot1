const { SlashCommandBuilder } = require('discord.js');
const { getRecentSessions } = require('../../services/dutyService');
const { baseEmbed, field, userAuthor, COLORS } = require('../../utils/embeds');
const { formatDuration } = require('../../utils/duration');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shifts')
    .setDescription('Show recent duty sessions for a staff member')
    .addUserOption((o) => o.setName('user').setDescription('Whose shifts to show (defaults to you)').setRequired(false)),

  permissionGroup: 'staff',

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const sessions = getRecentSessions(interaction.guildId, user.id, 10);

    if (!sessions.length) {
      return interaction.reply({
        embeds: [
          baseEmbed({
            color: COLORS.INFO,
            author: userAuthor(user, 'Recent Shifts'),
            title: '🕒 Recent Shifts',
            description: `${user} has no recorded shifts.`,
            thumbnail: user.displayAvatarURL(),
          }),
        ],
        ephemeral: true,
      });
    }

    const now = Date.now();
    const fields = sessions.map((s) => {
      const end = s.clock_out ?? now;
      const workedMs = Math.max(0, end - s.clock_in - (s.break_seconds || 0) * 1000);
      const live = s.clock_out ? '' : ' · 🟢 live';
      const auto = s.auto_clocked_out ? ' · ⏏️ auto-out' : '';
      const brk = s.break_seconds ? ` · ☕ ${formatDuration(s.break_seconds * 1000)}` : '';
      return field(
        `<t:${Math.floor(s.clock_in / 1000)}:f>`,
        `Worked **${formatDuration(workedMs)}**${brk}${auto}${live}`,
        false
      );
    });

    await interaction.reply({
      embeds: [
        baseEmbed({
          color: COLORS.DUTY,
          author: userAuthor(user, 'Recent Shifts'),
          title: `🕒 Recent Shifts — ${sessions.length}`,
          thumbnail: user.displayAvatarURL(),
          fields,
        }),
      ],
      ephemeral: true,
    });
  },
};
