const { Events } = require('discord.js');
const xpService = require('../services/xpService');
const { COINS } = require('../constants');

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const { guild, author } = message;
    const user = await xpService.getOrCreateUser(guild.id, author.id);

    if (user.lastMessageXp) {
      const elapsed = Date.now() - user.lastMessageXp.getTime();
      if (elapsed < COINS.MESSAGE_COOLDOWN_MS) return;
    }

    user.lastMessageXp = new Date();
    await user.save();

    const amount = Math.floor(Math.random() * (COINS.PER_MESSAGE_MAX - COINS.PER_MESSAGE_MIN + 1)) + COINS.PER_MESSAGE_MIN;
    await xpService.addCoins(guild.id, author.id, amount, 'message');
  },
};