const mongoose = require('mongoose');

const guildConfigSchema = new mongoose.Schema({
  guildId:            { type: String, required: true, unique: true },
  marketChannelId:    { type: String, default: null },
  logChannelId:       { type: String, default: null },
  levelUpChannelId:   { type: String, default: null },
  approvalChannelId:  { type: String, default: null },
  memberRoleId:       { type: String, default: null },
  vipRoleId:          { type: String, default: null },
  adminRoleIds:       [{ type: String }],
  rankRoleIds:        [{ type: String }],
  xpPerMessage:       { type: Number, default: 12 },
  xpPerVoiceMinute:   { type: Number, default: 12 },
  messageCooldownSec: { type: Number, default: 30 },
  voiceMinUsers:      { type: Number, default: 2 },
  roleBuyCooldownMin: { type: Number, default: 20 },
  serverratChannelId: { type: String, default: null },
});

module.exports = mongoose.model('GuildConfig', guildConfigSchema);
