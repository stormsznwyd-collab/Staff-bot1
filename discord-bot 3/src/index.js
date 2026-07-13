require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const logger = require('./utils/logger');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

if (!process.env.DISCORD_TOKEN) {
  logger.error('DISCORD_TOKEN is missing from your .env file. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

loadCommands(client);
loadEvents(client);

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled promise rejection', { err: err?.message, stack: err?.stack });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { err: err?.message, stack: err?.stack });
});

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  logger.error('Failed to log in. Check that DISCORD_TOKEN is correct.', { err: err.message });
  process.exit(1);
});
