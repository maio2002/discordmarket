const logger = require('../utils/logger');
const { COINS } = require('../constants');

const activeSessions = new Map();

function addSession(userId, guildId, channelId, isMuted) {
  activeSessions.set(userId, { channelId, guildId, joinedAt: new Date(), isMuted });
}

function removeSession(userId) {
  activeSessions.delete(userId);
}

function updateMute(userId, isMuted) {
  const session = activeSessions.get(userId);
  if (session) {
    session.isMuted = isMuted;
  }
}

function updateChannel(userId, channelId) {
  const session = activeSessions.get(userId);
  if (session) {
    session.channelId = channelId;
  }
}

function getSession(userId) {
  return activeSessions.get(userId);
}

async function tickVoiceXp(client) {
  if (activeSessions.size === 0) return;

  const channels = new Map();
  for (const [userId, session] of activeSessions) {
    if (!channels.has(session.channelId)) {
      channels.set(session.channelId, []);
    }
    channels.get(session.channelId).push({ userId, ...session });
  }

  let xpService;
  try {
    xpService = require('./xpService');
  } catch {
    return;
  }

  for (const [channelId, users] of channels) {
    const eligible = users.filter(u => !u.isMuted);
    if (eligible.length <= COINS.VOICE_MIN_USERS) continue;

    for (const user of eligible) {
      try {
        const amount = Math.floor(Math.random() * (COINS.PER_VOICE_MAX - COINS.PER_VOICE_MIN + 1)) + COINS.PER_VOICE_MIN;
        await xpService.addCoins(user.guildId, user.userId, amount, 'voice');
      } catch (err) {
        logger.error(`Voice-Coins Fehler für ${user.userId}:`, err);
      }
    }
  }
}

module.exports = {
  activeSessions,
  addSession,
  removeSession,
  updateMute,
  updateChannel,
  getSession,
  tickVoiceXp,
};
