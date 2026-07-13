const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { isAuthorized } = require('../utils/permissions');
const { loadCommands, getAllCommandData } = require('../handlers/commandHandler');
const { clearAllLoa, endLoa } = require('../services/loaService');
const { clockIn, clockOut, startBreak, endBreak, getActiveSession } = require('../services/dutyService');
const { renderOnce: renderStatusOnce } = require('../services/statusPanelService');
const { renderOnce: renderBoardOnce } = require('../services/dutyBoardService');
const appeals = require('../services/appealService');
const loaRequests = require('../services/loaRequestService');
const { acceptLoa } = require('../services/loaService');
const { formatDuration } = require('../utils/duration');
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
    if (interaction.isModalSubmit()) {
      return handleModal(interaction);
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
          title: '⛔ Not Authorized',
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
      embeds: [errorEmbed({ title: '⛔ Command Error', description: 'Something went wrong running that command. It has been logged.' })],
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
          embeds: [errorEmbed({ title: '⛔ Not Authorized', description: 'Only administrators can use the status panel controls.' })],
          ephemeral: true,
        });
      }

      if (id === 'status_restart') {
        await interaction.reply({
          embeds: [successEmbed({ title: '🔄 Restarting…', description: 'The bot process is restarting now. Your process manager (pm2/Docker) should bring it back up.' })],
          ephemeral: true,
        });
        logger.warn('Restart triggered via status panel button', { by: interaction.user.tag });
        setTimeout(() => process.exit(0), 500);
        return;
      }

      if (id === 'status_clear_loa') {
        const cleared = await clearAllLoa(interaction.guild, interaction.user.id);
        await interaction.reply({
          embeds: [successEmbed({ title: '🧹 LOA Cleared', description: cleared.length ? `Removed Staff LOA from ${cleared.length} member(s).` : 'Nobody was on LOA.' })],
          ephemeral: true,
        });
        await renderStatusOnce(interaction.client, interaction.guildId);
        return;
      }

      if (id === 'status_fix_commands') {
        await redeployGuildCommands(interaction.client, interaction.guild);
        await interaction.reply({ embeds: [successEmbed({ title: '🛠️ Commands Redeployed', description: 'Slash commands have been re-registered for this server.' })], ephemeral: true });
        return;
      }

      if (id === 'status_fix_all') {
        loadCommands(interaction.client);
        await redeployGuildCommands(interaction.client, interaction.guild);
        await interaction.reply({ embeds: [successEmbed({ title: '🧰 Full Command Refresh Complete', description: 'Reloaded all command files from disk and re-registered them.' })], ephemeral: true });
        return;
      }
    }

    // ---------- LOA request approve / deny ----------
    if (id.startsWith('loareq_approve:') || id.startsWith('loareq_deny:')) {
      if (!isAdmin(interaction) && !isAuthorized(interaction, 'loaacc')) {
        return interaction.reply({
          embeds: [errorEmbed({ title: '⛔ Not Authorized', description: 'You do not have permission to approve LOA requests.' })],
          ephemeral: true,
        });
      }
      const approve = id.startsWith('loareq_approve:');
      const reqId = Number(id.split(':')[1]);
      const req = loaRequests.getRequest(reqId);
      if (!req) {
        return interaction.reply({ embeds: [errorEmbed({ title: '⛔ Not Found', description: 'That request no longer exists.' })], ephemeral: true });
      }
      if (req.status !== 'pending') {
        return interaction.reply({ embeds: [errorEmbed({ title: '⛔ Already Decided', description: `This request was already ${req.status}.` })], ephemeral: true });
      }

      await interaction.deferUpdate();
      loaRequests.decide(reqId, approve ? 'approved' : 'denied', interaction.user.id);
      const member = await interaction.guild.members.fetch(req.user_id).catch(() => null);

      if (approve && member) {
        await acceptLoa(interaction.guild, member, interaction.user, req.duration_ms, req.reason);
      }

      const resultEmbed = (approve ? successEmbed : errorEmbed)({
        title: approve ? '✅ LOA Request Approved' : '⛔ LOA Request Denied',
        description: `Request **#${reqId}** for <@${req.user_id}> was ${approve ? 'approved' : 'denied'} by ${interaction.user}.`,
      });
      await interaction.editReply({ embeds: [resultEmbed], components: [] });

      member
        ?.send({
          embeds: [
            (approve ? successEmbed : errorEmbed)({
              title: approve ? '✅ Your LOA Request Was Approved' : '⛔ Your LOA Request Was Denied',
              description: approve
                ? `Your LOA in **${interaction.guild.name}** is now active${req.duration_ms ? ` for ${formatDuration(req.duration_ms)}` : ''}.`
                : `Your LOA request in **${interaction.guild.name}** was denied. Reach out to a lead if you have questions.`,
            }),
          ],
        })
        .catch(() => {});
      return;
    }

    // ---------- Ban appeal: open the submit form ----------
    if (id === 'appeal_submit') {
      const cooldownTs = appeals.activeCooldown(interaction.guildId, interaction.user.id);
      if (cooldownTs) {
        return interaction.reply({
          embeds: [
            errorEmbed({
              title: '⛔ Appeal on Cooldown',
              description: `Your last appeal was denied. You can submit a new appeal <t:${Math.floor(cooldownTs / 1000)}:R>.`,
            }),
          ],
          ephemeral: true,
        });
      }
      const existing = appeals.getPendingForUser(interaction.guildId, interaction.user.id);
      if (existing) {
        return interaction.reply({
          embeds: [
            errorEmbed({
              title: '⛔ Appeal Already Pending',
              description: `You already have a pending appeal (**Case #${existing.id}**). Please wait for staff to review it.`,
            }),
          ],
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder().setCustomId('appeal_submit_modal').setTitle('Submit a Ban Appeal');
      const banReason = new TextInputBuilder()
        .setCustomId('ban_reason')
        .setLabel('Why were you banned?')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(300);
      const appealText = new TextInputBuilder()
        .setCustomId('appeal_text')
        .setLabel('Your appeal — why should we unban you?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);
      const evidence = new TextInputBuilder()
        .setCustomId('evidence')
        .setLabel('Evidence link(s) — optional')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(300);
      modal.addComponents(
        new ActionRowBuilder().addComponents(banReason),
        new ActionRowBuilder().addComponents(appealText),
        new ActionRowBuilder().addComponents(evidence)
      );
      return interaction.showModal(modal);
    }

    // ---------- Duty board controls ----------
    if (id === 'duty_clock_in') {
      const result = await clockIn(interaction.member);
      if (!result.ok) {
        const reasonText =
          result.reason === 'not_in_vc'
            ? 'You need to be in a staff voice channel to clock in.'
            : 'You are already clocked in.';
        return interaction.reply({ embeds: [errorEmbed({ title: '⛔ Cannot Clock In', description: reasonText })], ephemeral: true });
      }
      await interaction.reply({ embeds: [successEmbed({ title: '🟢 Clocked In', description: "You're now on duty. Have a good shift!" })], ephemeral: true });
      await renderBoardOnce(interaction.client, interaction.guildId);
      return;
    }

    if (id === 'duty_clock_out') {
      const result = await clockOut(interaction.guild, interaction.user.id);
      if (!result.ok) {
        return interaction.reply({ embeds: [errorEmbed({ title: '⛔ Cannot Clock Out', description: 'You are not currently clocked in.' })], ephemeral: true });
      }
      await interaction.reply({ embeds: [successEmbed({ title: '🔴 Clocked Out', description: 'Your shift time has been saved. See you next time!' })], ephemeral: true });
      await renderBoardOnce(interaction.client, interaction.guildId);
      return;
    }

    if (id === 'duty_break') {
      const session = getActiveSession(interaction.guildId, interaction.user.id);
      if (!session) {
        return interaction.reply({ embeds: [errorEmbed({ title: '⛔ Not Clocked In', description: 'Clock in before taking a break.' })], ephemeral: true });
      }
      const result = session.on_break ? endBreak(interaction.guildId, interaction.user.id) : startBreak(interaction.guildId, interaction.user.id);
      await interaction.reply({
        embeds: [successEmbed({ title: session.on_break ? '▶️ Break Ended' : '☕ Break Started', description: session.on_break ? 'Back on duty!' : 'Enjoy your break.' })],
        ephemeral: true,
      });
      await renderBoardOnce(interaction.client, interaction.guildId);
      return;
    }
  } catch (err) {
    logger.error('Button interaction failed', { customId: id, err: err.message });
    const payload = { embeds: [errorEmbed({ title: '⛔ Error', description: 'Something went wrong handling that button.' })], ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
}

async function handleSelectMenu(interaction) {
  // ---------- Ban appeal status dropdown ----------
  if (interaction.customId.startsWith('appeal_status:')) {
    if (!isAdmin(interaction) && !isAuthorized(interaction, 'banappeal')) {
      return interaction.reply({
        embeds: [errorEmbed({ title: '⛔ Not Authorized', description: 'You do not have permission to manage ban appeals.' })],
        ephemeral: true,
      });
    }

    const appealId = Number(interaction.customId.split(':')[1]);
    const chosen = interaction.values[0];
    const appeal = appeals.getAppeal(appealId);
    if (!appeal) {
      return interaction.reply({ embeds: [errorEmbed({ title: '⛔ Appeal Not Found', description: 'That appeal no longer exists.' })], ephemeral: true });
    }

    await interaction.deferUpdate();

    const updated = appeals.setStatus(appealId, chosen, { reviewedBy: interaction.user.id, guildId: interaction.guildId });

    // Notify the user with the themed card image (falls back to embed).
    const user = await interaction.client.users.fetch(updated.user_id).catch(() => null);
    let dmOk = false;
    if (user) {
      const payload = await appeals.appealNoticePayload(chosen, interaction.guild, updated, {
        reviewer: interaction.user.id,
        username: user.username,
      });
      dmOk = await user
        .send(payload)
        .then(() => true)
        .catch(() => false);
    }

    // Refresh the management panel in place.
    await interaction.editReply({
      embeds: [appeals.buildManagementEmbed(interaction.guild, updated)],
      components: [appeals.buildStatusSelect(appealId, chosen)],
    });

    const meta = appeals.META[chosen];
    await interaction.followUp({
      embeds: [
        successEmbed({
          title: `${meta.emoji} Appeal Updated`,
          description: `**Case #${appealId}** set to **${meta.statusLabel}**.${dmOk ? ' The member was notified by DM.' : ' ⚠️ Could not DM the member (their DMs may be closed).'}`,
        }),
      ],
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === 'status_end_loa_select') {
    if (!isAdmin(interaction)) {
      return interaction.reply({
        embeds: [errorEmbed({ title: '⛔ Not Authorized', description: 'Only administrators can end LOAs from the status panel.' })],
        ephemeral: true,
      });
    }

    const userId = interaction.values[0];
    const result = await endLoa(interaction.guild, userId, interaction.user.id, { early: true });
    await interaction.reply({
      embeds: [successEmbed({ title: '✅ LOA Ended', description: result ? `Ended LOA for <@${userId}>.` : 'That LOA was already inactive.' })],
      ephemeral: true,
    });
    await renderStatusOnce(interaction.client, interaction.guildId);
  }
}

async function handleModal(interaction) {
  if (interaction.customId !== 'appeal_submit_modal') return;

  try {
    // Re-check cooldown / duplicate at submit time.
    const cooldownTs = appeals.activeCooldown(interaction.guildId, interaction.user.id);
    if (cooldownTs) {
      return interaction.reply({
        embeds: [errorEmbed({ title: '⛔ Appeal on Cooldown', description: `You can submit a new appeal <t:${Math.floor(cooldownTs / 1000)}:R>.` })],
        ephemeral: true,
      });
    }
    if (appeals.getPendingForUser(interaction.guildId, interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed({ title: '⛔ Appeal Already Pending', description: 'You already have an appeal awaiting review.' })],
        ephemeral: true,
      });
    }

    const appeal = appeals.createAppeal(interaction.guildId, interaction.user.id, {
      banReason: interaction.fields.getTextInputValue('ban_reason') || null,
      appealText: interaction.fields.getTextInputValue('appeal_text'),
      evidence: interaction.fields.getTextInputValue('evidence') || null,
      status: appeals.STATUS.PENDING,
    });

    // Post the management panel (with dropdown) to the configured appeal channel.
    const targetChannelId = appeals.getAppealChannelId(interaction.guildId);
    if (targetChannelId) {
      const channel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);
      if (channel) {
        const pingRole = appeals.getPingRoleId(interaction.guildId);
        const msg = await channel.send({
          content: pingRole ? `<@&${pingRole}>` : undefined,
          embeds: [appeals.buildManagementEmbed(interaction.guild, appeal)],
          components: [appeals.buildStatusSelect(appeal.id, appeal.status)],
        });
        appeals.setMessageRef(appeal.id, channel.id, msg.id);
      } else {
        logger.warn('Appeal channel configured but not found', { guildId: interaction.guildId });
      }
    } else {
      logger.warn('No appeal_channel_id configured — appeal not routed to a review channel', { guildId: interaction.guildId });
    }

    // Confirm to the user with the "Submitted" card (falls back to embed), and DM the same.
    const payload = await appeals.appealNoticePayload(appeals.STATUS.PENDING, interaction.guild, appeal, {
      username: interaction.user.username,
    });
    await interaction.reply({ ...payload, ephemeral: true });
    interaction.user.send(payload).catch(() => {});
  } catch (err) {
    logger.error('Appeal modal submit failed', { err: err.message });
    const payload = { embeds: [errorEmbed({ title: '⛔ Error', description: 'Something went wrong submitting your appeal. Please try again later.' })], ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
}
