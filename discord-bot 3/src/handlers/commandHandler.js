const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const logger = require('../utils/logger');

function loadCommands(client) {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, '..', 'commands');
  const folders = fs.readdirSync(commandsPath);

  for (const folder of folders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);

      if (!command.data || !command.execute) {
        logger.warn(`Command file missing "data" or "execute": ${filePath}`);
        continue;
      }

      client.commands.set(command.data.name, command);
    }
  }

  logger.success(`Loaded ${client.commands.size} commands`);
}

function getAllCommandData() {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const folders = fs.readdirSync(commandsPath);
  const data = [];

  for (const folder of folders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      const command = require(path.join(folderPath, file));
      if (command.data) data.push(command.data.toJSON());
    }
  }

  return data;
}

module.exports = { loadCommands, getAllCommandData };
