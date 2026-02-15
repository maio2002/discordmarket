const User = require('../models/User');
const { COINS, LEVEL } = require('../constants');
const logger = require('../utils/logger');

function costForLevel(level) {
  return Math.floor(LEVEL.FORMULA_BASE * Math.pow(level, LEVEL.FORMULA_EXPONENT));
}

async function getOrCreateUser(guildId, userId) {
  let user = await User.findOne({ guildId, userId });
  if (!user) {
    user = await User.create({ guildId, userId, coins: COINS.INITIAL_BALANCE });
  }
  return user;
}

async function addCoins(guildId, userId, amount, source = 'unknown') {
  const user = await getOrCreateUser(guildId, userId);
  user.coins += amount;

  await user.save();

  try {
    const Transaction = require('../models/Transaction');
    await Transaction.create({
      guildId,
      userId,
      type: source,
      amount,
      balanceAfter: user.coins,
      description: `+${amount} Coins (${source})`,
    });
  } catch {
  }

  return { user };
}

async function levelUp(guildId, userId, amount) {
  const user = await getOrCreateUser(guildId, userId);

  if (user.level >= LEVEL.MAX_LEVEL) {
    throw new Error('Du hast bereits das maximale Level erreicht.');
  }

  if (amount <= 0) {
    throw new Error('Bitte gib einen gültigen Betrag ein.');
  }

  if (user.coins < amount) {
    throw new Error(`Du hast nur **${user.coins} Coins**, brauchst aber **${amount} Coins**.`);
  }

  const oldLevel = user.level;
  let spent = 0;

  while (user.level < LEVEL.MAX_LEVEL && spent + costForLevel(user.level + 1) <= amount) {
    spent += costForLevel(user.level + 1);
    user.level += 1;
  }

  if (user.level === oldLevel) {
    const nextCost = costForLevel(user.level + 1);
    throw new Error(`Du brauchst mindestens **${nextCost} Coins** für das nächste Level.`);
  }

  user.coins -= spent;
  await user.save();

  try {
    const Transaction = require('../models/Transaction');
    await Transaction.create({
      guildId,
      userId,
      type: 'levelup',
      amount: -spent,
      balanceAfter: user.coins,
      description: `Aufleveln von Level ${oldLevel} auf ${user.level}`,
    });
  } catch {
  }

  logger.info(`${userId} hat Level ${user.level} erreicht! (${guildId})`);

  return { user, cost: spent, oldLevel, newLevel: user.level };
}

async function getRank(guildId, userId) {
  const user = await getOrCreateUser(guildId, userId);
  const count = await User.countDocuments({
    guildId,
    level: { $gt: user.level },
  });
  return count + 1;
}

async function getLeaderboard(guildId, page = 1, perPage = 10) {
  const skip = (page - 1) * perPage;
  const users = await User.find({ guildId })
    .sort({ level: -1, coins: -1 })
    .skip(skip)
    .limit(perPage)
    .lean();
  const total = await User.countDocuments({ guildId });
  return { users, total, totalPages: Math.ceil(total / perPage) };
}

module.exports = {
  costForLevel,
  getOrCreateUser,
  addCoins,
  levelUp,
  getRank,
  getLeaderboard,
};