const mongoose = require('mongoose');

const guildTeamSchema = new mongoose.Schema({
  guildId:     { type: String, required: true },
  name:        { type: String, required: true },
  leaderId:    { type: String, required: true },
  members:     { type: [String], default: [] },
  treasury:    { type: Number, default: 0 },
  level:       { type: Number, default: 0 },
  description: { type: String, default: null },
  foundedAt:   { type: Date, default: Date.now },
  channels: {
    categoryId: { type: String, default: null },
    chatId:     { type: String, default: null },
    newsId:     { type: String, default: null },
    voiceId:    { type: String, default: null },
  },
}, { timestamps: true });

guildTeamSchema.index({ guildId: 1, name: 1 }, { unique: true });
guildTeamSchema.index({ guildId: 1, members: 1 });

module.exports = mongoose.model('GuildTeam', guildTeamSchema);
