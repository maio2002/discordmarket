const cron = require('node-cron');
const logger = require('../utils/logger');
const voiceTracker = require('../services/voiceTracker');

function startCronJobs(client) {
  setInterval(() => {
    voiceTracker.tickVoiceXp(client).catch(err =>
      logger.error('Fehler beim Voice-XP-Tick:', err)
    );
  }, 60_000);
  logger.info('Voice-XP-Tick gestartet (60s Intervall).');

  try {
    const weeklyBonuses = require('../cron/weeklyBonuses');
    weeklyBonuses.start(client);
    logger.info('Wöchentliche Boni Cron gestartet.');
  } catch {
    logger.info('weeklyBonuses Cron noch nicht implementiert — übersprungen.');
  }

  try {
    const weeklyPayday = require('../cron/weeklyPayday');
    weeklyPayday.start(client);
    logger.info('Wöchentliche Gehälter Cron gestartet.');
  } catch {
    logger.info('weeklyPayday Cron noch nicht implementiert — übersprungen.');
  }
}

module.exports = { startCronJobs };
