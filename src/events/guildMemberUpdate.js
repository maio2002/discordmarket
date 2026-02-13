const { Events } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const User = require('../models/User');
const xpService = require('../services/xpService');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberUpdate,
  once: false,
  async execute(oldMember, newMember) {
    const config = await GuildConfig.findOne({ guildId: newMember.guild.id });
    if (!config) return;

    const { memberRoleId, vipRoleId } = config;
    if (!memberRoleId && !vipRoleId) return;

    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    let changed = false;
    const user = await xpService.getOrCreateUser(newMember.guild.id, newMember.id);

    if (memberRoleId) {
      const wasMember = oldRoles.has(memberRoleId);
      const isMember = newRoles.has(memberRoleId);
      if (wasMember !== isMember) {
        user.isMember = isMember;
        changed = true;
        logger.info(`${newMember.user.tag}: Member-Status → ${isMember}`);
      }
    }

    if (vipRoleId) {
      const wasVip = oldRoles.has(vipRoleId);
      const isVip = newRoles.has(vipRoleId);
      if (wasVip !== isVip) {
        user.isVip = isVip;
        changed = true;
        logger.info(`${newMember.user.tag}: VIP-Status → ${isVip}`);
      }
    }

    if (changed) {
      await user.save();
    }
  },
};
