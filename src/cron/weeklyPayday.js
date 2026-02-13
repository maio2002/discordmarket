const cron = require('node-cron');
const jobService = require('../services/jobService');
const logger = require('../utils/logger');

function start(client) {
  cron.schedule('5 0 * * 0', async () => {
    logger.info('Wöchentliche Gehälter werden verteilt...');

    try {
      for (const guild of client.guilds.cache.values()) {
        const count = await jobService.distributeWeeklyPayday(guild.id);
        if (count > 0) {
          logger.info(`${count} Gehälter verteilt für ${guild.name}.`);
        }
      }
    } catch (err) {
      logger.error('Fehler bei wöchentlichen Gehältern:', err);
    }
  });
}

module.exports = { start };
