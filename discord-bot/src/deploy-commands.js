require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { getAllCommandData } = require('./handlers/commandHandler');
const logger = require('./utils/logger');

const commands = getAllCommandData();
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (!process.env.CLIENT_ID) throw new Error('CLIENT_ID is missing from your .env file.');

    if (process.env.GUILD_ID) {
      // Guild commands update instantly - best for development/testing.
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
      logger.success(`Registered ${commands.length} commands to guild ${process.env.GUILD_ID}`);
    } else {
      // Global commands can take up to an hour to propagate - use once you're live.
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
      logger.success(`Registered ${commands.length} global commands`);
    }
  } catch (err) {
    logger.error('Failed to deploy commands', { err: err.message });
    process.exit(1);
  }
})();
