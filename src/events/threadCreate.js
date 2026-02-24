const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ThreadCreate,

  async execute(thread, newlyCreated) {
    // Nur neue Threads verarbeiten, nicht beim Bot-Start gecachte
    if (!newlyCreated) return;

    // Nur Forum-Threads (keine normalen Kanal-Threads)
    if (!thread.parentId) return;

    // Keine Auto-Abstimmung wenn der Bot selbst den Thread erstellt hat (/antrag, /wahl)
    if (thread.ownerId === thread.client.user.id) return;

    try {
      const ratService = require('../services/ratService');
      await ratService.handleAutoVoteThread(thread);
    } catch (err) {
      logger.warn(`Auto-Abstimmung für Thread "${thread.name}" fehlgeschlagen: ${err.message}`);
    }
  },
};
