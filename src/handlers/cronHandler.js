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

  // Serverrat: Abgelaufene Anträge und Wahlen alle 5 Minuten schließen
  cron.schedule('*/5 * * * *', async () => {
    try {
      const ratService = require('../services/ratService');
      await ratService.closeExpiredProposals(client);
      await ratService.closeExpiredElections(client);
    } catch (err) {
      logger.error('Fehler beim Schließen abgelaufener Serverrat-Vorgänge:', err);
    }
  });
  logger.info('Serverrat Auto-Close Cron gestartet (5min Intervall).');
}

module.exports = { startCronJobs };
