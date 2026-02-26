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
  leaderless:    { type: Boolean, default: false },
  roleId:        { type: String, default: null },
  seats:         { type: Number, default: 0 },
  assignedSeats:   { type: [String], default: [] },
  pendingRequests: { type: [String], default: [] },
  news: [{
    content:   { type: String, required: true },
    authorId:  { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  }],
  channels: {
    categoryId: { type: String, default: null },
    chatId:     { type: String, default: null },
    newsId:     { type: String, default: null },
    voiceId:    { type: String, default: null },
  },
  staffRoles: {
    supporterRoleId: { type: String, default: null },
    moderatorRoleId: { type: String, default: null },
    adminRoleId:     { type: String, default: null },
    teamRoleId:      { type: String, default: null },
  },
  weeklyContribution:  { type: Number, default: 0 },
  memberContributions: { type: Map, of: Number, default: {} },
}, { timestamps: true });

guildTeamSchema.index({ guildId: 1, name: 1 }, { unique: true });
guildTeamSchema.index({ guildId: 1, members: 1 });

module.exports = mongoose.model('GuildTeam', guildTeamSchema);
