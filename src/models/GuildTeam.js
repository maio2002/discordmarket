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
}, { timestamps: true });

guildTeamSchema.index({ guildId: 1, name: 1 }, { unique: true });
guildTeamSchema.index({ guildId: 1, members: 1 });

module.exports = mongoose.model('GuildTeam', guildTeamSchema);
