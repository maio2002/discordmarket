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
    try {
      const seatService = require('../services/seatService');
      await seatService.closeSeatElections(client);
    } catch (err) {
      logger.error('Fehler beim Schließen abgelaufener Sitzwahlen:', err);
    }
  });
  logger.info('Serverrat Auto-Close Cron gestartet (5min Intervall).');

  // Sitzwahl: Am 1. jedes Monats automatisch starten
  cron.schedule('0 0 1 * *', async () => {
    const seatService = require('../services/seatService');
    for (const guild of client.guilds.cache.values()) {
      try {
        await seatService.startSeatElection(guild);
      } catch (err) {
        logger.warn(`Sitzwahl-Start für ${guild.id} fehlgeschlagen: ${err.message}`);
      }
    }
    logger.info('Monatliche Sitzwahl gestartet.');
  });
  logger.info('Sitzwahl-Cron gestartet (1. des Monats).');
}

module.exports = { startCronJobs };
