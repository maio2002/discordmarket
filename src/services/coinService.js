const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { COINS } = require('../constants');
const xpService = require('./xpService');

async function addCoins(guildId, userId, amount, type, description = null) {
  const user = await xpService.getOrCreateUser(guildId, userId);
  user.coins += amount;
  await user.save();

  await Transaction.create({
    guildId,
    userId,
    type,
    amount,
    balanceAfter: user.coins,
    description,
  });

  return user;
}

async function removeCoins(guildId, userId, amount, type, description = null) {
  const user = await xpService.getOrCreateUser(guildId, userId);
  if (user.coins < amount) {
    throw new Error(`Nicht genug Coins. Benötigt: ${amount}, Vorhanden: ${user.coins}`);
  }
  user.coins -= amount;
  await user.save();

  await Transaction.create({
    guildId,
    userId,
    type,
    amount: -amount,
    balanceAfter: user.coins,
    description,
  });

  return user;
}

async function transfer(guildId, fromId, toId, amount, type, description = null) {
  const from = await xpService.getOrCreateUser(guildId, fromId);
  if (from.coins < amount) {
    throw new Error(`Nicht genug Coins. Benötigt: ${amount}, Vorhanden: ${from.coins}`);
  }

  from.coins -= amount;
  await from.save();

  const to = await xpService.getOrCreateUser(guildId, toId);
  to.coins += amount;
  await to.save();

  await Transaction.create({
    guildId,
    userId: fromId,
    targetId: toId,
    type,
    amount: -amount,
    balanceAfter: from.coins,
    description,
  });

  await Transaction.create({
    guildId,
    userId: toId,
    targetId: fromId,
    type,
    amount,
    balanceAfter: to.coins,
    description,
  });

  return { from, to };
}

async function getBalance(guildId, userId) {
  const user = await xpService.getOrCreateUser(guildId, userId);
  return user.coins;
}

module.exports = { addCoins, removeCoins, transfer, getBalance };
