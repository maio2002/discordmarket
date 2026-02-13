const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const logger = require('../utils/logger');

function loadCommands(client) {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, '..', 'commands');

  function readDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        readDir(fullPath);
      } else if (entry.name.endsWith('.js')) {
        const command = require(fullPath);
        if (!command.data || !command.execute) {
          logger.warn(`Kommando ${fullPath} fehlt "data" oder "execute" — übersprungen.`);
          continue;
        }
        client.commands.set(command.data.name, command);
        logger.info(`Kommando geladen: /${command.data.name}`);
      }
    }
  }

  readDir(commandsPath);
  logger.info(`${client.commands.size} Kommandos geladen.`);
}

module.exports = { loadCommands };
