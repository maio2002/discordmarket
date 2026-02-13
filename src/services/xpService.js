const User = require('../models/User');
const { XP, COINS } = require('../constants');
const logger = require('../utils/logger');

function xpForLevel(level) {
  return Math.floor(XP.LEVEL_FORMULA_BASE * Math.pow(level, XP.LEVEL_FORMULA_EXPONENT));
}

function totalXpForLevel(level) {
  let total = 0;
  for (let i = 1; i <= level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

function getLevelFromXp(xp) {
  let level = 0;
  let cumulative = 0;
  while (level < XP.MAX_LEVEL) {
    const needed = xpForLevel(level + 1);
    if (cumulative + needed > xp) break;
    level++;
    cumulative += needed;
  }
  return level;
}

function getXpProgress(xp, level) {
  const currentLevelTotal = totalXpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progress = xp - currentLevelTotal;
  return { current: progress, needed: nextLevelXp };
}

async function getOrCreateUser(guildId, userId) {
  let user = await User.findOne({ guildId, userId });
  if (!user) {
    user = await User.create({ guildId, userId, coins: COINS.INITIAL_BALANCE });
  }
  return user;
}

async function addXp(guildId, userId, amount, source = 'unknown') {
  const user = await getOrCreateUser(guildId, userId);
  user.xp += amount;
  user.totalXpEarned += amount;
  user.coins += amount;

  const oldLevel = user.level;
  const newLevel = getLevelFromXp(user.xp);
  user.level = newLevel;

  await user.save();

  try {
    const Transaction = require('../models/Transaction');
    await Transaction.create({
      guildId,
      userId,
      type: source,
      amount,
      balanceAfter: user.coins,
      description: `+${amount} XP/Coins (${source})`,
    });
  } catch {
  }

  const leveledUp = newLevel > oldLevel;
  if (leveledUp) {
    logger.info(`${userId} hat Level ${newLevel} erreicht! (${guildId})`);
  }

  return { user, leveledUp, oldLevel, newLevel };
}

async function setXp(guildId, userId, amount) {
  const user = await getOrCreateUser(guildId, userId);
  user.xp = amount;
  user.level = getLevelFromXp(amount);
  await user.save();
  return user;
}

async function getRank(guildId, userId) {
  const count = await User.countDocuments({
    guildId,
    xp: { $gt: (await getOrCreateUser(guildId, userId)).xp },
  });
  return count + 1;
}

async function getLeaderboard(guildId, page = 1, perPage = 10) {
  const skip = (page - 1) * perPage;
  const users = await User.find({ guildId })
    .sort({ xp: -1 })
    .skip(skip)
    .limit(perPage)
    .lean();
  const total = await User.countDocuments({ guildId });
  return { users, total, totalPages: Math.ceil(total / perPage) };
}

module.exports = {
  xpForLevel,
  totalXpForLevel,
  getLevelFromXp,
  getXpProgress,
  getOrCreateUser,
  addXp,
  setXp,
  getRank,
  getLeaderboard,
};
