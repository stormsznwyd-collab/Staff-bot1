const { getCommandPermissions } = require('../database/db');
const { PermissionFlagsBits } = require('discord.js');

/**
 * Checks whether the interacting member is allowed to run `commandName`.
 *
 * Rules:
 *  - Server Administrators can always run every command.
 *  - If the command has whitelisted roles configured (via /permission), the member
 *    must have at least one of them.
 *  - If NO roles have been whitelisted yet for that command, it is locked to
 *    Administrator-only as a safe default until you configure it with /permission.
 */
function isAuthorized(interaction, commandName) {
  const member = interaction.member;
  if (!member) return false;

  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;

  const allowedRoles = getCommandPermissions(interaction.guildId, commandName);

  if (allowedRoles.length === 0) {
    // Not configured yet -> Administrator only (already returned true above if applicable)
    return false;
  }

  return member.roles.cache.some((role) => allowedRoles.includes(role.id));
}

module.exports = { isAuthorized };
