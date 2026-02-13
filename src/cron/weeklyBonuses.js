const cron = require('node-cron');
const User = require('../models/User');
const xpService = require('../services/xpService');
const { WEEKLY_BONUSES } = require('../constants');
const logger = require('../utils/logger');

function isThisWeek(date) {
  if (!date) return false;
  const now = new Date();
  const daysSince = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince < 6;
}

function start(client) {
  cron.schedule('0 0 * * 0', async () => {
    logger.info('Wöchentliche Boni werden verteilt...');

    let memberCount = 0;
    let vipCount = 0;

    try {
      const members = await User.find({ isMember: true });
      for (const user of members) {
        if (isThisWeek(user.lastWeeklyBonus)) continue;
        try {
          await xpService.addXp(user.guildId, user.userId, WEEKLY_BONUSES.MEMBER, 'weekly_bonus');
          user.lastWeeklyBonus = new Date();
          await user.save();
          memberCount++;
        } catch (err) {
          logger.error(`Weekly Member Bonus Fehler (${user.userId}):`, err);
        }
      }

      const vips = await User.find({ isVip: true });
      for (const user of vips) {
        try {
          await xpService.addXp(user.guildId, user.userId, WEEKLY_BONUSES.VIP, 'weekly_bonus');
          vipCount++;
        } catch (err) {
          logger.error(`Weekly VIP Bonus Fehler (${user.userId}):`, err);
        }
      }

      logger.info(`Wöchentliche Boni verteilt: ${memberCount} Member, ${vipCount} VIPs.`);
    } catch (err) {
      logger.error('Fehler bei wöchentlichen Boni:', err);
    }
  });
}

module.exports = { start };
