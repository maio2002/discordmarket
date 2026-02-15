const User = require('../models/User');
const GuildConfig = require('../models/GuildConfig');
const { COINS, LEVEL } = require('../constants');
const logger = require('../utils/logger');

function costForLevel(level) {
  if (level < 1 || level > LEVEL.MAX_LEVEL) return 0;
  return LEVEL.RANKS[level - 1].cost;
}

function getRankName(level) {
  if (level < 1) return 'Kein Rang';
  if (level > LEVEL.MAX_LEVEL) return LEVEL.RANKS[LEVEL.MAX_LEVEL - 1].name;
  return LEVEL.RANKS[level - 1].name;
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

async function assignRankRole(guildId, userId, oldLevel, newLevel, guild) {
  try {
    const config = await GuildConfig.findOne({ guildId });
    if (!config || !config.rankRoleIds || config.rankRoleIds.length === 0) return;

    const member = await guild.members.fetch(userId);

    // Alte Rang-Rolle entfernen
    if (oldLevel >= 1 && oldLevel <= config.rankRoleIds.length) {
      const oldRoleId = config.rankRoleIds[oldLevel - 1];
      if (oldRoleId && member.roles.cache.has(oldRoleId)) {
        await member.roles.remove(oldRoleId).catch(() => {});
      }
    }

    // Neue Rang-Rolle hinzufügen
    if (newLevel >= 1 && newLevel <= config.rankRoleIds.length) {
      const newRoleId = config.rankRoleIds[newLevel - 1];
      if (newRoleId) {
        await member.roles.add(newRoleId).catch(() => {});
      }
    }
  } catch (err) {
    logger.error(`Rang-Rolle konnte nicht zugewiesen werden: ${err.message}`);
  }
}

async function levelUp(guildId, userId, amount, guild) {
  const user = await getOrCreateUser(guildId, userId);

  if (user.level >= LEVEL.MAX_LEVEL) {
    throw new Error(`Du hast bereits den höchsten Rang (**${getRankName(LEVEL.MAX_LEVEL)}**) erreicht.`);
  }

  if (amount <= 0) {
    throw new Error('Bitte gib einen gültigen Betrag ein.');
  }

  if (user.coins < amount) {
    throw new Error(`Du hast nur **${user.coins} Coins**, brauchst aber **${amount} Coins**.`);
  }

  const oldLevel = user.level;
  user.coins -= amount;
  user.levelProgress += amount;

  // Level up so oft wie möglich
  while (user.level < LEVEL.MAX_LEVEL && user.levelProgress >= costForLevel(user.level + 1)) {
    user.levelProgress -= costForLevel(user.level + 1);
    user.level += 1;
  }

  // Falls Max-Level erreicht, überschüssige Coins zurückgeben
  if (user.level >= LEVEL.MAX_LEVEL && user.levelProgress > 0) {
    user.coins += user.levelProgress;
    user.levelProgress = 0;
  }

  await user.save();

  try {
    const Transaction = require('../models/Transaction');
    await Transaction.create({
      guildId,
      userId,
      type: 'levelup',
      amount: -amount,
      balanceAfter: user.coins,
      description: user.level > oldLevel
        ? `Aufgestiegen: ${getRankName(oldLevel || 0)} → ${getRankName(user.level)}`
        : `${amount} Coins eingezahlt (${user.levelProgress}/${costForLevel(user.level + 1)})`,
    });
  } catch {
  }

  // Rang-Rolle zuweisen
  if (user.level > oldLevel && guild) {
    await assignRankRole(guildId, userId, oldLevel, user.level, guild);
    logger.info(`${userId} ist jetzt ${getRankName(user.level)}! (${guildId})`);
  }

  return { user, cost: amount, oldLevel, newLevel: user.level };
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
  getRankName,
  getOrCreateUser,
  addCoins,
  levelUp,
  getRank,
  getLeaderboard,
};
