const { Events } = require('discord.js');
const Service = require('../models/Service');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member) {
    try {
      const result = await Service.updateMany(
        { guildId: member.guild.id, providerId: member.id, isActive: true },
        { isActive: false }
      );
      if (result.modifiedCount > 0) {
        logger.info(`${member.user.tag} hat den Server verlassen — ${result.modifiedCount} Service(s) deaktiviert.`);
      }
    } catch (err) {
      logger.error('guildMemberRemove: Fehler beim Deaktivieren der Services:', err);
    }
  },
};
