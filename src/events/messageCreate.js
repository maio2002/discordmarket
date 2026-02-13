const { Events } = require('discord.js');
const xpService = require('../services/xpService');
const { XP } = require('../constants');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const { guild, author } = message;
    const user = await xpService.getOrCreateUser(guild.id, author.id);

    if (user.lastMessageXp) {
      const elapsed = Date.now() - user.lastMessageXp.getTime();
      if (elapsed < XP.MESSAGE_COOLDOWN_MS) return;
    }

    user.lastMessageXp = new Date();
    await user.save();

    const { leveledUp, newLevel } = await xpService.addXp(
      guild.id,
      author.id,
      XP.PER_MESSAGE,
      'message_xp'
    );

    if (leveledUp) {
      try {
        await message.channel.send(
          `Glückwunsch ${author}! Du hast **Level ${newLevel}** erreicht!`
        );
      } catch (err) {
        logger.error('Level-Up Nachricht konnte nicht gesendet werden:', err);
      }
    }
  },
};
