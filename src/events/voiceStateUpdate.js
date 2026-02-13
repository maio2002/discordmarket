const { Events } = require('discord.js');
const voiceTracker = require('../services/voiceTracker');
const logger = require('../utils/logger');

module.exports = {
  name: Events.VoiceStateUpdate,
  once: false,
  async execute(oldState, newState) {
    const userId = newState.id;
    const guildId = newState.guild.id;

    const wasInChannel = !!oldState.channelId;
    const isInChannel = !!newState.channelId;

    if (wasInChannel && !isInChannel) {
      voiceTracker.removeSession(userId);
      return;
    }

    if (!wasInChannel && isInChannel) {
      const isMuted = newState.selfMute || newState.serverMute || newState.selfDeaf || newState.serverDeaf;
      voiceTracker.addSession(userId, guildId, newState.channelId, isMuted);
      return;
    }

    if (wasInChannel && isInChannel && oldState.channelId !== newState.channelId) {
      voiceTracker.updateChannel(userId, newState.channelId);
      return;
    }

    if (wasInChannel && isInChannel) {
      const isMuted = newState.selfMute || newState.serverMute || newState.selfDeaf || newState.serverDeaf;
      voiceTracker.updateMute(userId, isMuted);
    }
  },
};
