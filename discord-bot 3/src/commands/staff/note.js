const { SlashCommandBuilder } = require('discord.js');
const { addNote, getNotes, removeNote } = require('../../services/notesService');
const { successEmbed, errorEmbed, baseEmbed, field, userAuthor, brandAuthor, COLORS } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Log informal notes about a staff member')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a note')
        .addUserOption((o) => o.setName('user').setDescription('The staff member').setRequired(true))
        .addStringOption((o) => o.setName('note').setDescription('The note').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List notes for a staff member')
        .addUserOption((o) => o.setName('user').setDescription('The staff member').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a note by its ID')
        .addIntegerOption((o) => o.setName('id').setDescription('Note ID (from /note list)').setRequired(true))
    ),

  permissionGroup: 'staff',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      const note = interaction.options.getString('note');
      const id = addNote(interaction.guildId, user.id, note, interaction.user.id);
      return interaction.reply({
        embeds: [
          successEmbed({
            author: brandAuthor(interaction.guild, 'Staff Notes'),
            title: '📝 Note Added',
            description: `Logged note **#${id}** for ${user}.`,
            fields: [field('🗒️ Note', note, false)],
          }),
        ],
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const user = interaction.options.getUser('user');
      const notes = getNotes(interaction.guildId, user.id);
      if (!notes.length) {
        return interaction.reply({
          embeds: [
            baseEmbed({ color: COLORS.INFO, author: userAuthor(user, 'Notes'), title: '📝 Notes', description: `${user} has no notes.`, thumbnail: user.displayAvatarURL() }),
          ],
          ephemeral: true,
        });
      }
      const fields = notes.slice(0, 20).map((n) => field(`#${n.id} — <t:${Math.floor(n.created_at / 1000)}:D>`, `${n.note}\n> — <@${n.added_by}>`, false));
      return interaction.reply({
        embeds: [baseEmbed({ color: COLORS.INFO, author: userAuthor(user, 'Notes'), title: `📝 Notes — ${notes.length}`, thumbnail: user.displayAvatarURL(), fields })],
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      const id = interaction.options.getInteger('id');
      const ok = removeNote(interaction.guildId, id);
      return interaction.reply({
        embeds: ok
          ? [successEmbed({ title: '✅ Note Removed', description: `Note **#${id}** was removed.` })]
          : [errorEmbed({ title: '⛔ Not Found', description: `No note with ID **#${id}**.` })],
        ephemeral: true,
      });
    }
  },
};
