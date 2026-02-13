const { Events, ActivityType } = require('discord.js');
const logger = require('../utils/logger');
const { startCronJobs } = require('../handlers/cronHandler');
const marketService = require('../services/marketService');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(`Eingeloggt als ${client.user.tag}`);
    logger.info(`Verbunden mit ${client.guilds.cache.size} Server(n).`);

    client.user.setActivity('MaioBot | /rang', { type: ActivityType.Playing });

    for (const guild of client.guilds.cache.values()) {
      await marketService.seedInitialRoles(guild.id);
    }

    startCronJobs(client);
  },
};
