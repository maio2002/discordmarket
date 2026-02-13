const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const config = require('./config');
const logger = require('./utils/logger');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

async function start() {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB verbunden.');
  } catch (error) {
    logger.error('MongoDB Verbindungsfehler:', error);
    process.exit(1);
  }

  loadCommands(client);
  loadEvents(client);

  await client.login(config.token);
}

process.on('unhandledRejection', (error) => {
  logger.error('Unbehandelte Rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Unbehandelte Exception:', error);
  process.exit(1);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB Verbindung getrennt.');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB wieder verbunden.');
});

start();
