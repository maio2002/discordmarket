const MarketRole = require('../models/MarketRole');
const User = require('../models/User');
const coinService = require('./coinService');
const xpService = require('./xpService');
const { COINS } = require('../constants');
const logger = require('../utils/logger');

async function seedInitialRoles(guildId) {
  const count = await MarketRole.countDocuments({ guildId });
  if (count > 0) return;

  const initialRoles = [
    { name: 'Apple', price: 250, totalStock: 5 },
    { name: 'Banana', price: 250, totalStock: 2 },
    { name: 'Kurde', price: 250, totalStock: 10 },
  ];

  for (const role of initialRoles) {
    await MarketRole.create({ guildId, ...role });
  }
  logger.info(`${initialRoles.length} initiale Marktrollen erstellt für ${guildId}.`);
}

async function getShopRoles(guildId, page = 1, perPage = 10) {
  const skip = (page - 1) * perPage;
  const roles = await MarketRole.find({ guildId })
    .sort({ isPrestige: 1, price: 1 })
    .skip(skip)
    .limit(perPage)
    .lean();
  const total = await MarketRole.countDocuments({ guildId });
  return { roles, total, totalPages: Math.ceil(total / perPage) };
}

async function buyRole(guildId, userId, roleName, guild) {
  const marketRole = await MarketRole.findOne({ guildId, name: { $regex: new RegExp(`^${roleName}$`, 'i') } });
  if (!marketRole) {
    throw new Error('Diese Rolle existiert nicht im Shop.');
  }

  const remaining = marketRole.totalStock - marketRole.purchased;
  if (remaining <= 0) {
    throw new Error('Diese Rolle ist ausverkauft.');
  }

  if (marketRole.buyers.includes(userId)) {
    throw new Error('Du besitzt diese Rolle bereits.');
  }

  const price = marketRole.isPrestige ? COINS.PRESTIGE_COST : marketRole.price;

  const user = await xpService.getOrCreateUser(guildId, userId);
  if (user.lastRoleBuy) {
    const elapsed = Date.now() - user.lastRoleBuy.getTime();
    if (elapsed < COINS.ROLE_BUY_COOLDOWN_MS) {
      const remaining_ms = COINS.ROLE_BUY_COOLDOWN_MS - elapsed;
      const minutes = Math.ceil(remaining_ms / 60_000);
      throw new Error(`Cooldown aktiv. Bitte warte noch ${minutes} Minute(n).`);
    }
  }

  const type = marketRole.isPrestige ? 'prestige' : 'role_purchase';
  await coinService.removeCoins(guildId, userId, price, type, `Rolle gekauft: ${marketRole.name}`);

  marketRole.purchased += 1;
  marketRole.buyers.push(userId);
  await marketRole.save();

  user.lastRoleBuy = new Date();
  await user.save();

  if (marketRole.roleId) {
    try {
      const member = await guild.members.fetch(userId);
      await member.roles.add(marketRole.roleId);
    } catch (err) {
      logger.error(`Rolle konnte nicht zugewiesen werden: ${err.message}`);
    }
  }

  return { marketRole, price };
}

async function addMarketRole(guildId, name, roleId, price, stock, isPrestige = false) {
  const existing = await MarketRole.findOne({ guildId, name });
  if (existing) {
    throw new Error('Eine Rolle mit diesem Namen existiert bereits im Shop.');
  }

  return MarketRole.create({
    guildId,
    roleId,
    name,
    price,
    totalStock: stock,
    isPrestige,
  });
}

async function removeMarketRole(guildId, name) {
  const role = await MarketRole.findOneAndDelete({ guildId, name: { $regex: new RegExp(`^${name}$`, 'i') } });
  if (!role) {
    throw new Error('Diese Rolle existiert nicht im Shop.');
  }
  return role;
}

module.exports = { seedInitialRoles, getShopRoles, buyRole, addMarketRole, removeMarketRole };
