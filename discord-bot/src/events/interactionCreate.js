const { PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { isAuthorized } = require('../utils/permissions');
const { loadCommands, getAllCommandData } = require('../handlers/commandHandler');
const { clearAllLoa, endLoa } = require('../services/loaService');
const { clockIn, clockOut, startBreak, endBreak, getActiveSession } = require('../services/dutyService');
const { renderOnce: renderStatusOnce } = require('../services/statusPanelService');
const { renderOnce: renderBoardOnce } = require('../services/dutyBoardService');
const { REST, Routes } = require('discord.js');

async function redeployGuildCommands(client, guild) {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const body = getAllCommandData();
  await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body });
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      return handleSlashCommand(interaction);
    }
    if (interaction.isButton()) {
      return handleButton(interaction);
    }
    if (interaction.isStringSelectMenu()) {
      return handleSelectMenu(interaction);
    }
  },
};

async function handleSlashCommand(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) return;

  if (!isAuthorized(interaction, command.data.name)) {
    return interaction.reply({
      embeds: [
        errorEmbed({
          title: 'Not Authorized',
          description: "You don't have permission to use this command. Ask an admin to whitelist your role with `/permission add`.",
        }),
      ],
      ephemeral: true,
    });
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    logger.error(`Command "${interaction.commandName}" threw an error`, { err: err.message, stack: err.stack });
    const payload = {
      embeds: [errorEmbed({ title: 'Command Error', description: 'Something went wrong running that command. It has been logged.' })],
      ephemeral: true,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
}

function isAdmin(interaction) {
  return interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
}

async function handleButton(interaction) {
  const id = interaction.customId;

  try {
    // ---------- Status panel controls (admin only) ----------
    if (id.startsWith('status_')) {
      if (!isAdmin(interaction)) {
        return interaction.reply({
          embeds: [errorEmbed({ title: 'Not Authorized', description: 'Only administrators can use the status panel controls.' })],
          ephemeral: true,
        });
      }

      if (id === 'status_restart') {
        await interaction.reply({
          embeds: [successEmbed({ title: 'Restarting...', description: 'The bot process is restarting now. Your process manager (pm2/Docker) should bring it back up.' })],
          ephemeral: true,
        });
        logger.warn('Restart triggered via status panel button', { by: interaction.user.tag });
        setTimeout(() => process.exit(0), 500);
        return;
      }

      if (id === 'status_clear_loa') {
        const cleared = await clearAllLoa(interaction.guild, interaction.user.id);
        await interaction.reply({
          embeds: [successEmbed({ title: 'LOA Cleared', description: cleared.length ? `Removed Staff LOA from ${cleared.length} member(s).` : 'Nobody was on LOA.' })],
          ephemeral: true,
        });
        await renderStatusOnce(interaction.client, interaction.guildId);
        return;
      }

      if (id === 'status_fix_commands') {
        await redeployGuildCommands(interaction.client, interaction.guild);
        await interaction.reply({ embeds: [successEmbed({ title: 'Commands Redeployed', description: 'Slash commands have been re-registered for this server.' })], ephemeral: true });
        return;
      }

      if (id === 'status_fix_all') {
        loadCommands(interaction.client);
        await redeployGuildCommands(interaction.client, interaction.guild);
        await interaction.reply({ embeds: [successEmbed({ title: 'Full Command Refresh Complete', description: 'Reloaded all command files from disk and re-registered them.' })], ephemeral: true });
        return;
      }
    }

    // ---------- Duty board controls ----------
    if (id === 'duty_clock_in') {
      const result = await clockIn(interaction.member);
      if (!result.ok) {
        const reasonText =
          result.reason === 'not_in_vc'
            ? 'You need to be in a staff voice channel to clock in.'
            : 'You are already clocked in.';
        return interaction.reply({ embeds: [errorEmbed({ title: 'Cannot Clock In', description: reasonText })], ephemeral: true });
      }
      await interaction.reply({ embeds: [successEmbed({ title: 'Clocked In', description: "You're now on duty." })], ephemeral: true });
      await renderBoardOnce(interaction.client, interaction.guildId);
      return;
    }

    if (id === 'duty_clock_out') {
      const result = await clockOut(interaction.guild, interaction.user.id);
      if (!result.ok) {
        return interaction.reply({ embeds: [errorEmbed({ title: 'Cannot Clock Out', description: 'You are not currently clocked in.' })], ephemeral: true });
      }
      await interaction.reply({ embeds: [successEmbed({ title: 'Clocked Out', description: 'See you next shift!' })], ephemeral: true });
      await renderBoardOnce(interaction.client, interaction.guildId);
      return;
    }

    if (id === 'duty_break') {
      const session = getActiveSession(interaction.guildId, interaction.user.id);
      if (!session) {
        return interaction.reply({ embeds: [errorEmbed({ title: 'Not Clocked In', description: 'Clock in before taking a break.' })], ephemeral: true });
      }
      const result = session.on_break ? endBreak(interaction.guildId, interaction.user.id) : startBreak(interaction.guildId, interaction.user.id);
      await interaction.reply({
        embeds: [successEmbed({ title: session.on_break ? 'Break Ended' : 'Break Started', description: session.on_break ? 'Back on duty!' : 'Enjoy your break.' })],
        ephemeral: true,
      });
      await renderBoardOnce(interaction.client, interaction.guildId);
      return;
    }
  } catch (err) {
    logger.error('Button interaction failed', { customId: id, err: err.message });
    const payload = { embeds: [errorEmbed({ title: 'Error', description: 'Something went wrong handling that button.' })], ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
}

async function handleSelectMenu(interaction) {
  if (interaction.customId === 'status_end_loa_select') {
    if (!isAdmin(interaction)) {
      return interaction.reply({
        embeds: [errorEmbed({ title: 'Not Authorized', description: 'Only administrators can end LOAs from the status panel.' })],
        ephemeral: true,
      });
    }

    const userId = interaction.values[0];
    const result = await endLoa(interaction.guild, userId, interaction.user.id, { early: true });
    await interaction.reply({
      embeds: [successEmbed({ title: 'LOA Ended', description: result ? `Ended LOA for <@${userId}>.` : 'That LOA was already inactive.' })],
      ephemeral: true,
    });
    await renderStatusOnce(interaction.client, interaction.guildId);
  }
}
