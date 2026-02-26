const cron = require('node-cron');
const jobService = require('../services/jobService');
const coinService = require('../services/coinService');
const GuildTeam = require('../models/GuildTeam');
const logger = require('../utils/logger');

async function distributeGuildSalaries(guildId) {
  const teams = await GuildTeam.find({ guildId });
  let collected = 0;
  let paid = 0;

  for (const team of teams) {
    // 1. Wochenbeiträge einziehen (individuell, Fallback auf Gilden-Standard)
    for (const memberId of team.members) {
      const amount = team.memberContributions?.get(memberId) ?? team.weeklyContribution ?? 0;
      if (amount <= 0) continue;
      try {
        await coinService.removeCoins(guildId, memberId, amount, 'guild_contribution', `Wochenbeitrag: ${team.name}`);
        team.treasury += amount;
        collected++;
      } catch {
        // Mitglied hat nicht genug — überspringen
      }
    }

    // 2. Gildenjobs auszahlen (nur besetzte Stellen)
    for (const job of team.guildJobs.filter(j => j.status === 'filled')) {
      if (team.treasury >= job.salary) {
        try {
          await coinService.addCoins(guildId, job.userId, job.salary, 'guild_salary', `Gildenjob: ${job.title} (${team.name})`);
          team.treasury -= job.salary;
          paid++;
        } catch (err) {
          logger.error(`Gildenlohn-Fehler für ${job.userId}:`, err);
        }
      } else {
        logger.warn(`Gilde "${team.name}": Kasse reicht nicht für Gehalt von ${job.userId} (${job.title}).`);
      }
    }

    await team.save();
  }

  return { collected, paid };
}

function start(client) {
  cron.schedule('5 0 * * 0', async () => {
    logger.info('Wöchentliche Gehälter werden verteilt...');

    try {
      for (const guild of client.guilds.cache.values()) {
        const count = await jobService.distributeWeeklyPayday(guild.id);
        if (count > 0) {
          logger.info(`${count} Gehälter verteilt für ${guild.name}.`);
        }

        const { collected, paid } = await distributeGuildSalaries(guild.id);
        if (paid > 0 || collected > 0) {
          logger.info(`Gildenjobs für ${guild.name}: ${collected} Beiträge eingezogen, ${paid} Gehälter ausgezahlt.`);
        }
      }
    } catch (err) {
      logger.error('Fehler bei wöchentlichen Gehältern:', err);
    }
  });
}

module.exports = { start };
